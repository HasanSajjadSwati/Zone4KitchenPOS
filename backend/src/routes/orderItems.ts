import express from 'express';
import { allAsync, convertBooleans } from '../db/database.js';

export const orderItemRoutes = express.Router();

function parseIdList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// Get order items with optional filters (orderIds, date range, order status/type, etc.)
orderItemRoutes.get('/', async (req, res) => {
  try {
    const {
      orderIds,
      startDate,
      endDate,
      status,
      orderType,
      registerSessionId,
      customerId,
    } = req.query;

    const ids = parseIdList(orderIds);
    const conditions: string[] = [];
    const params: any[] = [];

    let query = 'SELECT oi.* FROM orderItems oi';

    const requiresOrderJoin = Boolean(
      startDate || endDate || status || orderType || registerSessionId || customerId
    );

    if (requiresOrderJoin) {
      query += ' JOIN orders o ON oi.orderId = o.id';

      if (status) {
        conditions.push('o.status = ?');
        params.push(status);
      }
      if (orderType) {
        conditions.push('o.orderType = ?');
        params.push(orderType);
      }
      if (registerSessionId) {
        conditions.push('o.registerSessionId = ?');
        params.push(registerSessionId);
      }
      if (customerId) {
        conditions.push('o.customerId = ?');
        params.push(customerId);
      }
      if (startDate) {
        conditions.push('o.createdAt >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('o.createdAt <= ?');
        params.push(endDate);
      }
    }

    if (ids.length > 0) {
      conditions.push(`oi.orderId IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY oi.addedAt';

    const items = await allAsync(query, params);
    const parsedItems = items.map(item => convertBooleans({
      ...item,
      selectedVariants: item.selectedVariants ? JSON.parse(item.selectedVariants) : [],
      dealBreakdown: item.dealBreakdown ? JSON.parse(item.dealBreakdown) : null,
    }));

    res.json(parsedItems);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
