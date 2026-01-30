import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../db/database.js';

export const roleRoutes = express.Router();

// Get all roles
roleRoutes.get('/', async (req, res) => {
  try {
    const roles = await allAsync('SELECT id, name, permissions, createdAt FROM roles ORDER BY createdAt');
    const rolesWithParsed = roles.map(role => ({
      ...role,
      permissions: JSON.parse(role.permissions)
    }));
    res.json(rolesWithParsed);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get role by ID
roleRoutes.get('/:id', async (req, res) => {
  try {
    const role = await getAsync('SELECT id, name, permissions, createdAt FROM roles WHERE id = ?', [req.params.id]);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ ...role, permissions: JSON.parse(role.permissions) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create role
roleRoutes.post('/', async (req, res) => {
  try {
    const { name, permissions } = req.body;

    if (!name || !permissions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4();

    await runAsync(
      'INSERT INTO roles (id, name, permissions) VALUES (?, ?, ?)',
      [id, name, JSON.stringify(permissions)]
    );

    const role = await getAsync('SELECT id, name, permissions, createdAt FROM roles WHERE id = ?', [id]);
    res.status(201).json({ ...role, permissions: JSON.parse(role.permissions) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update role
roleRoutes.put('/:id', async (req, res) => {
  try {
    const { name, permissions } = req.body;

    const role = await getAsync('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    await runAsync(
      'UPDATE roles SET name = ?, permissions = ? WHERE id = ?',
      [name || role.name, JSON.stringify(permissions || JSON.parse(role.permissions)), req.params.id]
    );

    const updated = await getAsync('SELECT id, name, permissions, createdAt FROM roles WHERE id = ?', [req.params.id]);
    res.json({ ...updated, permissions: JSON.parse(updated.permissions) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete role
roleRoutes.delete('/:id', async (req, res) => {
  try {
    const role = await getAsync('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    await runAsync('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
