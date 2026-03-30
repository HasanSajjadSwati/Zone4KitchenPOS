import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';
import { broadcastSync } from '../websocket.js';

type ReferentialTable = 'registerSessions' | 'users' | 'diningTables' | 'waiters' | 'customers' | 'riders';

async function recordExists(table: ReferentialTable, id: string): Promise<boolean> {
  const row = await getAsync(`SELECT 1 FROM ${table} WHERE id = ?`, [id]);
  return Boolean(row);
}

// Helper to check if a user has a specific permission
interface PermissionCheckResult {
  allowed: boolean;
  user: any;
  role: any;
  reason?: string;
}

async function checkUserPermission(
  userId: string | null,
  resource: string,
  action: string
): Promise<PermissionCheckResult> {
  if (!userId) {
    return { allowed: false, user: null, role: null, reason: 'User ID not provided' };
  }

  const user = await getAsync(
    `SELECT u.*, r.name as roleName, r.permissions as rolePermissions
     FROM users u
     JOIN roles r ON u.roleId = r.id
     WHERE u.id = ?`,
    [userId]
  );

  if (!user) {
    return { allowed: false, user: null, role: null, reason: 'User not found' };
  }

  // Admin always has full access
  if (user.roleName === 'Admin') {
    return { allowed: true, user, role: { name: user.roleName } };
  }

  try {
    const permissions = JSON.parse(user.rolePermissions || '[]');
    const resourcePerm = permissions.find((p: any) => p.resource === resource);
    
    if (resourcePerm && resourcePerm.actions.includes(action)) {
      return { allowed: true, user, role: { name: user.roleName } };
    }
    
    return { 
      allowed: false, 
      user, 
      role: { name: user.roleName },
      reason: `Permission denied: ${user.roleName} role does not have '${action}' permission on '${resource}'`
    };
  } catch (_e) {
    return { allowed: false, user, role: null, reason: 'Failed to parse role permissions' };
  }
}

// FRAUD PREVENTION: Helper to check if order is locked from modifications
interface OrderLockStatus {
  isLocked: boolean;
  reason: string | null;
  order: any;
}

async function checkOrderLocked(orderId: string): Promise<OrderLockStatus> {
  const order = await getAsync('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) {
    return { isLocked: false, reason: null, order: null };
  }
  
  // Order is locked if it's been paid OR completed
  if (order.isPaid) {
    return { isLocked: true, reason: 'Order has been paid and cannot be modified', order };
  }
  if (order.status === 'completed') {
    return { isLocked: true, reason: 'Order is completed and cannot be modified', order };
  }
  if (order.status === 'cancelled') {
    return { isLocked: true, reason: 'Order is cancelled and cannot be modified', order };
  }
  
  return { isLocked: false, reason: null, order };
}

