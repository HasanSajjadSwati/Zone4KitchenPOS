import express from 'express';
import { runAsync, getAsync } from '../db/database.js';

export const settingsRoutes = express.Router();

// Get settings
settingsRoutes.get('/', async (req, res) => {
  try {
    let settings = await getAsync('SELECT * FROM settings WHERE id = ?', ['default']);

    if (!settings) {
      // Create default settings if not exists
      const now = new Date().toISOString();
      await runAsync(
        `INSERT INTO settings (id, restaurantName, updatedAt) VALUES (?, ?, ?)`,
        ['default', 'My Restaurant', now]
      );
      settings = await getAsync('SELECT * FROM settings WHERE id = ?', ['default']);
    }

    // Parse JSON fields
    if (settings.expenseCategories && typeof settings.expenseCategories === 'string') {
      settings.expenseCategories = JSON.parse(settings.expenseCategories);
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update settings
settingsRoutes.put('/', async (req, res) => {
  try {
    const {
      kotSplitByMajorCategory,
      kotIncludeVariants,
      kotIncludeDealBreakdown,
      restaurantName,
      restaurantAddress,
      restaurantPhone,
      taxRate,
      deliveryCharge,
      receiptFooter,
      printAllIncludeKOT,
      printAllIncludeCustomer,
      printAllIncludeCounter,
      printAllIncludeRider,
      expenseCategories,
      dayCountByRegister,
      updatedBy
    } = req.body;

    const now = new Date().toISOString();

    const settings = await getAsync('SELECT * FROM settings WHERE id = ?', ['default']);

    const updates: string[] = [];
    const values: any[] = [];

    if (kotSplitByMajorCategory !== undefined) {
      updates.push('kotSplitByMajorCategory = ?');
      values.push(kotSplitByMajorCategory ? 1 : 0);
    }
    if (kotIncludeVariants !== undefined) {
      updates.push('kotIncludeVariants = ?');
      values.push(kotIncludeVariants ? 1 : 0);
    }
    if (kotIncludeDealBreakdown !== undefined) {
      updates.push('kotIncludeDealBreakdown = ?');
      values.push(kotIncludeDealBreakdown ? 1 : 0);
    }
    if (restaurantName !== undefined) {
      updates.push('restaurantName = ?');
      values.push(restaurantName);
    }
    if (restaurantAddress !== undefined) {
      updates.push('restaurantAddress = ?');
      values.push(restaurantAddress);
    }
    if (restaurantPhone !== undefined) {
      updates.push('restaurantPhone = ?');
      values.push(restaurantPhone);
    }
    if (taxRate !== undefined) {
      updates.push('taxRate = ?');
      values.push(taxRate);
    }
    if (deliveryCharge !== undefined) {
      updates.push('deliveryCharge = ?');
      values.push(deliveryCharge);
    }
    if (receiptFooter !== undefined) {
      updates.push('receiptFooter = ?');
      values.push(receiptFooter);
    }
    if (printAllIncludeKOT !== undefined) {
      updates.push('printAllIncludeKOT = ?');
      values.push(printAllIncludeKOT ? 1 : 0);
    }
    if (printAllIncludeCustomer !== undefined) {
      updates.push('printAllIncludeCustomer = ?');
      values.push(printAllIncludeCustomer ? 1 : 0);
    }
    if (printAllIncludeCounter !== undefined) {
      updates.push('printAllIncludeCounter = ?');
      values.push(printAllIncludeCounter ? 1 : 0);
    }
    if (printAllIncludeRider !== undefined) {
      updates.push('printAllIncludeRider = ?');
      values.push(printAllIncludeRider ? 1 : 0);
    }
    if (expenseCategories !== undefined) {
      updates.push('expenseCategories = ?');
      values.push(JSON.stringify(expenseCategories));
    }
    if (dayCountByRegister !== undefined) {
      updates.push('dayCountByRegister = ?');
      values.push(dayCountByRegister ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updatedAt = ?');
      values.push(now);
      if (updatedBy) {
        updates.push('updatedBy = ?');
        values.push(updatedBy);
      }
      values.push('default');

      await runAsync(`UPDATE settings SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const updated = await getAsync('SELECT * FROM settings WHERE id = ?', ['default']);
    if (updated.expenseCategories && typeof updated.expenseCategories === 'string') {
      updated.expenseCategories = JSON.parse(updated.expenseCategories);
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
