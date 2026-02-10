import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../db/database.js';

export const customerRoutes = express.Router();

const CUSTOMER_WITH_ORDER_STATS_QUERY = `
  SELECT
    c.id,
    c.phone,
    c.name,
    c.address,
    c.notes,
    c.createdAt,
    c.updatedAt,
    (
      SELECT COUNT(*)::integer
      FROM orders o
      WHERE o.customerId = c.id
         OR (o.customerId IS NULL AND o.customerPhone = c.phone)
    ) AS "totalOrders",
    (
      SELECT MAX(o.createdAt)
      FROM orders o
      WHERE o.customerId = c.id
         OR (o.customerId IS NULL AND o.customerPhone = c.phone)
    ) AS "lastOrderAt"
  FROM customers c
`;

// Get all customers
customerRoutes.get('/', async (req, res) => {
  try {
    const customers = await allAsync(
      `${CUSTOMER_WITH_ORDER_STATS_QUERY} ORDER BY c.createdAt DESC`
    );
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get customer by ID
customerRoutes.get('/:id', async (req, res) => {
  try {
    const customer = await getAsync(
      `${CUSTOMER_WITH_ORDER_STATS_QUERY} WHERE c.id = ?`,
      [req.params.id]
    );
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get customer by phone
customerRoutes.get('/phone/:phone', async (req, res) => {
  try {
    const customer = await getAsync(
      `${CUSTOMER_WITH_ORDER_STATS_QUERY} WHERE c.phone = ?`,
      [req.params.phone]
    );
    res.json(customer || null);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create customer
customerRoutes.post('/', async (req, res) => {
  try {
    const { id: providedId, phone, name, address, notes } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use provided ID or generate a new one
    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO customers (id, phone, name, address, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, phone, name, address || null, notes || null, now, now]
    );

    const customer = await getAsync(
      `${CUSTOMER_WITH_ORDER_STATS_QUERY} WHERE c.id = ?`,
      [id]
    );
    res.status(201).json(customer);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Customer with this phone already exists' });
    }
    res.status(500).json({ error: message });
  }
});

// Update customer
customerRoutes.put('/:id', async (req, res) => {
  try {
    const { phone, name, address, notes, lastOrderAt, totalOrders } = req.body;
    const now = new Date().toISOString();

    const customer = await getAsync('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const normalizedTotalOrders = totalOrders !== undefined
      ? Math.max(0, Number(totalOrders) || 0)
      : Math.max(0, Number(customer.totalOrders) || 0);

    await runAsync(
      `UPDATE customers
       SET phone = ?, name = ?, address = ?, notes = ?, lastOrderAt = ?, totalOrders = ?, updatedAt = ?
       WHERE id = ?`,
      [
        phone || customer.phone,
        name || customer.name,
        address !== undefined ? address : customer.address,
        notes !== undefined ? notes : customer.notes,
        lastOrderAt !== undefined ? lastOrderAt : customer.lastOrderAt,
        normalizedTotalOrders,
        now,
        req.params.id
      ]
    );

    const updated = await getAsync(
      `${CUSTOMER_WITH_ORDER_STATS_QUERY} WHERE c.id = ?`,
      [req.params.id]
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete customer
customerRoutes.delete('/:id', async (req, res) => {
  try {
    const customer = await getAsync('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await runAsync('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
