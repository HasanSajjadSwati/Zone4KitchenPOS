import express from 'express';
import { allAsync, getAsync } from '../db/database.js';
import { logger } from '../utils/logger.js';

export const reportRoutes = express.Router();

type DateBoundary = 'start' | 'end';

const toNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const getQueryValue = (value: unknown): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : null;
  }
  return String(value);
};

const normalizeDateParam = (value: unknown, boundary: DateBoundary): string | null => {
  const raw = getQueryValue(value);
  if (!raw) return null;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = isDateOnly ? new Date(`${raw}T00:00:00`) : new Date(raw);

  if (Number.isNaN(date.getTime())) return null;

  if (isDateOnly) {
    if (boundary === 'start') {
      date.setHours(0, 0, 0, 0);
    } else {
      date.setHours(23, 59, 59, 999);
    }
  }

  return date.toISOString();
};

const buildDateFilters = (dateExpr: string, startRaw: unknown, endRaw: unknown) => {
  const startDate = normalizeDateParam(startRaw, 'start');
  const endDate = normalizeDateParam(endRaw, 'end');
  const conditions: string[] = [];
  const params: any[] = [];

  if (startDate) {
    conditions.push(`${dateExpr} >= ?`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`${dateExpr} <= ?`);
    params.push(endDate);
  }

  return { conditions, params };
};

