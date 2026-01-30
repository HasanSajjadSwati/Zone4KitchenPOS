import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../db/database.js';

export const categoryRoutes = express.Router();

// Get all categories
categoryRoutes.get('/', async (req, res) => {
  try {
    const categories = await allAsync(
      'SELECT * FROM categories ORDER BY sortOrder, createdAt'
    );
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get category by ID
categoryRoutes.get('/:id', async (req, res) => {
  try {
    const category = await getAsync('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create category
categoryRoutes.post('/', async (req, res) => {
  try {
    const { id: providedId, name, type, parentId, sortOrder, isActive } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use provided ID or generate a new one
    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO categories (id, name, type, parentId, sortOrder, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, type, parentId || null, sortOrder || 0, isActive !== false ? 1 : 0, now, now]
    );

    const category = await getAsync('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update category
categoryRoutes.put('/:id', async (req, res) => {
  try {
    const { name, type, parentId, sortOrder, isActive } = req.body;
    const now = new Date().toISOString();

    const category = await getAsync('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await runAsync(
      `UPDATE categories SET name = ?, type = ?, parentId = ?, sortOrder = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
      [
        name || category.name,
        type || category.type,
        parentId !== undefined ? parentId : category.parentId,
        sortOrder !== undefined ? sortOrder : category.sortOrder,
        isActive !== undefined ? (isActive ? 1 : 0) : category.isActive,
        now,
        req.params.id
      ]
    );

    const updated = await getAsync('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete category
categoryRoutes.delete('/:id', async (req, res) => {
  try {
    const category = await getAsync('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const blockers: string[] = [];
    const dependencies = [
      { table: 'categories', column: 'parentId', label: 'child categories' },
      { table: 'menuItems', column: 'categoryId', label: 'menu items' },
      { table: 'deals', column: 'categoryId', label: 'deals' }
    ];

    for (const dependency of dependencies) {
      const countRow = await getAsync(
        `SELECT COUNT(*) AS count FROM ${dependency.table} WHERE ${dependency.column} = ?`,
        [req.params.id]
      );
      const count = Number((countRow?.count) ?? 0);
      if (count > 0) {
        blockers.push(`${count} ${dependency.label}`);
      }
    }

    if (blockers.length) {
      return res.status(409).json({
        error: 'Category has dependent records',
        details: `Remove or reassign ${blockers.join(', ')} before deleting this category.`
      });
    }

    await runAsync('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