// FRAUD PREVENTION: Create audit log for order modifications
async function logOrderModification(
  action: string,
  orderId: string,
  userId: string | null,
  before: any,
  after: any,
  description: string
): Promise<void> {
  try {
    const id = uuidv4();
    const now = new Date().toISOString();
    await runAsync(
      `INSERT INTO auditLogs (id, userId, action, tableName, recordId, before, after, description, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, action, 'orders', orderId, JSON.stringify(before), JSON.stringify(after), description, now]
    );
  } catch (error) {
    console.error('Failed to log order modification:', error);
  }
}

// Helper function to recalculate and update order totals
async function recalculateOrderTotals(orderId: string): Promise<void> {
  const order = await getAsync('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return;

  const items = await allAsync('SELECT totalPrice FROM orderItems WHERE orderId = ?', [orderId]);
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);

  const deliveryCharge = order.orderType === 'delivery' ? Math.max(0, order.deliveryCharge || 0) : 0;

  let discountAmount = 0;
  if (order.discountType === 'percentage') {
    discountAmount = (subtotal * (order.discountValue || 0)) / 100;
  } else if (order.discountType === 'fixed') {
    discountAmount = order.discountValue || 0;
  }

  const totalBeforeCharges = Math.max(0, subtotal - discountAmount);
  const total = Math.max(0, totalBeforeCharges + deliveryCharge);

  await runAsync(
    'UPDATE orders SET subtotal = ?, discountAmount = ?, total = ?, updatedAt = ? WHERE id = ?',
    [subtotal, discountAmount, total, new Date().toISOString(), orderId]
  );
}

// Shared column list for orders / pastOrders UNION (pastOrders has extra migratedAt)
const ORDERS_COLS = `id, orderNumber, registerSessionId, orderType, tableId, waiterId,
  customerName, customerPhone, customerId, riderId, deliveryAddress,
  deliveryCharge, subtotal, discountType, discountValue, discountReference,
  discountAmount, total, status, deliveryStatus, isPaid, notes,
  lastKotPrintedAt, kotPrintCount, createdBy, completedBy,
  cancellationReason, createdAt, completedAt, updatedAt`;

export const orderRoutes = express.Router();

// Helper function to generate next order number
async function generateNextOrderNumber(): Promise<string> {
  try {
    // Get the highest order number from both active and past orders
    const result = await getAsync(`
      SELECT orderNumber FROM (
        SELECT orderNumber FROM orders
        UNION ALL
        SELECT orderNumber FROM pastOrders
      ) combined
      ORDER BY CAST(SUBSTR(orderNumber, 5) AS INTEGER) DESC
      LIMIT 1
    `);

    if (result && result.orderNumber) {
      const match = result.orderNumber.match(/ORD-(\d+)/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        return `ORD-${String(nextNum).padStart(5, '0')}`;
      }
    }
  } catch (error) {
    console.error('Error getting last order number:', error);
  }

  // Default to first order number if no existing orders
  return 'ORD-00001';
}

// Get all orders
orderRoutes.get('/', async (req, res) => {
  try {
    const {
      status,
      registerSessionId,
      registerSessionIds,
      customerId,
      customerIds,
      orderType,
      startDate,
      endDate,
      dateField,
      includePast,
    } = req.query;

    // When includePast is set, query both active and archived orders
    const sourceTable = includePast === 'true'
      ? `(SELECT ${ORDERS_COLS} FROM orders UNION ALL SELECT ${ORDERS_COLS} FROM pastOrders)`
      : 'orders';

    let query = `SELECT * FROM ${sourceTable} AS o WHERE 1=1`;
    const params: any[] = [];
    const resolvedDateField = dateField === 'completedAt' ? 'completedAt' : 'createdAt';

    // FIX: 'all' is not a valid status - don't filter by it
    // Valid statuses are: 'open', 'completed', 'cancelled'
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (orderType) {
      query += ' AND orderType = ?';
      params.push(orderType);
    }
    if (customerId) {
      query += ' AND customerId = ?';
      params.push(customerId);
    }
    if (customerIds) {
      const ids = String(customerIds)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        query += ` AND customerId IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    }
    if (registerSessionId) {
      query += ' AND registerSessionId = ?';
      params.push(registerSessionId);
    }
    if (registerSessionIds) {
      const ids = String(registerSessionIds)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        query += ` AND registerSessionId IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    }
    
    // Date range filtering
    // For overnight orders (created 11pm, completed 1am), we want inclusive matching:
    // Show order if EITHER createdAt OR completedAt falls within the date range
    // This handles business days that span midnight
    if (startDate && endDate) {
      if (!status || status === 'all') {
        // "All" filter: include if created OR completed in range
        query += ` AND (
          (createdAt >= ? AND createdAt <= ?)
          OR
          (status = 'completed' AND completedAt IS NOT NULL AND completedAt >= ? AND completedAt <= ?)
        )`;
        params.push(startDate, endDate, startDate, endDate);
      } else if (status === 'completed') {
        // "Completed" filter: include completed orders created OR completed in range
        // This ensures overnight orders appear in the date they were created too
        query += ` AND (
          (createdAt >= ? AND createdAt <= ?)
          OR
          (completedAt >= ? AND completedAt <= ?)
        )`;
        params.push(startDate, endDate, startDate, endDate);
      } else {
        // "Open" or "Cancelled": use createdAt only
        query += ` AND createdAt >= ? AND createdAt <= ?`;
        params.push(startDate, endDate);
      }
    } else {
      // Single-ended date filter: use resolved field
      if (startDate) {
        query += ` AND ${resolvedDateField} >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND ${resolvedDateField} <= ?`;
        params.push(endDate);
      }
    }

    // Handle isPaid filter
    const { isPaid, limit, offset } = req.query;
    if (isPaid === 'true') {
      query += ' AND isPaid = 1';
    } else if (isPaid === 'false') {
      query += ' AND isPaid = 0';
    }

    // Get total count for pagination (before LIMIT)
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await getAsync(countQuery, params);
    const total = countResult?.total || 0;

    query += ` ORDER BY ${resolvedDateField} DESC, createdAt DESC`;

    // Apply pagination if provided
    if (limit) {
      const limitNum = parseInt(String(limit), 10);
      const offsetNum = offset ? parseInt(String(offset), 10) : 0;
      query += ` LIMIT ${limitNum} OFFSET ${offsetNum}`;
    }

    const orders = await allAsync(query, params);
    
    // Recalculate totals for orders with 0 subtotal that have items
    // This fixes legacy data where totals weren't persisted correctly
    const ordersToFix = orders.filter((o: any) => o.subtotal === 0 || o.subtotal === null);
    if (ordersToFix.length > 0) {
      const orderIds = ordersToFix.map((o: any) => o.id);
      const allItems = await allAsync(
        `SELECT orderId, SUM(totalPrice) as itemsTotal FROM orderItems WHERE orderId IN (${orderIds.map(() => '?').join(',')}) GROUP BY orderId`,
        orderIds
      );
      const itemsTotalByOrder = new Map<string, number>();
      for (const item of allItems) {
        itemsTotalByOrder.set(item.orderId, item.itemsTotal || 0);
      }
      
      // Update orders in memory and persist fixes
      for (const order of orders) {
        const itemsTotal = itemsTotalByOrder.get(order.id);
        if (itemsTotal && itemsTotal > 0 && (order.subtotal === 0 || order.subtotal === null)) {
          const deliveryCharge = order.orderType === 'delivery' ? Math.max(0, order.deliveryCharge || 0) : 0;
          let discountAmount = 0;
          if (order.discountType === 'percentage') {
            discountAmount = (itemsTotal * (order.discountValue || 0)) / 100;
          } else if (order.discountType === 'fixed') {
            discountAmount = order.discountValue || 0;
          }
          const totalBeforeCharges = Math.max(0, itemsTotal - discountAmount);
          const total = Math.max(0, totalBeforeCharges + deliveryCharge);
          
          // Update in memory for response
          order.subtotal = itemsTotal;
          order.discountAmount = discountAmount;
          order.total = total;
          
          // Persist the fix (fire and forget)
          runAsync(
            'UPDATE orders SET subtotal = ?, discountAmount = ?, total = ? WHERE id = ?',
            [itemsTotal, discountAmount, total, order.id]
          ).catch(err => console.error('Failed to fix order totals:', err));
        }
      }
    }
    
    res.json({ orders: convertBooleansArray(orders), total });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get order with items
orderRoutes.get('/:id', async (req, res) => {
  try {
    let order = await getAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await allAsync(
      'SELECT * FROM orderItems WHERE orderId = ? ORDER BY addedAt',
      [req.params.id]
    );

    const parsedItems = items.map(item => convertBooleans({
      ...item,
      selectedVariants: item.selectedVariants ? JSON.parse(item.selectedVariants) : [],
      dealBreakdown: item.dealBreakdown ? JSON.parse(item.dealBreakdown) : null
    }));

    // Recalculate totals if subtotal is 0 but items exist
    const itemsTotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
    if (itemsTotal > 0 && (order.subtotal === 0 || order.subtotal === null)) {
      const deliveryCharge = order.orderType === 'delivery' ? Math.max(0, order.deliveryCharge || 0) : 0;
      let discountAmount = 0;
      if (order.discountType === 'percentage') {
        discountAmount = (itemsTotal * (order.discountValue || 0)) / 100;
      } else if (order.discountType === 'fixed') {
        discountAmount = order.discountValue || 0;
      }
      const totalBeforeCharges = Math.max(0, itemsTotal - discountAmount);
      const total = Math.max(0, totalBeforeCharges + deliveryCharge);
      
      // Update in memory for response
      order.subtotal = itemsTotal;
      order.discountAmount = discountAmount;
      order.total = total;
      
      // Persist the fix
      await runAsync(
        'UPDATE orders SET subtotal = ?, discountAmount = ?, total = ? WHERE id = ?',
        [itemsTotal, discountAmount, total, order.id]
      );
    }

    res.json(convertBooleans({ ...order, items: parsedItems }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create order
orderRoutes.post('/', async (req, res) => {
  try {
    const {
      registerSessionId,
      orderType,
      tableId,
      waiterId,
      customerName,
      customerPhone,
      customerId,
      riderId,
      deliveryAddress,
      deliveryCharge,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      total,
      createdBy,
      notes
    } = req.body;

    // Validate required fields
    if (!registerSessionId || !orderType || !createdBy) {
      return res.status(400).json({ error: 'Missing required fields: registerSessionId, orderType, createdBy' });
    }

    if (orderType === 'delivery' && (!customerPhone || String(customerPhone).trim().length === 0)) {
      return res.status(400).json({ error: 'Customer phone is required for delivery orders' });
    }

    if (!(await recordExists('registerSessions', registerSessionId))) {
      return res.status(400).json({ error: 'Register session not found' });
    }

    if (!(await recordExists('users', createdBy))) {
      return res.status(400).json({ error: 'Creating user not found' });
    }

    if (tableId && !(await recordExists('diningTables', tableId))) {
      return res.status(400).json({ error: 'Table not found' });
    }

    if (waiterId && !(await recordExists('waiters', waiterId))) {
      return res.status(400).json({ error: 'Waiter not found' });
    }

    if (customerId && !(await recordExists('customers', customerId))) {
      return res.status(400).json({ error: 'Customer not found' });
    }

    if (riderId && !(await recordExists('riders', riderId))) {
      return res.status(400).json({ error: 'Rider not found' });
    }

    const parsedDeliveryCharge = Number(deliveryCharge);
    const normalizedDeliveryCharge = orderType === 'delivery' && Number.isFinite(parsedDeliveryCharge)
      ? Math.max(0, parsedDeliveryCharge)
      : 0;

    // Generate order number on the backend (ensures uniqueness)
    const orderNumber = await generateNextOrderNumber();

    const id = uuidv4();
    const now = new Date().toISOString();

    // Set initial delivery status for delivery orders
    const initialDeliveryStatus = orderType === 'delivery' ? 'pending' : null;

    await runAsync(
      `INSERT INTO orders (
        id, orderNumber, registerSessionId, orderType, tableId, waiterId,
        customerName, customerPhone, customerId, riderId, deliveryAddress, deliveryCharge,
        subtotal, discountType, discountValue, discountAmount, total,
        status, deliveryStatus, isPaid, createdBy, createdAt, updatedAt, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, orderNumber, registerSessionId, orderType, tableId || null, waiterId || null,
        customerName || null, customerPhone || null, customerId || null, riderId || null, deliveryAddress || null, normalizedDeliveryCharge,
        subtotal, discountType || null, discountValue || 0, discountAmount || 0, total,
        'open', initialDeliveryStatus, 0, createdBy, now, now, notes || null
      ]
    );

    const order = await getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    
    // Broadcast to all connected clients
    broadcastSync('orders', 'create', id);
    
    res.status(201).json(convertBooleans({ ...order, items: [] }));
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update order
orderRoutes.put('/:id', async (req, res) => {
  try {
    const {
      customerName, customerPhone, customerId, notes,
      status, deliveryStatus, isPaid, subtotal, discountType, discountValue, discountAmount, total,
      completedBy, cancellationReason, waiterId, riderId, deliveryAddress, deliveryCharge
    } = req.body;
    const now = new Date().toISOString();

    const order = await getAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // PERMISSION CHECK: Verify user has 'cancel' permission if trying to cancel order
    if (status === 'cancelled') {
      const userId = req.headers['x-user-id'] as string || req.body.userId;
      const permCheck = await checkUserPermission(userId, 'orders', 'cancel');
      if (!permCheck.allowed) {
        return res.status(403).json({ error: permCheck.reason || 'You do not have permission to cancel orders' });
      }
    }

    // FRAUD PREVENTION: Block financial modifications on paid/completed orders
    const isOrderLocked = order.isPaid || order.status === 'completed' || order.status === 'cancelled';
    const hasFinancialChanges = 
      subtotal !== undefined ||
      discountType !== undefined ||
      discountValue !== undefined ||
      discountAmount !== undefined ||
      total !== undefined ||
      deliveryCharge !== undefined;
    
    // Allow only specific changes on locked orders: status changes to complete/cancel, delivery status, notes
    // Block all financial modifications
    if (isOrderLocked && hasFinancialChanges) {
      // Log the attempted modification
      await logOrderModification(
        'BLOCKED_UPDATE_ORDER',
        req.params.id,
        req.body.userId || req.headers['x-user-id'] as string || null,
        { subtotal: order.subtotal, discountAmount: order.discountAmount, total: order.total },
        { attemptedChanges: { subtotal, discountType, discountValue, discountAmount, total, deliveryCharge } },
        `BLOCKED: Attempted to modify financial data on locked order. Order status: ${order.status}, isPaid: ${order.isPaid}`
      );
      return res.status(403).json({ 
        error: 'Cannot modify financial data on a paid or completed order. Contact an administrator.' 
      });
    }

    if (order.orderType === 'delivery' && customerPhone !== undefined && String(customerPhone).trim().length === 0) {
      return res.status(400).json({ error: 'Customer phone is required for delivery orders' });
    }

    if (waiterId && !(await recordExists('waiters', waiterId))) {
      return res.status(400).json({ error: 'Waiter not found' });
    }

    if (riderId && !(await recordExists('riders', riderId))) {
      return res.status(400).json({ error: 'Rider not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (customerName !== undefined) {
      updates.push('customerName = ?');
      values.push(customerName);
    }
    if (customerPhone !== undefined) {
      updates.push('customerPhone = ?');
      values.push(customerPhone);
    }
    if (customerId !== undefined) {
      updates.push('customerId = ?');
      values.push(customerId);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
      if (status === 'completed') {
        updates.push('completedAt = ?');
        values.push(now);
      }
    }
    if (isPaid !== undefined) {
      updates.push('isPaid = ?');
      values.push(isPaid ? 1 : 0);
    }
    if (subtotal !== undefined) {
      updates.push('subtotal = ?');
      values.push(subtotal);
    }
    if (discountType !== undefined) {
      updates.push('discountType = ?');
      values.push(discountType);
    }
    if (discountValue !== undefined) {
      updates.push('discountValue = ?');
      values.push(discountValue);
    }
    if (discountAmount !== undefined) {
      updates.push('discountAmount = ?');
      values.push(discountAmount);
    }
    if (total !== undefined) {
      updates.push('total = ?');
      values.push(total);
    }
    if (completedBy !== undefined) {
      updates.push('completedBy = ?');
      values.push(completedBy);
    }
    if (cancellationReason !== undefined) {
      updates.push('cancellationReason = ?');
      values.push(cancellationReason);
    }
    if (deliveryStatus !== undefined) {
      updates.push('deliveryStatus = ?');
      values.push(deliveryStatus);
    }
    if (deliveryCharge !== undefined) {
      const normalizedDeliveryCharge = order.orderType === 'delivery'
        ? Math.max(0, Number(deliveryCharge) || 0)
        : 0;
      updates.push('deliveryCharge = ?');
      values.push(normalizedDeliveryCharge);
    }
    if (waiterId !== undefined) {
      updates.push('waiterId = ?');
      values.push(waiterId);
    }
    if (riderId !== undefined) {
      updates.push('riderId = ?');
      values.push(riderId);
    }
    if (deliveryAddress !== undefined) {
      updates.push('deliveryAddress = ?');
      values.push(deliveryAddress);
    }

    if (updates.length > 0) {
      updates.push('updatedAt = ?');
      values.push(now);
      values.push(req.params.id);

      await runAsync(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const updated = await getAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    
    // Broadcast to all connected clients
    broadcastSync('orders', 'update', req.params.id);
    
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add item to order
orderRoutes.post('/:id/items', async (req, res) => {
  try {
    const { id: providedId, itemType, menuItemId, dealId, quantity, unitPrice, totalPrice, notes, selectedVariants, dealBreakdown } = req.body;
    const { id: orderId } = req.params;

    // FRAUD PREVENTION: Check if order is locked
    const lockStatus = await checkOrderLocked(orderId);
    if (lockStatus.isLocked) {
      // Log the attempted modification
      await logOrderModification(
        'BLOCKED_ADD_ITEM',
        orderId,
        req.body.userId || req.headers['x-user-id'] as string || null,
        null,
        { attemptedItem: { itemType, menuItemId, dealId, quantity, unitPrice, totalPrice } },
        `BLOCKED: Attempted to add item to locked order. Reason: ${lockStatus.reason}`
      );
      return res.status(403).json({ error: lockStatus.reason });
    }

    if (!itemType || !quantity || unitPrice === undefined || totalPrice === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use the ID provided by frontend, or generate a new one as fallback
    const itemId = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO orderItems (
        id, orderId, itemType, menuItemId, dealId, quantity, unitPrice, totalPrice,
        notes, selectedVariants, dealBreakdown, addedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId, orderId, itemType, menuItemId || null, dealId || null, quantity, unitPrice, totalPrice,
        notes || null, JSON.stringify(selectedVariants || []), JSON.stringify(dealBreakdown || null), now, now
      ]
    );

    // Recalculate order totals after adding item
    await recalculateOrderTotals(orderId);

    const item = await getAsync('SELECT * FROM orderItems WHERE id = ?', [itemId]);
    
    // Broadcast to all connected clients
    broadcastSync('order_items', 'create', orderId);
    
    res.status(201).json(convertBooleans({
      ...item,
      selectedVariants: JSON.parse(item.selectedVariants),
      dealBreakdown: item.dealBreakdown ? JSON.parse(item.dealBreakdown) : null
    }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get order items
orderRoutes.get('/:id/items', async (req, res) => {
  try {
    const items = await allAsync(
      'SELECT * FROM orderItems WHERE orderId = ? ORDER BY addedAt',
      [req.params.id]
    );

    const parsedItems = items.map(item => convertBooleans({
      ...item,
      selectedVariants: item.selectedVariants ? JSON.parse(item.selectedVariants) : [],
      dealBreakdown: item.dealBreakdown ? JSON.parse(item.dealBreakdown) : null
    }));

    res.json(parsedItems);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update order item
orderRoutes.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { quantity, unitPrice, totalPrice, notes, selectedVariants } = req.body;

    // FRAUD PREVENTION: Check if order is locked
    const lockStatus = await checkOrderLocked(req.params.id);
    if (lockStatus.isLocked) {
      const item = await getAsync('SELECT * FROM orderItems WHERE id = ?', [req.params.itemId]);
      // Log the attempted modification
      await logOrderModification(
        'BLOCKED_UPDATE_ITEM',
        req.params.id,
        req.body.userId || req.headers['x-user-id'] as string || null,
        item,
        { attemptedChanges: { quantity, unitPrice, totalPrice, notes } },
        `BLOCKED: Attempted to modify item in locked order. Reason: ${lockStatus.reason}`
      );
      return res.status(403).json({ error: lockStatus.reason });
    }

    const item = await getAsync('SELECT * FROM orderItems WHERE id = ?', [req.params.itemId]);
    if (!item) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (quantity !== undefined) {
      updates.push('quantity = ?');
      values.push(quantity);
    }
    if (unitPrice !== undefined) {
      updates.push('unitPrice = ?');
      values.push(unitPrice);
    }
    if (totalPrice !== undefined) {
      updates.push('totalPrice = ?');
      values.push(totalPrice);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    if (selectedVariants !== undefined) {
      updates.push('selectedVariants = ?');
      values.push(JSON.stringify(selectedVariants));
    }

    if (updates.length > 0) {
      values.push(req.params.itemId);
      await runAsync(`UPDATE orderItems SET ${updates.join(', ')} WHERE id = ?`, values);
      
      // Recalculate order totals after updating item
      await recalculateOrderTotals(req.params.id);
    }

    const updated = await getAsync('SELECT * FROM orderItems WHERE id = ?', [req.params.itemId]);
    
    // Broadcast to all connected clients
    broadcastSync('order_items', 'update', req.params.id);
    
    res.json(convertBooleans({
      ...updated,
      selectedVariants: updated.selectedVariants ? JSON.parse(updated.selectedVariants) : [],
      dealBreakdown: updated.dealBreakdown ? JSON.parse(updated.dealBreakdown) : null
    }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update delivery status
orderRoutes.put('/:id/delivery-status', async (req, res) => {
  try {
    const { deliveryStatus } = req.body;
    const { id } = req.params;
    const now = new Date().toISOString();

    if (!deliveryStatus) {
      return res.status(400).json({ error: 'deliveryStatus is required' });
    }

    const validStatuses = ['pending', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
    if (!validStatuses.includes(deliveryStatus)) {
      return res.status(400).json({ error: `Invalid delivery status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.orderType !== 'delivery') {
      return res.status(400).json({ error: 'Can only update delivery status for delivery orders' });
    }

    await runAsync(
      'UPDATE orders SET deliveryStatus = ?, updatedAt = ? WHERE id = ?',
      [deliveryStatus, now, id]
    );

    const updated = await getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    
    // Broadcast to all connected clients
    broadcastSync('orders', 'update', id);
    
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete order item
orderRoutes.delete('/:id/items/:itemId', async (req, res) => {
  try {
    // PERMISSION CHECK: Verify user has 'delete' permission on 'order_items' resource
    const userId = req.headers['x-user-id'] as string || req.body.userId;
    const permCheck = await checkUserPermission(userId, 'order_items', 'delete');
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.reason || 'You do not have permission to delete order items' });
    }

    // FRAUD PREVENTION: Check if order is locked
    const lockStatus = await checkOrderLocked(req.params.id);
    if (lockStatus.isLocked) {
      const item = await getAsync('SELECT * FROM orderItems WHERE id = ?', [req.params.itemId]);
      // Log the attempted deletion - THIS IS THE MAIN FRAUD VECTOR
      await logOrderModification(
        'BLOCKED_DELETE_ITEM',
        req.params.id,
        req.headers['x-user-id'] as string || null,
        item,
        null,
        `BLOCKED: Attempted to DELETE item from locked order. Reason: ${lockStatus.reason}. Item value: ${item?.totalPrice || 'unknown'}`
      );
      return res.status(403).json({ error: lockStatus.reason });
    }

    const item = await getAsync('SELECT * FROM orderItems WHERE id = ?', [req.params.itemId]);
    if (!item) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    await runAsync('DELETE FROM orderItems WHERE id = ?', [req.params.itemId]);
    
    // Recalculate order totals after deleting item
    await recalculateOrderTotals(req.params.id);
    
    // Broadcast to all connected clients
    broadcastSync('order_items', 'delete', req.params.id);
    
    res.json({ message: 'Order item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// FRAUD PREVENTION: Admin-only endpoint to unlock an order for legitimate corrections
// This creates a complete audit trail and requires admin authorization
orderRoutes.post('/:id/admin-unlock', async (req, res) => {
  try {
    const { adminUserId, reason } = req.body;
    const orderId = req.params.id;

    if (!adminUserId || !reason) {
      return res.status(400).json({ error: 'Admin user ID and reason are required' });
    }

    if (reason.trim().length < 10) {
      return res.status(400).json({ error: 'Please provide a detailed reason (at least 10 characters)' });
    }

    // Verify admin role
    const admin = await getAsync(
      `SELECT u.id, u.fullName, r.name as roleName
       FROM users u
       JOIN roles r ON u.roleId = r.id
       WHERE u.id = ?`,
      [adminUserId]
    );

    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    if (String(admin.roleName).toLowerCase() !== 'admin') {
      // Log the unauthorized attempt
      await logOrderModification(
        'BLOCKED_ADMIN_UNLOCK',
        orderId,
        adminUserId,
        null,
        null,
        `BLOCKED: Non-admin user "${admin.fullName}" attempted to unlock order. Role: ${admin.roleName}`
      );
      return res.status(403).json({ error: 'Only administrators can unlock orders' });
    }

    const order = await getAsync('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const now = new Date().toISOString();

    // Store original state
    const beforeState = {
      isPaid: order.isPaid,
      status: order.status,
      total: order.total,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount
    };

    // Unlock: Set isPaid to false temporarily and status to 'open'
    // The order can now be modified, but will need to be re-paid
    await runAsync(
      `UPDATE orders SET isPaid = 0, status = 'open', updatedAt = ? WHERE id = ?`,
      [now, orderId]
    );

    const updated = await getAsync('SELECT * FROM orders WHERE id = ?', [orderId]);

    // Create detailed audit log
    await logOrderModification(
      'ADMIN_UNLOCK_ORDER',
      orderId,
      adminUserId,
      beforeState,
      {
        isPaid: updated.isPaid,
        status: updated.status,
        unlockedAt: now,
        unlockedBy: admin.fullName,
        reason: reason
      },
      `ADMIN OVERRIDE: Order unlocked by "${admin.fullName}". Reason: ${reason}. Original paid: ${beforeState.isPaid}, original total: ${beforeState.total}`
    );

    // Broadcast update
    broadcastSync('orders', 'update', orderId);

    res.json({
      message: 'Order unlocked successfully. All modifications will be logged.',
      order: convertBooleans(updated),
      warning: 'This action has been logged in the audit trail.'
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
