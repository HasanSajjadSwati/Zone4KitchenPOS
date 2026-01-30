import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../db/database.js';

export const paymentRoutes = express.Router();

// Get all payments
paymentRoutes.get('/', async (req, res) => {
  try {
    const payments = await allAsync('SELECT * FROM payments ORDER BY paidAt DESC');
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get payment by ID
paymentRoutes.get('/:id', async (req, res) => {
  try {
    const payment = await getAsync('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get payments for order
paymentRoutes.get('/order/:orderId', async (req, res) => {
  try {
    const payments = await allAsync(
      'SELECT * FROM payments WHERE orderId = ? ORDER BY paidAt DESC',
      [req.params.orderId]
    );
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create payment
paymentRoutes.post('/', async (req, res) => {
  try {
    const { id: providedId, orderId, amount, method, reference, receivedBy, notes } = req.body;

    if (!orderId || !amount || !method || !receivedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use provided ID or generate a new one
    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO payments (id, orderId, amount, method, reference, paidAt, receivedBy, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orderId, amount, method, reference || null, now, receivedBy, notes || null, now]
    );

    const payment = await getAsync('SELECT * FROM payments WHERE id = ?', [id]);
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update payment
paymentRoutes.put('/:id', async (req, res) => {
  try {
    const { amount, method, reference, notes } = req.body;

    const payment = await getAsync('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    await runAsync(
      `UPDATE payments SET amount = ?, method = ?, reference = ?, notes = ? WHERE id = ?`,
      [amount || payment.amount, method || payment.method, reference !== undefined ? reference : payment.reference,
       notes !== undefined ? notes : payment.notes, req.params.id]
    );

    const updated = await getAsync('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete payment
paymentRoutes.delete('/:id', async (req, res) => {
  try {
    const payment = await getAsync('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    await runAsync('DELETE FROM payments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
