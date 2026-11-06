// Shared tail of every DELETE route: hand the record to the Recycle Bin service and answer.
// The service decides whether the delete is allowed (dependents, open work); routes keep only
// their own authorization checks.
import type { Response } from 'express';
import { softDelete } from './recycleService.js';
import type { RecycleType } from './registry.js';

export async function moveToBin(res: Response, type: RecycleType, id: string): Promise<void> {
  const result = await softDelete(type, id, res.locals.authUser.id);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ message: 'Moved to the Recycle Bin' });
}
