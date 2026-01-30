import express from 'express';
import { wipeDatabase } from '../services/dataWipeService.js';

export const maintenanceRoutes = express.Router();

maintenanceRoutes.post('/wipe-all', async (req, res) => {
  const {
    keepSettings = true,
    keepUsers = true,
  } = req.body || {};

  try {
    await wipeDatabase({ keepSettings, keepUsers });
    res.json({
      message: 'Database wipe completed',
      keepSettings,
      keepUsers,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
