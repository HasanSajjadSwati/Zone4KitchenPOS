import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';

function parseAvailableOptionIds(raw: any): any[] {
  if (!raw && raw !== 0) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString());
    } catch {
      return [];
    }
  }

  if (typeof raw === 'object') {
    return raw;
  }

  return [];
}

export const menuItemRoutes = express.Router();

// Get all menu items
menuItemRoutes.get('/', async (req, res) => {
  try {
    const items = await allAsync(
      'SELECT * FROM menuItems ORDER BY createdAt DESC'
    );
    res.json(convertBooleansArray(items));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get menu item by ID
menuItemRoutes.get('/:id', async (req, res) => {
  try {
    const item = await getAsync('SELECT * FROM menuItems WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Get variants
    const variants = await allAsync(
      `SELECT mv.*, v.name as variantName, v.type as variantType
       FROM menuItemVariants mv
       JOIN variants v ON mv.variantId = v.id
       WHERE mv.menuItemId = ?`,
      [req.params.id]
    );

    res.json(convertBooleans({
      ...item,
      variants: variants.map(v => convertBooleans({
        ...v,
        availableOptionIds: parseAvailableOptionIds(v.availableOptionIds)
      }))
    }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create menu item
menuItemRoutes.post('/', async (req, res) => {
  try {
    const { id: providedId, name, categoryId, price, description, isActive, isDealOnly, hasVariants } = req.body;

    if (!name || !categoryId || price === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use provided ID or generate a new one
    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO menuItems (id, name, categoryId, price, description, isActive, isDealOnly, hasVariants, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, categoryId, price, description || null, isActive !== false ? 1 : 0, isDealOnly ? 1 : 0, hasVariants ? 1 : 0, now, now]
    );

    const item = await getAsync('SELECT * FROM menuItems WHERE id = ?', [id]);
    res.status(201).json(convertBooleans(item));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update menu item
menuItemRoutes.put('/:id', async (req, res) => {
  try {
    const { name, categoryId, price, description, isActive, isDealOnly, hasVariants } = req.body;
    const now = new Date().toISOString();

    const item = await getAsync('SELECT * FROM menuItems WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    await runAsync(
      `UPDATE menuItems SET name = ?, categoryId = ?, price = ?, description = ?, isActive = ?, isDealOnly = ?, hasVariants = ?, updatedAt = ? WHERE id = ?`,
      [
        name || item.name,
        categoryId || item.categoryId,
        price !== undefined ? price : item.price,
        description !== undefined ? description : item.description,
        isActive !== undefined ? (isActive ? 1 : 0) : item.isActive,
        isDealOnly !== undefined ? (isDealOnly ? 1 : 0) : item.isDealOnly,
        hasVariants !== undefined ? (hasVariants ? 1 : 0) : item.hasVariants,
        now,
        req.params.id
      ]
    );

    const updated = await getAsync('SELECT * FROM menuItems WHERE id = ?', [req.params.id]);
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete menu item
menuItemRoutes.delete('/:id', async (req, res) => {
  try {
    const item = await getAsync('SELECT * FROM menuItems WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const orderUsage = await getAsync(
      'SELECT COUNT(*) as count FROM orderItems WHERE menuItemId = ?',
      [req.params.id]
    );
    if (orderUsage && orderUsage.count > 0) {
      return res.status(409).json({
        error: 'Menu item is referenced by existing order items. Remove those order items (or archive the item) before deleting.',
      });
    }

    const dealUsage = await getAsync(
      'SELECT COUNT(*) as count FROM dealItems WHERE menuItemId = ?',
      [req.params.id]
    );
    if (dealUsage && dealUsage.count > 0) {
      return res.status(409).json({
        error: 'Menu item is part of one or more deals. Remove it from those deals before deleting.',
      });
    }

    await runAsync('DELETE FROM menuItemVariants WHERE menuItemId = ?', [req.params.id]);
    await runAsync('DELETE FROM menuItems WHERE id = ?', [req.params.id]);
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Menu Item Variants Routes

// Get all variants for a menu item
menuItemRoutes.get('/:id/variants', async (req, res) => {
  try {
    const variants = await allAsync(
      `SELECT mv.*, v.name as variantName, v.type as variantType
       FROM menuItemVariants mv
       JOIN variants v ON mv.variantId = v.id
       WHERE mv.menuItemId = ?
       ORDER BY v.sortOrder`,
      [req.params.id]
    );

    res.json(variants.map(v => convertBooleans({
      ...v,
      availableOptionIds: parseAvailableOptionIds(v.availableOptionIds)
    })));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add variant to menu item
menuItemRoutes.post('/:id/variants', async (req, res) => {
  try {
    const { variantId, isRequired, selectionMode, availableOptionIds } = req.body;
    const { id: menuItemId } = req.params;

    if (!variantId) {
      return res.status(400).json({ error: 'variantId is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO menuItemVariants (id, menuItemId, variantId, isRequired, selectionMode, availableOptionIds, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, menuItemId, variantId, isRequired ? 1 : 0, selectionMode || 'single', JSON.stringify(availableOptionIds || []), now]
    );

    const variant = await getAsync(
      `SELECT mv.*, v.name as variantName, v.type as variantType
       FROM menuItemVariants mv
       JOIN variants v ON mv.variantId = v.id
       WHERE mv.id = ?`,
      [id]
    );

    res.status(201).json(convertBooleans({
      ...variant,
      availableOptionIds: parseAvailableOptionIds(variant.availableOptionIds)
    }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update menu item variant
menuItemRoutes.put('/:id/variants/:variantId', async (req, res) => {
  try {
    const { isRequired, selectionMode, availableOptionIds } = req.body;

    const variant = await getAsync(
      'SELECT * FROM menuItemVariants WHERE menuItemId = ? AND variantId = ?',
      [req.params.id, req.params.variantId]
    );
    if (!variant) {
      return res.status(404).json({ error: 'Menu item variant not found' });
    }

    await runAsync(
      `UPDATE menuItemVariants SET isRequired = ?, selectionMode = ?, availableOptionIds = ? WHERE menuItemId = ? AND variantId = ?`,
      [
        isRequired !== undefined ? (isRequired ? 1 : 0) : variant.isRequired,
        selectionMode || variant.selectionMode,
        availableOptionIds ? JSON.stringify(availableOptionIds) : variant.availableOptionIds,
        req.params.id,
        req.params.variantId
      ]
    );

    const updated = await getAsync(
      `SELECT mv.*, v.name as variantName, v.type as variantType
       FROM menuItemVariants mv
       JOIN variants v ON mv.variantId = v.id
       WHERE mv.menuItemId = ? AND mv.variantId = ?`,
      [req.params.id, req.params.variantId]
    );

    res.json(convertBooleans({
      ...updated,
      availableOptionIds: parseAvailableOptionIds(updated.availableOptionIds)
    }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete menu item variant
menuItemRoutes.delete('/:id/variants/:variantId', async (req, res) => {
  try {
    const variant = await getAsync(
      'SELECT * FROM menuItemVariants WHERE menuItemId = ? AND variantId = ?',
      [req.params.id, req.params.variantId]
    );
    if (!variant) {
      return res.status(404).json({ error: 'Menu item variant not found' });
    }

    await runAsync('DELETE FROM menuItemVariants WHERE menuItemId = ? AND variantId = ?', [req.params.id, req.params.variantId]);
    res.json({ message: 'Menu item variant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
