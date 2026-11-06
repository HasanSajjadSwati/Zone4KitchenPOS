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
// be in the Recycle Bin. Only a LIVE verdict is cached (30 s) so the check is not a query per
// request; a deleted user is therefore locked out within 30 s. A not-live verdict is looked up again on
// the next request, so a user restored from the Recycle Bin is back at once.
export function requireLiveUser(lookup: LiveUserLookup = defaultLookup, now: () => number = Date.now) {
  const cache = new Map<string, number>(); // user id -> when a live verdict was cached

  return async (req: Request, res: Response, next: NextFunction) => {
    if (isPublicApiRequest(req)) return next();

    const id: string | undefined = res.locals.authUser?.id;
    if (!id) return res.status(401).json({ error: 'Authentication required' });

    try {
      const cachedAt = cache.get(id);
      if (cachedAt === undefined || now() - cachedAt >= CACHE_MS) {
        cache.delete(id);
        if (await lookup(id)) cache.set(id, now());
        else return res.status(401).json({ error: 'Authentication required' });
      }
      next();
    } catch (error) {
      // Not cached: the next request retries the lookup. The real error stays server-side.
      console.error('Could not verify the session user:', error);
      res.status(500).json({ error: 'Could not verify the session' });
    }
  };
}
