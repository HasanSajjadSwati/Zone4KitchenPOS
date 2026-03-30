import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../db/database.js';

async function userExists(userId: string): Promise<boolean> {
  if (!userId) return false;
  const row = await getAsync('SELECT id FROM users WHERE id = ?', [userId]);
  return Boolean(row);
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

async function getSessionFinancials(sessionId: string): Promise<{
  totalSales: number;
  totalOrders: number;
  cashSales: number;
}> {
  const row = await getAsync(
    `
      WITH session_orders AS (
        -- FIX: Include both active and archived orders for accurate register totals
        SELECT o.id, o.total
        FROM (
          SELECT id, total, registerSessionId, status FROM orders
          UNION ALL
          SELECT id, total, registerSessionId, status FROM pastOrders
        ) o
        WHERE o.registerSessionId = ? AND o.status = 'completed'
      ),
      ranked_payments AS (
        SELECT
          p.orderId AS "orderId",
          p.method AS "method",
          p.amount AS "amount",
          so.total AS "orderTotal",
          COALESCE(
            SUM(p.amount) OVER (
              PARTITION BY p.orderId
              ORDER BY p.paidAt, p.id
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
          ) AS "paidBefore"
        FROM (
          SELECT orderId, method, amount, paidAt, id FROM payments
          UNION ALL
          SELECT orderId, method, amount, paidAt, id FROM pastPayments
        ) p
        JOIN session_orders so ON so.id = p.orderId
      ),
      applied_payments AS (
        SELECT
          "method",
          GREATEST(LEAST("amount", "orderTotal" - "paidBefore"), 0) AS "appliedAmount"
        FROM ranked_payments
      )
      SELECT
        COALESCE((SELECT SUM(total) FROM session_orders), 0) AS "totalSales",
        COALESCE((SELECT COUNT(*) FROM session_orders), 0) AS "totalOrders",
        COALESCE((SELECT SUM("appliedAmount") FROM applied_payments WHERE "method" = 'cash'), 0) AS "cashSales"
    `,
    [sessionId]
  );

  return {
    totalSales: toNumber(row?.totalSales),
    totalOrders: toNumber(row?.totalOrders),
    cashSales: toNumber(row?.cashSales),
  };
}

export const registerSessionRoutes = express.Router();

// Get all register sessions (paginated)
registerSessionRoutes.get('/', async (req, res) => {
  try {
    const { limit, offset, status, startDate, endDate } = req.query;

    let query = 'SELECT * FROM registerSessions WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM registerSessions WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (status) {
      query += ' AND status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (startDate) {
      query += ' AND openedAt >= ?';
      countQuery += ' AND openedAt >= ?';
      params.push(startDate);
      countParams.push(startDate);
    }

    if (endDate) {
      query += ' AND openedAt <= ?';
      countQuery += ' AND openedAt <= ?';
      params.push(endDate);
      countParams.push(endDate);
    }

    // Get total count for pagination
    const countResult = await getAsync(countQuery, countParams);
    const total = countResult?.total || 0;

    query += ' ORDER BY openedAt DESC';

    // Apply pagination if limit is provided
    if (limit) {
      const limitNum = parseInt(String(limit), 10);
      const offsetNum = offset ? parseInt(String(offset), 10) : 0;
      query += ` LIMIT ${limitNum} OFFSET ${offsetNum}`;
    }

    const sessions = await allAsync(query, params);
    res.json({ sessions, total });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get register session by ID
registerSessionRoutes.get('/:id', async (req, res) => {
  try {
    const session = await getAsync('SELECT * FROM registerSessions WHERE id = ?', [req.params.id]);
    if (!session) {
      return res.status(404).json({ error: 'Register session not found' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create register session
registerSessionRoutes.post('/', async (req, res) => {
  try {
    const { id: providedId, openedBy, openingCash } = req.body;

    if (!openedBy || openingCash === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!(await userExists(openedBy))) {
      return res.status(400).json({ error: 'Opening user not found' });
    }

    // Use provided ID or generate a new one
    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO registerSessions (id, openedBy, openedAt, openingCash, totalSales, totalOrders, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, openedBy, now, openingCash, 0, 0, 'open']
    );

    const session = await getAsync('SELECT * FROM registerSessions WHERE id = ?', [id]);
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update register session
registerSessionRoutes.put('/:id', async (req, res) => {
  try {
    const { closedBy, closingCash, expectedCash, notes } = req.body;

    const session = await getAsync('SELECT * FROM registerSessions WHERE id = ?', [req.params.id]);
    if (!session) {
      return res.status(404).json({ error: 'Register session not found' });
    }

    if (closedBy && !(await userExists(closedBy))) {
      return res.status(400).json({ error: 'Closing user not found' });
    }

    const financials = await getSessionFinancials(req.params.id);
    const now = new Date().toISOString();
    const computedExpectedCash = toNumber(session.openingCash) + financials.cashSales;
    const resolvedExpectedCash = expectedCash ?? computedExpectedCash;
    const resolvedClosingCash = closingCash ?? session.closingCash;
    const cashDifference =
      resolvedClosingCash === null || resolvedClosingCash === undefined
        ? null
        : toNumber(resolvedClosingCash) - toNumber(resolvedExpectedCash);

    await runAsync(
      `UPDATE registerSessions SET closedBy = ?, closedAt = ?, closingCash = ?, expectedCash = ?,
       cashDifference = ?, notes = ?, status = ?, totalSales = ?, totalOrders = ? WHERE id = ?`,
      [
        closedBy ?? session.closedBy,
        now,
        resolvedClosingCash,
        resolvedExpectedCash,
        cashDifference,
        notes ?? session.notes,
        'closed',
        financials.totalSales,
        financials.totalOrders,
        req.params.id,
      ]
    );

    const updated = await getAsync('SELECT * FROM registerSessions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Close register session
registerSessionRoutes.post('/:id/close', async (req, res) => {
  try {
    const { closedBy, closingCash, expectedCash, notes } = req.body;

    const session = await getAsync('SELECT * FROM registerSessions WHERE id = ?', [req.params.id]);
    if (!session) {
      return res.status(404).json({ error: 'Register session not found' });
    }

    if (!closedBy) {
      return res.status(400).json({ error: 'closedBy is required to close the session' });
    }

    if (!(await userExists(closedBy))) {
      return res.status(400).json({ error: 'Closing user not found' });
    }

    if (session.status === 'closed') {
      return res.status(400).json({ error: 'Session is already closed' });
    }

    if (closingCash === undefined || closingCash === null || Number.isNaN(Number(closingCash))) {
      return res.status(400).json({ error: 'closingCash is required to close the session' });
    }

    const financials = await getSessionFinancials(req.params.id);
    const now = new Date().toISOString();
    const normalizedClosingCash = toNumber(closingCash);
    const computedExpectedCash = toNumber(session.openingCash) + financials.cashSales;
    const resolvedExpectedCash = expectedCash ?? computedExpectedCash;
    const cashDifference = normalizedClosingCash - toNumber(resolvedExpectedCash);

    await runAsync(
      `UPDATE registerSessions SET closedBy = ?, closedAt = ?, closingCash = ?, expectedCash = ?,
       cashDifference = ?, notes = ?, status = ?, totalSales = ?, totalOrders = ? WHERE id = ?`,
      [
        closedBy,
        now,
        normalizedClosingCash,
        resolvedExpectedCash,
        cashDifference,
        notes ?? null,
        'closed',
        financials.totalSales,
        financials.totalOrders,
        req.params.id,
      ]
    );

    const updated = await getAsync('SELECT * FROM registerSessions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get active (open) session
registerSessionRoutes.get('/status/active', async (req, res) => {
  try {
    const session = await getAsync('SELECT * FROM registerSessions WHERE status = ? ORDER BY openedAt DESC LIMIT 1', ['open']);
    res.json(session || null);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
