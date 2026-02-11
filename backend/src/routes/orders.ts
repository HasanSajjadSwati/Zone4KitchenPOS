import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';

type ReferentialTable = 'registerSessions' | 'users' | 'diningTables' | 'waiters' | 'customers' | 'riders';

async function recordExists(table: ReferentialTable, id: string): Promise<boolean> {
  const row = await getAsync(`SELECT 1 FROM ${table} WHERE id = ?`, [id]);
  return Boolean(row);
}

export const orderRoutes = express.Router();

// Helper function to generate next order number
async function generateNextOrderNumber(): Promise<string> {
  try {
    // Get the highest order number from database
    const result = await getAsync(`
      SELECT orderNumber FROM orders
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
    } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];
    const resolvedDateField = dateField === 'completedAt' ? 'completedAt' : 'createdAt';

    if (status) {
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
    if (startDate) {
      query += ` AND ${resolvedDateField} >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND ${resolvedDateField} <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY ${resolvedDateField} DESC, createdAt DESC`;
    const orders = await allAsync(query, params);
    res.json(convertBooleansArray(orders));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get order with items
orderRoutes.get('/:id', async (req, res) => {
  try {
    const order = await getAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
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
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add item to order
orderRoutes.post('/:id/items', async (req, res) => {
  try {
    const { itemType, menuItemId, dealId, quantity, unitPrice, totalPrice, notes, selectedVariants, dealBreakdown } = req.body;
    const { id: orderId } = req.params;

    if (!itemType || !quantity || unitPrice === undefined || totalPrice === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const itemId = uuidv4();
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

    const item = await getAsync('SELECT * FROM orderItems WHERE id = ?', [itemId]);
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
    }

    const updated = await getAsync('SELECT * FROM orderItems WHERE id = ?', [req.params.itemId]);
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
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete order item
orderRoutes.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const item = await getAsync('SELECT * FROM orderItems WHERE id = ?', [req.params.itemId]);
    if (!item) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    await runAsync('DELETE FROM orderItems WHERE id = ?', [req.params.itemId]);
    res.json({ message: 'Order item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
