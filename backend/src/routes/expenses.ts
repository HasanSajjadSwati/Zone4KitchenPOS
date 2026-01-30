import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';

export const expenseRoutes = express.Router();

// Get all expenses
expenseRoutes.get('/', async (req, res) => {
  try {
    const { startDate, endDate, category, registerSessionId } = req.query;

    let query = 'SELECT * FROM expenses';
    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      conditions.push('date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('date <= ?');
      params.push(endDate);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (registerSessionId) {
      conditions.push('registerSessionId = ?');
      params.push(registerSessionId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC, createdAt DESC';

    const expenses = await allAsync(query, params);
    res.json(convertBooleansArray(expenses));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get expense by ID
expenseRoutes.get('/:id', async (req, res) => {
  try {
    const expense = await getAsync('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(convertBooleans(expense));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create expense
expenseRoutes.post('/', async (req, res) => {
  try {
    const {
      id: providedId,
      date,
      category,
      amount,
      description,
      receiptNumber,
      paidTo,
      paymentMethod,
      registerSessionId,
      createdBy
    } = req.body;

    if (!date || !category || amount === undefined || !paymentMethod || !createdBy) {
      return res.status(400).json({ error: 'Missing required fields (date, category, amount, paymentMethod, createdBy)' });
    }

    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO expenses (id, date, category, amount, description, receiptNumber, paidTo, paymentMethod, registerSessionId, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, date, category, amount, description || null, receiptNumber || null, paidTo || null, paymentMethod, registerSessionId || null, createdBy, now, now]
    );

    const expense = await getAsync('SELECT * FROM expenses WHERE id = ?', [id]);
    res.status(201).json(convertBooleans(expense));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update expense
expenseRoutes.put('/:id', async (req, res) => {
  try {
    const { date, category, amount, description, receiptNumber, paidTo, paymentMethod } = req.body;
    const now = new Date().toISOString();

    const expense = await getAsync('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await runAsync(
      `UPDATE expenses SET date = ?, category = ?, amount = ?, description = ?, receiptNumber = ?, paidTo = ?, paymentMethod = ?, updatedAt = ? WHERE id = ?`,
      [
        date || expense.date,
        category || expense.category,
        amount !== undefined ? amount : expense.amount,
        description !== undefined ? description : expense.description,
        receiptNumber !== undefined ? receiptNumber : expense.receiptNumber,
        paidTo !== undefined ? paidTo : expense.paidTo,
        paymentMethod || expense.paymentMethod,
        now,
        req.params.id
      ]
    );

    const updated = await getAsync('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete expense
expenseRoutes.delete('/:id', async (req, res) => {
  try {
    const expense = await getAsync('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await runAsync('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get expense summary by category
expenseRoutes.get('/summary/by-category', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM expenses
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      conditions.push('date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('date <= ?');
      params.push(endDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY category ORDER BY total DESC';

    const summary = await allAsync(query, params);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
