import express from 'express';
import {
  getAllDocuments,
  getDocument,
} from '../services/couchdbService.js';

export const menuRoute = express.Router();

// Get all menu items
menuRoute.get('/items', async (req, res) => {
  try {
    const items = await getAllDocuments('menuItems');
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get menu item by ID
menuRoute.get('/items/:id', async (req, res) => {
  try {
    const item = await getDocument(req.params.id);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all categories
menuRoute.get('/categories', async (req, res) => {
  try {
    const categories = await getAllDocuments('categories');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get variants for a menu item
menuRoute.get('/items/:id/variants', async (req, res) => {
  try {
    const allVariants = await getAllDocuments('variants');
    const variants = allVariants.filter(
      (v: any) => v.menuItemId === req.params.id
    );
    res.json(variants);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
