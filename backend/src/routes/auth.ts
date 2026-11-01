import express from 'express';
import bcrypt from 'bcryptjs';
import { getAsync } from '../db/database.js';
import { signToken } from '../auth/token.js';

const SESSION_HOURS = 8;
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

// Failed logins per client+username, kept in memory (single backend process).
const failedLogins = new Map<string, { count: number; firstAt: number }>();

function isLockedOut(key: string): boolean {
  const entry = failedLogins.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOCKOUT_MS) {
    failedLogins.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailure(key: string): void {
  const entry = failedLogins.get(key);
  if (!entry || Date.now() - entry.firstAt > LOCKOUT_MS) {
    failedLogins.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function createAuthRoutes(secret: string) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body ?? {};
      if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const attemptKey = `${req.ip}|${username.toLowerCase()}`;
      if (isLockedOut(attemptKey)) {
        return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
      }

      const user = await getAsync(
        `SELECT id, username, passwordHash, fullName, roleId, isActive, createdAt, updatedAt
         FROM users WHERE username = ?`,
        [username]
      );
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        recordFailure(attemptKey);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is disabled' });
      }

      const role = await getAsync('SELECT id, name, permissions, createdAt FROM roles WHERE id = ?', [user.roleId]);
      if (!role) {
        return res.status(500).json({ error: 'User role not found' });
      }

      failedLogins.delete(attemptKey);
      const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
      const { passwordHash: _omit, ...safeUser } = user;
      res.json({
        token: signToken({ sub: user.id, username: user.username, exp }, secret),
        expiresAt: new Date(exp * 1000).toISOString(),
        user: safeUser,
        role: { ...role, permissions: JSON.parse(role.permissions) },
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
