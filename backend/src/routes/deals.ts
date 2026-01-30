import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';

export const dealRoutes = express.Router();

// Get all deals
dealRoutes.get('/', async (req, res) => {
  try {
    const deals = await allAsync('SELECT * FROM deals ORDER BY createdAt DESC');
    res.json(convertBooleansArray(deals));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get deal with items
dealRoutes.get('/:id', async (req, res) => {
  try {
    const deal = await getAsync('SELECT * FROM deals WHERE id = ?', [req.params.id]);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const items = await allAsync(
      'SELECT * FROM dealItems WHERE dealId = ? ORDER BY sortOrder',
      [req.params.id]
    );

    const variants = await allAsync(
      `SELECT dv.*, v.name as variantName
       FROM dealVariants dv
       JOIN variants v ON dv.variantId = v.id
       WHERE dv.dealId = ?`,
      [req.params.id]
    );

    res.json(convertBooleans({
      ...deal,
      items: convertBooleansArray(items),
      variants: variants.map(v => convertBooleans({
        ...v,
        availableOptionIds: v.availableOptionIds ? JSON.parse(v.availableOptionIds) : []
      }))
    }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create deal
dealRoutes.post('/', async (req, res) => {
  try {
    const { id: providedId, name, description, price, categoryId, isActive, hasVariants } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use provided ID or generate a new one
    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO deals (id, name, description, price, categoryId, isActive, hasVariants, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, description || null, price, categoryId || null, isActive !== false ? 1 : 0, hasVariants ? 1 : 0, now, now]
    );

    const deal = await getAsync('SELECT * FROM deals WHERE id = ?', [id]);
    res.status(201).json(convertBooleans(deal));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update deal
dealRoutes.put('/:id', async (req, res) => {
  try {
    const { name, description, price, categoryId, isActive, hasVariants } = req.body;
    const now = new Date().toISOString();

    const deal = await getAsync('SELECT * FROM deals WHERE id = ?', [req.params.id]);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    await runAsync(
      `UPDATE deals SET name = ?, description = ?, price = ?, categoryId = ?, isActive = ?, hasVariants = ?, updatedAt = ? WHERE id = ?`,
      [
        name || deal.name,
        description !== undefined ? description : deal.description,
        price !== undefined ? price : deal.price,
        categoryId !== undefined ? categoryId : deal.categoryId,
        isActive !== undefined ? (isActive ? 1 : 0) : deal.isActive,
        hasVariants !== undefined ? (hasVariants ? 1 : 0) : deal.hasVariants,
        now,
        req.params.id
      ]
    );

    const updated = await getAsync('SELECT * FROM deals WHERE id = ?', [req.params.id]);
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete deal
dealRoutes.delete('/:id', async (req, res) => {
  try {
    const deal = await getAsync('SELECT * FROM deals WHERE id = ?', [req.params.id]);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const orderUsage = await getAsync(
      'SELECT COUNT(*) as count FROM orderItems WHERE dealId = ?',
      [req.params.id]
    );
    if (orderUsage && orderUsage.count > 0) {
      return res.status(409).json({
        error: 'Deal is referenced by historical order items. Remove or replace those orders before deleting this deal.',
      });
    }

    await runAsync('DELETE FROM dealItems WHERE dealId = ?', [req.params.id]);
    await runAsync('DELETE FROM dealVariants WHERE dealId = ?', [req.params.id]);
    await runAsync('DELETE FROM deals WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Deal Items Routes

// Get all items for a deal
dealRoutes.get('/:id/items', async (req, res) => {
  try {
    const items = await allAsync(
      `SELECT di.*, mi.name as menuItemName, mi.price as menuItemPrice
       FROM dealItems di
       JOIN menuItems mi ON di.menuItemId = mi.id
       WHERE di.dealId = ?
       ORDER BY di.sortOrder`,
      [req.params.id]
    );
    res.json(convertBooleansArray(items));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add item to deal
dealRoutes.post('/:id/items', async (req, res) => {
  try {
    const { menuItemId, quantity, requiresVariantSelection, sortOrder } = req.body;
    const { id: dealId } = req.params;

    if (!menuItemId) {
      return res.status(400).json({ error: 'menuItemId is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO dealItems (id, dealId, menuItemId, quantity, requiresVariantSelection, sortOrder, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, dealId, menuItemId, quantity || 1, requiresVariantSelection ? 1 : 0, sortOrder || 0, now]
    );

    const item = await getAsync(
      `SELECT di.*, mi.name as menuItemName, mi.price as menuItemPrice
       FROM dealItems di
       JOIN menuItems mi ON di.menuItemId = mi.id
       WHERE di.id = ?`,
      [id]
    );
    res.status(201).json(convertBooleans(item));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update deal item
dealRoutes.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { quantity, requiresVariantSelection, sortOrder } = req.body;

    const item = await getAsync('SELECT * FROM dealItems WHERE id = ?', [req.params.itemId]);
    if (!item) {
      return res.status(404).json({ error: 'Deal item not found' });
    }

    await runAsync(
      `UPDATE dealItems SET quantity = ?, requiresVariantSelection = ?, sortOrder = ? WHERE id = ?`,
      [
        quantity !== undefined ? quantity : item.quantity,
        requiresVariantSelection !== undefined ? (requiresVariantSelection ? 1 : 0) : item.requiresVariantSelection,
        sortOrder !== undefined ? sortOrder : item.sortOrder,
        req.params.itemId
      ]
    );

    const updated = await getAsync(
      `SELECT di.*, mi.name as menuItemName, mi.price as menuItemPrice
       FROM dealItems di
       JOIN menuItems mi ON di.menuItemId = mi.id
       WHERE di.id = ?`,
      [req.params.itemId]
    );
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete deal item
dealRoutes.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const item = await getAsync('SELECT * FROM dealItems WHERE id = ?', [req.params.itemId]);
    if (!item) {
      return res.status(404).json({ error: 'Deal item not found' });
    }

    await runAsync('DELETE FROM dealItems WHERE id = ?', [req.params.itemId]);
    res.json({ message: 'Deal item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Deal Variants Routes

// Get all variants for a deal
dealRoutes.get('/:id/variants', async (req, res) => {
  try {
    const variants = await allAsync(
      `SELECT dv.*, v.name as variantName, v.type as variantType
       FROM dealVariants dv
       JOIN variants v ON dv.variantId = v.id
       WHERE dv.dealId = ?
       ORDER BY v.sortOrder`,
      [req.params.id]
    );

    res.json(variants.map(v => convertBooleans({
      ...v,
      availableOptionIds: v.availableOptionIds ? JSON.parse(v.availableOptionIds) : []
    })));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add variant to deal
dealRoutes.post('/:id/variants', async (req, res) => {
  try {
    const { variantId, isRequired, selectionMode, availableOptionIds } = req.body;
    const { id: dealId } = req.params;

    if (!variantId) {
      return res.status(400).json({ error: 'variantId is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO dealVariants (id, dealId, variantId, isRequired, selectionMode, availableOptionIds, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, dealId, variantId, isRequired ? 1 : 0, selectionMode || 'single', JSON.stringify(availableOptionIds || []), now]
    );

    const variant = await getAsync(
      `SELECT dv.*, v.name as variantName, v.type as variantType
       FROM dealVariants dv
       JOIN variants v ON dv.variantId = v.id
       WHERE dv.id = ?`,
      [id]
    );

    res.status(201).json(convertBooleans({
      ...variant,
      availableOptionIds: variant.availableOptionIds ? JSON.parse(variant.availableOptionIds) : []
    }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update deal variant
dealRoutes.put('/:id/variants/:variantId', async (req, res) => {
  try {
    const { isRequired, selectionMode, availableOptionIds } = req.body;

    const variant = await getAsync(
      'SELECT * FROM dealVariants WHERE dealId = ? AND variantId = ?',
      [req.params.id, req.params.variantId]
    );
    if (!variant) {
      return res.status(404).json({ error: 'Deal variant not found' });
    }

    await runAsync(
      `UPDATE dealVariants SET isRequired = ?, selectionMode = ?, availableOptionIds = ? WHERE dealId = ? AND variantId = ?`,
      [
        isRequired !== undefined ? (isRequired ? 1 : 0) : variant.isRequired,
        selectionMode || variant.selectionMode,
        availableOptionIds ? JSON.stringify(availableOptionIds) : variant.availableOptionIds,
        req.params.id,
        req.params.variantId
      ]
    );

    const updated = await getAsync(
      `SELECT dv.*, v.name as variantName, v.type as variantType
       FROM dealVariants dv
       JOIN variants v ON dv.variantId = v.id
       WHERE dv.dealId = ? AND dv.variantId = ?`,
      [req.params.id, req.params.variantId]
    );

    res.json(convertBooleans({
      ...updated,
      availableOptionIds: updated.availableOptionIds ? JSON.parse(updated.availableOptionIds) : []
    }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete deal variant
dealRoutes.delete('/:id/variants/:variantId', async (req, res) => {
  try {
    const variant = await getAsync(
      'SELECT * FROM dealVariants WHERE dealId = ? AND variantId = ?',
      [req.params.id, req.params.variantId]
    );
    if (!variant) {
      return res.status(404).json({ error: 'Deal variant not found' });
    }

    await runAsync('DELETE FROM dealVariants WHERE dealId = ? AND variantId = ?', [req.params.id, req.params.variantId]);
    res.json({ message: 'Deal variant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Bulk update deal variants (replace all)
dealRoutes.put('/:id/variants', async (req, res) => {
  try {
    const { variants } = req.body;
    const { id: dealId } = req.params;

    // Delete existing variants
    await runAsync('DELETE FROM dealVariants WHERE dealId = ?', [dealId]);

    // Insert new variants
    const now = new Date().toISOString();
    for (const v of (variants || [])) {
      const id = uuidv4();
      await runAsync(
        `INSERT INTO dealVariants (id, dealId, variantId, isRequired, selectionMode, availableOptionIds, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, dealId, v.variantId, v.isRequired ? 1 : 0, v.selectionMode || 'single', JSON.stringify(v.availableOptionIds || []), now]
      );
    }

    // Return updated variants
    const updatedVariants = await allAsync(
      `SELECT dv.*, v.name as variantName, v.type as variantType
       FROM dealVariants dv
       JOIN variants v ON dv.variantId = v.id
       WHERE dv.dealId = ?`,
      [dealId]
    );

    res.json(updatedVariants.map(v => convertBooleans({
      ...v,
      availableOptionIds: v.availableOptionIds ? JSON.parse(v.availableOptionIds) : []
    })));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
