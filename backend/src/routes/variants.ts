import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';

export const variantRoutes = express.Router();

// Get all variants
variantRoutes.get('/', async (req, res) => {
  try {
    const variants = await allAsync('SELECT * FROM variants ORDER BY sortOrder, createdAt');
    res.json(convertBooleansArray(variants));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get variant with options
variantRoutes.get('/:id', async (req, res) => {
  try {
    const variant = await getAsync('SELECT * FROM variants WHERE id = ?', [req.params.id]);
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    const options = await allAsync(
      'SELECT * FROM variantOptions WHERE variantId = ? ORDER BY sortOrder',
      [req.params.id]
    );

    res.json(convertBooleans({ ...variant, options: convertBooleansArray(options) }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create variant
variantRoutes.post('/', async (req, res) => {
  try {
    const { id: providedId, name, type, sortOrder, isActive } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use provided ID or generate a new one
    const id = providedId || uuidv4();

    await runAsync(
      'INSERT INTO variants (id, name, type, sortOrder, isActive) VALUES (?, ?, ?, ?, ?)',
      [id, name, type, sortOrder || 0, isActive !== false ? 1 : 0]
    );

    const variant = await getAsync('SELECT * FROM variants WHERE id = ?', [id]);
    res.status(201).json(convertBooleans(variant));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update variant
variantRoutes.put('/:id', async (req, res) => {
  try {
    const { name, type, sortOrder, isActive } = req.body;

    const variant = await getAsync('SELECT * FROM variants WHERE id = ?', [req.params.id]);
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    await runAsync(
      'UPDATE variants SET name = ?, type = ?, sortOrder = ?, isActive = ? WHERE id = ?',
      [
        name || variant.name,
        type || variant.type,
        sortOrder !== undefined ? sortOrder : variant.sortOrder,
        isActive !== undefined ? (isActive ? 1 : 0) : variant.isActive,
        req.params.id
      ]
    );

    const updated = await getAsync('SELECT * FROM variants WHERE id = ?', [req.params.id]);
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete variant
variantRoutes.delete('/:id', async (req, res) => {
  try {
    const variant = await getAsync('SELECT * FROM variants WHERE id = ?', [req.params.id]);
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    await runAsync('DELETE FROM variants WHERE id = ?', [req.params.id]);
    res.json({ message: 'Variant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Variant Options Routes

// Get all options for a variant
variantRoutes.get('/:variantId/options', async (req, res) => {
  try {
    const options = await allAsync(
      'SELECT * FROM variantOptions WHERE variantId = ? ORDER BY sortOrder',
      [req.params.variantId]
    );
    res.json(convertBooleansArray(options));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create variant option
variantRoutes.post('/:variantId/options', async (req, res) => {
  try {
    const { name, priceModifier, sortOrder, isActive } = req.body;
    const { variantId } = req.params;

    if (!name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4();

    await runAsync(
      `INSERT INTO variantOptions (id, variantId, name, priceModifier, sortOrder, isActive)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, variantId, name, priceModifier || 0, sortOrder || 0, isActive !== false ? 1 : 0]
    );

    const option = await getAsync('SELECT * FROM variantOptions WHERE id = ?', [id]);
    res.status(201).json(convertBooleans(option));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update variant option
variantRoutes.put('/:variantId/options/:optionId', async (req, res) => {
  try {
    const { name, priceModifier, sortOrder, isActive } = req.body;

    const option = await getAsync('SELECT * FROM variantOptions WHERE id = ?', [req.params.optionId]);
    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    await runAsync(
      'UPDATE variantOptions SET name = ?, priceModifier = ?, sortOrder = ?, isActive = ? WHERE id = ?',
      [
        name || option.name,
        priceModifier !== undefined ? priceModifier : option.priceModifier,
        sortOrder !== undefined ? sortOrder : option.sortOrder,
        isActive !== undefined ? (isActive ? 1 : 0) : option.isActive,
        req.params.optionId
      ]
    );

    const updated = await getAsync('SELECT * FROM variantOptions WHERE id = ?', [req.params.optionId]);
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete variant option
variantRoutes.delete('/:variantId/options/:optionId', async (req, res) => {
  try {
    const option = await getAsync('SELECT * FROM variantOptions WHERE id = ?', [req.params.optionId]);
    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    await runAsync('DELETE FROM variantOptions WHERE id = ?', [req.params.optionId]);
    res.json({ message: 'Option deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
