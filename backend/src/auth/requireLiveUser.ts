import type { NextFunction, Request, Response } from 'express';
import { getAsync } from '../db/database.js';
import { isPublicApiRequest } from './requireAuth.js';

const CACHE_MS = 30_000;

export type LiveUserLookup = (id: string) => Promise<boolean>;

const defaultLookup: LiveUserLookup = async (id) => {
  const row = await getAsync('SELECT id FROM users WHERE id = ? AND deletedAt IS NULL AND isActive = TRUE', [id]);
  return Boolean(row);
};

// Runs after requireAuth. A valid token is not enough: the user must still exist, be active and not
// be in the Recycle Bin. Verdicts (live and not live) are cached per user for 30 s so the check is
// not a query per request; a deleted user is therefore locked out within 30 s.
export function requireLiveUser(lookup: LiveUserLookup = defaultLookup, now: () => number = Date.now) {
  const cache = new Map<string, { live: boolean; at: number }>();

  return async (req: Request, res: Response, next: NextFunction) => {
    if (isPublicApiRequest(req)) return next();

    const id: string | undefined = res.locals.authUser?.id;
    if (!id) return res.status(401).json({ error: 'Authentication required' });

    try {
      let entry = cache.get(id);
      if (!entry || now() - entry.at >= CACHE_MS) {
        entry = { live: await lookup(id), at: now() };
        cache.set(id, entry);
      }
      if (!entry.live) return res.status(401).json({ error: 'Authentication required' });
      next();
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };
}
