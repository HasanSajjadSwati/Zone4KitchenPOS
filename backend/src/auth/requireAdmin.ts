import type { NextFunction, Request, Response } from 'express';
import { getAsync } from '../db/database.js';

// Admin is decided only from the signed-in (token) user, looked up live in the database.
// Anything the client sends (adminUserId in body, query or header) is ignored.
export async function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  try {
    const userId = res.locals.authUser?.id;
    if (!userId) return res.status(403).json({ error: 'Admins only' });
    const row = await getAsync(
      `SELECT r.name as roleName FROM users u
       JOIN roles r ON u.roleId = r.id
       WHERE u.id = ? AND u.deletedAt IS NULL AND u.isActive = TRUE`,
      [userId]
    );
    if (!row || String(row.roleName ?? '').toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Admins only' });
    }
    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
