import express from 'express';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';

export const pastOrderRoutes = express.Router();

// Get all past orders (paginated, with filters)
pastOrderRoutes.get('/', async (req, res) => {
  try {
    const {
      status,
      orderType,
      customerId,
      startDate,
      endDate,
      isPaid,
      limit,
      offset,
      search,
    } = req.query;

    let query = 'SELECT * FROM pastOrders WHERE 1=1';
    const params: any[] = [];

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
    if (startDate) {
      query += ' AND createdAt >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND createdAt <= ?';
      params.push(endDate);
    }
    if (isPaid === 'true') {
      query += ' AND isPaid = 1';
    } else if (isPaid === 'false') {
      query += ' AND isPaid = 0';
    }
    if (search) {
      query += ' AND (orderNumber LIKE ? OR customerName LIKE ? OR customerPhone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Get total count for pagination
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await getAsync(countQuery, params);
    const total = countResult?.total || 0;

    query += ' ORDER BY createdAt DESC';

    // Apply pagination
    if (limit) {
      const limitNum = parseInt(String(limit), 10);
      const offsetNum = offset ? parseInt(String(offset), 10) : 0;
      query += ` LIMIT ${limitNum} OFFSET ${offsetNum}`;
    }

    const orders = await allAsync(query, params);
    res.json({ orders: convertBooleansArray(orders), total });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get single past order with items
pastOrderRoutes.get('/:id', async (req, res) => {
  try {
    const order = await getAsync('SELECT * FROM pastOrders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: 'Past order not found' });
    }

    const items = await allAsync(
      'SELECT * FROM pastOrderItems WHERE orderId = ? ORDER BY addedAt',
      [req.params.id]
    );

    const parsedItems = items.map((item: any) => convertBooleans({
      ...item,
      selectedVariants: item.selectedVariants ? JSON.parse(item.selectedVariants) : [],
      dealBreakdown: item.dealBreakdown ? JSON.parse(item.dealBreakdown) : null,
    }));

    const payments = await allAsync(
      'SELECT * FROM pastPayments WHERE orderId = ? ORDER BY paidAt DESC',
      [req.params.id]
    );

    res.json(convertBooleans({ ...order, items: parsedItems, payments }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get past order items
pastOrderRoutes.get('/:id/items', async (req, res) => {
  try {
    const items = await allAsync(
      'SELECT * FROM pastOrderItems WHERE orderId = ? ORDER BY addedAt',
      [req.params.id]
    );

    const parsedItems = items.map((item: any) => convertBooleans({
      ...item,
      selectedVariants: item.selectedVariants ? JSON.parse(item.selectedVariants) : [],
      dealBreakdown: item.dealBreakdown ? JSON.parse(item.dealBreakdown) : null,
    }));

    res.json(parsedItems);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Migrate orders to past orders
// POST /api/past-orders/migrate
// Body: { olderThanDays: number } - migrate completed/cancelled orders older than X days
pastOrderRoutes.post('/migrate', async (req, res) => {
  try {
    const { olderThanDays } = req.body;

    if (!olderThanDays || olderThanDays < 1) {
      return res.status(400).json({ error: 'olderThanDays must be at least 1' });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();
    const now = new Date().toISOString();

    // Only migrate completed or cancelled orders (not open ones)
    const ordersToMigrate = await allAsync(
      `SELECT * FROM orders WHERE status IN ('completed', 'cancelled') AND createdAt < ?`,
      [cutoffISO]
    );

    if (ordersToMigrate.length === 0) {
      return res.json({ message: 'No orders to migrate', migratedCount: 0 });
    }

    let migratedCount = 0;
    const errors: string[] = [];

    for (const order of ordersToMigrate) {
      try {
        // Check if already migrated (by id)
        const existing = await getAsync('SELECT id FROM pastOrders WHERE id = ?', [order.id]);
        if (existing) {
          // Already migrated, just delete from orders
          await runAsync('DELETE FROM kotPrints WHERE orderId = ?', [order.id]);
          await runAsync('DELETE FROM riderReceipts WHERE orderId = ?', [order.id]);
          await runAsync('DELETE FROM payments WHERE orderId = ?', [order.id]);
          await runAsync('DELETE FROM orderItems WHERE orderId = ?', [order.id]);
          await runAsync('DELETE FROM orders WHERE id = ?', [order.id]);
          migratedCount++;
          continue;
        }

        // Copy order to pastOrders
        await runAsync(
          `INSERT INTO pastOrders (
            id, orderNumber, registerSessionId, orderType, tableId, waiterId,
            customerName, customerPhone, customerId, riderId, deliveryAddress, deliveryCharge,
            subtotal, discountType, discountValue, discountReference, discountAmount, total,
            status, deliveryStatus, isPaid, notes, lastKotPrintedAt, kotPrintCount,
            createdBy, completedBy, cancellationReason, createdAt, completedAt, updatedAt, migratedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            order.id, order.orderNumber, order.registerSessionId, order.orderType,
            order.tableId, order.waiterId, order.customerName, order.customerPhone,
            order.customerId, order.riderId, order.deliveryAddress, order.deliveryCharge,
            order.subtotal, order.discountType, order.discountValue, order.discountReference,
            order.discountAmount, order.total, order.status, order.deliveryStatus,
            order.isPaid, order.notes, order.lastKotPrintedAt, order.kotPrintCount,
            order.createdBy, order.completedBy, order.cancellationReason,
            order.createdAt, order.completedAt, order.updatedAt, now
          ]
        );

        // Copy order items to pastOrderItems
        const items = await allAsync('SELECT * FROM orderItems WHERE orderId = ?', [order.id]);
        for (const item of items) {
          await runAsync(
            `INSERT INTO pastOrderItems (
              id, orderId, itemType, menuItemId, dealId, quantity, unitPrice, totalPrice,
              notes, selectedVariants, dealBreakdown, addedAt, lastPrintedAt, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id, item.orderId, item.itemType, item.menuItemId, item.dealId,
              item.quantity, item.unitPrice, item.totalPrice, item.notes,
              item.selectedVariants, item.dealBreakdown, item.addedAt,
              item.lastPrintedAt, item.createdAt
            ]
          );
        }

        // Copy payments to pastPayments
        const payments = await allAsync('SELECT * FROM payments WHERE orderId = ?', [order.id]);
        for (const payment of payments) {
          await runAsync(
            `INSERT INTO pastPayments (
              id, orderId, amount, method, reference, paidAt, receivedBy, notes, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payment.id, payment.orderId, payment.amount, payment.method,
              payment.reference, payment.paidAt, payment.receivedBy, payment.notes,
              payment.createdAt
            ]
          );
        }

        // Delete from active tables (order matters due to foreign keys)
        await runAsync('DELETE FROM kotPrints WHERE orderId = ?', [order.id]);
        await runAsync('DELETE FROM riderReceipts WHERE orderId = ?', [order.id]);
        await runAsync('DELETE FROM payments WHERE orderId = ?', [order.id]);
        await runAsync('DELETE FROM orderItems WHERE orderId = ?', [order.id]);
        await runAsync('DELETE FROM orders WHERE id = ?', [order.id]);

        migratedCount++;
      } catch (err) {
        errors.push(`Failed to migrate order ${order.orderNumber}: ${(err as Error).message}`);
      }
    }

    res.json({
      message: `Migration complete`,
      migratedCount,
      totalFound: ordersToMigrate.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get migration stats (how many orders would be migrated)
pastOrderRoutes.get('/migrate/preview', async (req, res) => {
  try {
    const { olderThanDays } = req.query;

    if (!olderThanDays) {
      return res.status(400).json({ error: 'olderThanDays query parameter is required' });
    }

    const days = parseInt(String(olderThanDays), 10);
    if (days < 1) {
      return res.status(400).json({ error: 'olderThanDays must be at least 1' });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();

    const result = await getAsync(
      `SELECT COUNT(*) as count FROM orders WHERE status IN ('completed', 'cancelled') AND createdAt < ?`,
      [cutoffISO]
    );

    const pastOrdersCount = await getAsync('SELECT COUNT(*) as count FROM pastOrders');
    const activeOrdersCount = await getAsync('SELECT COUNT(*) as count FROM orders');

    res.json({
      ordersToMigrate: result?.count || 0,
      currentActiveOrders: activeOrdersCount?.count || 0,
      currentPastOrders: pastOrdersCount?.count || 0,
      cutoffDate: cutoffISO,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
