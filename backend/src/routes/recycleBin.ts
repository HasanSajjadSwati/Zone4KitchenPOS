import { Router } from 'express';
import { requireAdmin } from '../auth/requireAdmin.js';
import { getTypeDef, type RecycleType } from '../recycle/registry.js';
import { listBin, restore, deleteForever } from '../recycle/recycleService.js';

export const recycleBinRoutes = Router();

recycleBinRoutes.use(requireAdmin);

recycleBinRoutes.get('/', async (req, res) => {
  try {
    const type = typeof req.query.type === 'string' && req.query.type !== '' ? req.query.type : undefined;
    if (type !== undefined && !getTypeDef(type)) return res.status(400).json({ error: 'Unknown type' });
    res.json(await listBin(type as RecycleType | undefined));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

recycleBinRoutes.post('/:type/:id/restore', async (req, res) => {
  try {
    if (!getTypeDef(req.params.type)) return res.status(400).json({ error: 'Unknown type' });
    const result = await restore(req.params.type as RecycleType, req.params.id, res.locals.authUser.id);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ message: 'Restored' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

recycleBinRoutes.delete('/:type/:id', async (req, res) => {
  try {
    if (!getTypeDef(req.params.type)) return res.status(400).json({ error: 'Unknown type' });
    const result = await deleteForever(req.params.type as RecycleType, req.params.id, res.locals.authUser.id);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ outcome: result.outcome });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
