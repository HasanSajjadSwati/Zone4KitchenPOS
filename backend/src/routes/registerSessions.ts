import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../db/database.js';

async function userExists(userId: string): Promise<boolean> {
  if (!userId) return false;
  const row = await getAsync('SELECT id FROM users WHERE id = ?', [userId]);
  return Boolean(row);
}

export const registerSessionRoutes = express.Router();

// Get all register sessions
registerSessionRoutes.get('/', async (req, res) => {
  try {
    const sessions = await allAsync('SELECT * FROM registerSessions ORDER BY openedAt DESC');
    res.json(sessions);
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

    const now = new Date().toISOString();
    const cashDifference = expectedCash && closingCash ? closingCash - expectedCash : null;

    await runAsync(
      `UPDATE registerSessions SET closedBy = ?, closedAt = ?, closingCash = ?, expectedCash = ?,
       cashDifference = ?, notes = ?, status = ? WHERE id = ?`,
      [closedBy || session.closedBy, now, closingCash || session.closingCash,
       expectedCash || session.expectedCash, cashDifference, notes || session.notes, 'closed', req.params.id]
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

    const now = new Date().toISOString();
    const cashDifference = closingCash - (expectedCash || 0);

    await runAsync(
      `UPDATE registerSessions SET closedBy = ?, closedAt = ?, closingCash = ?, expectedCash = ?,
       cashDifference = ?, notes = ?, status = ? WHERE id = ?`,
      [closedBy, now, closingCash, expectedCash, cashDifference, notes || null, 'closed', req.params.id]
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
