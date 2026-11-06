import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from './token.js';

// Everything else under /api needs a token. The web app's own files stay public.
const PUBLIC_API_PATHS = new Set(['/api/health', '/api/auth/login']);

export function isPublicApiRequest(req: Request): boolean {
  return !req.path.startsWith('/api/') || PUBLIC_API_PATHS.has(req.path) || req.method === 'OPTIONS';
}

export function requireAuth(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isPublicApiRequest(req)) {
      return next();
    }

    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    const claims = token ? verifyToken(token, secret) : null;
    if (!claims) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    res.locals.authUser = { id: claims.sub, username: claims.username };
    next();
  };
}

// Browsers cannot set headers on a WebSocket, so the sync socket passes the token as ?token=.
export function isAuthorizedWebSocketUrl(url: string | undefined, secret: string): boolean {
  if (!url) return false;
  const token = new URL(url, 'http://localhost').searchParams.get('token');
  return Boolean(token && verifyToken(token, secret));
}
