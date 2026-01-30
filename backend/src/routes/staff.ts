import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';

export const staffRoutes = express.Router();

// ==================== WAITERS ====================

// Get all waiters
staffRoutes.get('/waiters', async (req, res) => {
  try {
    const waiters = await allAsync('SELECT * FROM waiters ORDER BY name');
    res.json(convertBooleansArray(waiters));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get waiter by ID
staffRoutes.get('/waiters/:id', async (req, res) => {
  try {
    const waiter = await getAsync('SELECT * FROM waiters WHERE id = ?', [req.params.id]);
    if (!waiter) {
      return res.status(404).json({ error: 'Waiter not found' });
    }
    res.json(convertBooleans(waiter));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create waiter
staffRoutes.post('/waiters', async (req, res) => {
  try {
    const { id: providedId, name, phone, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO waiters (id, name, phone, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, phone || null, isActive !== false ? 1 : 0, now, now]
    );

    const waiter = await getAsync('SELECT * FROM waiters WHERE id = ?', [id]);
    res.status(201).json(convertBooleans(waiter));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update waiter
staffRoutes.put('/waiters/:id', async (req, res) => {
  try {
    const { name, phone, isActive } = req.body;
    const now = new Date().toISOString();

    const waiter = await getAsync('SELECT * FROM waiters WHERE id = ?', [req.params.id]);
    if (!waiter) {
      return res.status(404).json({ error: 'Waiter not found' });
    }

    await runAsync(
      `UPDATE waiters SET name = ?, phone = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
      [
        name || waiter.name,
        phone !== undefined ? phone : waiter.phone,
        isActive !== undefined ? (isActive ? 1 : 0) : waiter.isActive,
        now,
        req.params.id
      ]
    );

    const updated = await getAsync('SELECT * FROM waiters WHERE id = ?', [req.params.id]);
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete waiter
staffRoutes.delete('/waiters/:id', async (req, res) => {
  try {
    const waiter = await getAsync('SELECT * FROM waiters WHERE id = ?', [req.params.id]);
    if (!waiter) {
      return res.status(404).json({ error: 'Waiter not found' });
    }

    await runAsync('DELETE FROM waiters WHERE id = ?', [req.params.id]);
    res.json({ message: 'Waiter deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== RIDERS ====================

// Get all riders
staffRoutes.get('/riders', async (req, res) => {
  try {
    const riders = await allAsync('SELECT * FROM riders ORDER BY name');
    res.json(convertBooleansArray(riders));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get rider by ID
staffRoutes.get('/riders/:id', async (req, res) => {
  try {
    const rider = await getAsync('SELECT * FROM riders WHERE id = ?', [req.params.id]);
    if (!rider) {
      return res.status(404).json({ error: 'Rider not found' });
    }
    res.json(convertBooleans(rider));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create rider
staffRoutes.post('/riders', async (req, res) => {
  try {
    const { id: providedId, name, phone, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO riders (id, name, phone, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, phone || null, isActive !== false ? 1 : 0, now, now]
    );

    const rider = await getAsync('SELECT * FROM riders WHERE id = ?', [id]);
    res.status(201).json(convertBooleans(rider));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update rider
staffRoutes.put('/riders/:id', async (req, res) => {
  try {
    const { name, phone, isActive } = req.body;
    const now = new Date().toISOString();

    const rider = await getAsync('SELECT * FROM riders WHERE id = ?', [req.params.id]);
    if (!rider) {
      return res.status(404).json({ error: 'Rider not found' });
    }

    await runAsync(
      `UPDATE riders SET name = ?, phone = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
      [
        name || rider.name,
        phone !== undefined ? phone : rider.phone,
        isActive !== undefined ? (isActive ? 1 : 0) : rider.isActive,
        now,
        req.params.id
      ]
    );

    const updated = await getAsync('SELECT * FROM riders WHERE id = ?', [req.params.id]);
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete rider
staffRoutes.delete('/riders/:id', async (req, res) => {
  try {
    const rider = await getAsync('SELECT * FROM riders WHERE id = ?', [req.params.id]);
    if (!rider) {
      return res.status(404).json({ error: 'Rider not found' });
    }

    await runAsync('DELETE FROM riders WHERE id = ?', [req.params.id]);
    res.json({ message: 'Rider deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== DINING TABLES ====================

// Get all dining tables
staffRoutes.get('/tables', async (req, res) => {
  try {
    const tables = await allAsync('SELECT * FROM diningTables ORDER BY tableNumber');
    res.json(convertBooleansArray(tables));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get dining table by ID
staffRoutes.get('/tables/:id', async (req, res) => {
  try {
    const table = await getAsync('SELECT * FROM diningTables WHERE id = ?', [req.params.id]);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    res.json(convertBooleans(table));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create dining table
staffRoutes.post('/tables', async (req, res) => {
  try {
    const { id: providedId, tableNumber, capacity, isActive } = req.body;

    if (!tableNumber || capacity === undefined) {
      return res.status(400).json({ error: 'Table number and capacity are required' });
    }

    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO diningTables (id, tableNumber, capacity, isActive, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [id, tableNumber, capacity, isActive !== false ? 1 : 0, now]
    );

    const table = await getAsync('SELECT * FROM diningTables WHERE id = ?', [id]);
    res.status(201).json(convertBooleans(table));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Table number already exists' });
    }
    res.status(500).json({ error: message });
  }
});

// Update dining table
staffRoutes.put('/tables/:id', async (req, res) => {
  try {
    const { tableNumber, capacity, isActive } = req.body;

    const table = await getAsync('SELECT * FROM diningTables WHERE id = ?', [req.params.id]);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    await runAsync(
      `UPDATE diningTables SET tableNumber = ?, capacity = ?, isActive = ? WHERE id = ?`,
      [
        tableNumber || table.tableNumber,
        capacity !== undefined ? capacity : table.capacity,
        isActive !== undefined ? (isActive ? 1 : 0) : table.isActive,
        req.params.id
      ]
    );

    const updated = await getAsync('SELECT * FROM diningTables WHERE id = ?', [req.params.id]);
    res.json(convertBooleans(updated));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Table number already exists' });
    }
    res.status(500).json({ error: message });
  }
});

// Delete dining table
staffRoutes.delete('/tables/:id', async (req, res) => {
  try {
    const table = await getAsync('SELECT * FROM diningTables WHERE id = ?', [req.params.id]);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    await runAsync('DELETE FROM diningTables WHERE id = ?', [req.params.id]);
    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
