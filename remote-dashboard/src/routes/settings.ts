import express from 'express';
import { getAllDocuments } from '../services/couchdbService.js';

export const settingsRoute = express.Router();

// Get all settings
settingsRoute.get('/', async (req, res) => {
  try {
    const settings = await getAllDocuments('settings');
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get specific setting
settingsRoute.get('/:key', async (req, res) => {
  try {
    const settings = await getAllDocuments('settings');
    const setting = settings.find((s: any) => s.key === req.params.key);
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