// Sales summary report (server-side aggregation)
reportRoutes.get('/sales-summary', async (req, res) => {
  try {
    const dateExpr = 'o.completedAt';
    const { conditions, params } = buildDateFilters(dateExpr, req.query.startDate, req.query.endDate);

    const baseConditions = [`o.status = 'completed'`, ...conditions];
    const whereClause = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';

    logger.debug('Sales summary query', { whereClause, params });

    // Use SUM(CASE WHEN...) for better compatibility instead of FILTER
    const summary = await getAsync(
      `
        SELECT
          COALESCE(SUM(o.total), 0) AS "totalSales",
          COUNT(*) AS "totalOrders",
          COALESCE(AVG(o.total), 0) AS "averageOrderValue",
          COALESCE(SUM(o.discountAmount), 0) AS "totalDiscounts",
          COALESCE(SUM(CASE WHEN o.orderType = 'dine_in' THEN o.total ELSE 0 END), 0) AS "dineInSales",
          COALESCE(SUM(CASE WHEN o.orderType = 'take_away' THEN o.total ELSE 0 END), 0) AS "takeAwaySales",
          COALESCE(SUM(CASE WHEN o.orderType = 'delivery' THEN o.total ELSE 0 END), 0) AS "deliverySales",
          SUM(CASE WHEN o.orderType = 'dine_in' THEN 1 ELSE 0 END) AS "dineInOrders",
          SUM(CASE WHEN o.orderType = 'take_away' THEN 1 ELSE 0 END) AS "takeAwayOrders",
          SUM(CASE WHEN o.orderType = 'delivery' THEN 1 ELSE 0 END) AS "deliveryOrders",
          SUM(CASE WHEN o.isPaid = true THEN 1 ELSE 0 END) AS "paidOrders",
          SUM(CASE WHEN o.isPaid = false OR o.isPaid IS NULL THEN 1 ELSE 0 END) AS "unpaidOrders",
          COALESCE(SUM(CASE WHEN o.isPaid = true THEN o.total ELSE 0 END), 0) AS "paidAmount",
          COALESCE(SUM(CASE WHEN o.isPaid = false OR o.isPaid IS NULL THEN o.total ELSE 0 END), 0) AS "unpaidAmount"
        FROM orders o
        ${whereClause}
      `,
      params
    );

    const itemsRow = await getAsync(
      `
        SELECT COALESCE(SUM(oi.quantity), 0) AS "totalItems"
        FROM orderItems oi
        JOIN orders o ON o.id = oi.orderId
        ${whereClause}
      `,
      params
    );

    const paymentRows = await allAsync(
      `
        SELECT p.method AS "method", COALESCE(SUM(p.amount), 0) AS "total"
        FROM payments p
        JOIN orders o ON o.id = p.orderId
        ${whereClause}
        GROUP BY p.method
      `,
      params
    );

    const paymentTotals = {
      cash: 0,
      card: 0,
      online: 0,
      other: 0,
    };

    for (const row of paymentRows) {
      const method = row.method;
      if (method === 'cash') paymentTotals.cash = toNumber(row.total);
      if (method === 'card') paymentTotals.card = toNumber(row.total);
      if (method === 'online') paymentTotals.online = toNumber(row.total);
      if (method === 'other') paymentTotals.other = toNumber(row.total);
    }

    res.json({
      totalSales: toNumber(summary?.totalSales),
      totalOrders: toNumber(summary?.totalOrders),
      averageOrderValue: toNumber(summary?.averageOrderValue),
      totalItems: toNumber(itemsRow?.totalItems),
      totalDiscounts: toNumber(summary?.totalDiscounts),
      dineInSales: toNumber(summary?.dineInSales),
      dineInOrders: toNumber(summary?.dineInOrders),
      takeAwaySales: toNumber(summary?.takeAwaySales),
      takeAwayOrders: toNumber(summary?.takeAwayOrders),
      deliverySales: toNumber(summary?.deliverySales),
      deliveryOrders: toNumber(summary?.deliveryOrders),
      cashSales: toNumber(paymentTotals.cash),
      cardSales: toNumber(paymentTotals.card),
      onlineSales: toNumber(paymentTotals.online),
      otherSales: toNumber(paymentTotals.other),
      paidOrders: toNumber(summary?.paidOrders),
      unpaidOrders: toNumber(summary?.unpaidOrders),
      paidAmount: toNumber(summary?.paidAmount),
      unpaidAmount: toNumber(summary?.unpaidAmount),
    });
  } catch (error) {
    logger.error('Sales summary report error', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Daily sales breakdown (server-side aggregation)
reportRoutes.get('/daily-sales', async (req, res) => {
  try {
    const dateExpr = 'o.completedAt';
    const { conditions, params } = buildDateFilters(dateExpr, req.query.startDate, req.query.endDate);

    const baseConditions = [`o.status = 'completed'`, ...conditions];
    const whereClause = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';

    logger.debug('Daily sales query', { whereClause, params });

    const rows = await allAsync(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('day', ${dateExpr}), 'YYYY-MM-DD') AS "date",
          COALESCE(SUM(o.total), 0) AS "totalSales",
          COUNT(*) AS "totalOrders"
        FROM orders o
        ${whereClause}
        GROUP BY DATE_TRUNC('day', ${dateExpr})
        ORDER BY "date"
      `,
      params
    );

    const result = rows.map((row) => {
      const totalOrders = toNumber(row.totalOrders);
      const totalSales = toNumber(row.totalSales);
      return {
        date: row.date,
        totalSales,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      };
    });

    res.json(result);
  } catch (error) {
    logger.error('Daily sales report error', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Item sales (menu items)
reportRoutes.get('/item-sales', async (req, res) => {
  try {
    const dateExpr = 'o.completedAt';
    const { conditions, params } = buildDateFilters(dateExpr, req.query.startDate, req.query.endDate);
    const baseConditions = [`o.status = 'completed'`, `oi.itemType = 'menu_item'`, ...conditions];
    const whereClause = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';

    logger.debug('Item sales query', { whereClause, params });

    const rows = await allAsync(
      `
        SELECT
          oi.menuItemId AS "itemId",
          m.name AS "itemName",
          m.categoryId AS "categoryId",
          c.name AS "categoryName",
          COALESCE(SUM(oi.totalPrice), 0) AS "totalSales",
          COALESCE(SUM(oi.quantity), 0) AS "totalQuantity",
          COUNT(DISTINCT oi.orderId) AS "orderCount",
          CASE
            WHEN COALESCE(SUM(oi.quantity), 0) > 0
            THEN COALESCE(SUM(oi.totalPrice), 0) / COALESCE(SUM(oi.quantity), 0)
            ELSE 0
          END AS "averagePrice"
        FROM orderItems oi
        JOIN orders o ON o.id = oi.orderId
        JOIN menuItems m ON m.id = oi.menuItemId
        LEFT JOIN categories c ON c.id = m.categoryId
        ${whereClause}
        GROUP BY oi.menuItemId, m.name, m.categoryId, c.name
        ORDER BY "totalSales" DESC
      `,
      params
    );

    const result = rows.map((row) => ({
      itemId: row.itemId,
      itemName: row.itemName,
      categoryId: row.categoryId || null,
      categoryName: row.categoryName || null,
      totalSales: toNumber(row.totalSales),
      totalQuantity: toNumber(row.totalQuantity),
      orderCount: toNumber(row.orderCount),
      averagePrice: toNumber(row.averagePrice),
    }));

    res.json(result);
  } catch (error) {
    logger.error('Item sales report error', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Deal sales
reportRoutes.get('/deal-sales', async (req, res) => {
  try {
    const dateExpr = 'o.completedAt';
    const { conditions, params } = buildDateFilters(dateExpr, req.query.startDate, req.query.endDate);
    const baseConditions = [`o.status = 'completed'`, `oi.itemType = 'deal'`, ...conditions];
    const whereClause = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';

    logger.debug('Deal sales query', { whereClause, params });

    const rows = await allAsync(
      `
        SELECT
          oi.dealId AS "dealId",
          d.name AS "dealName",
          COALESCE(SUM(oi.totalPrice), 0) AS "totalSales",
          COALESCE(SUM(oi.quantity), 0) AS "totalQuantity",
          COUNT(DISTINCT oi.orderId) AS "orderCount",
          CASE
            WHEN COALESCE(SUM(oi.quantity), 0) > 0
            THEN COALESCE(SUM(oi.totalPrice), 0) / COALESCE(SUM(oi.quantity), 0)
            ELSE 0
          END AS "averagePrice"
        FROM orderItems oi
        JOIN orders o ON o.id = oi.orderId
        JOIN deals d ON d.id = oi.dealId
        ${whereClause}
        GROUP BY oi.dealId, d.name
        ORDER BY "totalSales" DESC
      `,
      params
    );

    const result = rows.map((row) => ({
      dealId: row.dealId,
      dealName: row.dealName,
      totalSales: toNumber(row.totalSales),
      totalQuantity: toNumber(row.totalQuantity),
      orderCount: toNumber(row.orderCount),
      averagePrice: toNumber(row.averagePrice),
    }));

    res.json(result);
  } catch (error) {
    logger.error('Deal sales report error', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Category sales
reportRoutes.get('/category-sales', async (req, res) => {
  try {
    const dateExpr = 'o.completedAt';
    const { conditions, params } = buildDateFilters(dateExpr, req.query.startDate, req.query.endDate);
    const baseConditions = [`o.status = 'completed'`, `oi.itemType = 'menu_item'`, ...conditions];
    const whereClause = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';

    logger.debug('Category sales query', { whereClause, params });

    const rows = await allAsync(
      `
        SELECT
          m.categoryId AS "categoryId",
          c.name AS "categoryName",
          COALESCE(SUM(oi.totalPrice), 0) AS "totalSales",
          COALESCE(SUM(oi.quantity), 0) AS "totalQuantity",
          COUNT(DISTINCT oi.orderId) AS "orderCount",
          CASE
            WHEN COALESCE(SUM(oi.quantity), 0) > 0
            THEN COALESCE(SUM(oi.totalPrice), 0) / COALESCE(SUM(oi.quantity), 0)
            ELSE 0
          END AS "averagePrice"
        FROM orderItems oi
        JOIN orders o ON o.id = oi.orderId
        JOIN menuItems m ON m.id = oi.menuItemId
        JOIN categories c ON c.id = m.categoryId
        ${whereClause}
        GROUP BY m.categoryId, c.name
        ORDER BY "totalSales" DESC
      `,
      params
    );

    const result = rows.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      totalSales: toNumber(row.totalSales),
      totalQuantity: toNumber(row.totalQuantity),
      orderCount: toNumber(row.orderCount),
      averagePrice: toNumber(row.averagePrice),
    }));

    res.json(result);
  } catch (error) {
    logger.error('Category sales report error', error);
    res.status(500).json({ error: (error as Error).message });
  }
});
