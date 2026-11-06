import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import bcrypt from 'bcryptjs';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const SECRET = 'x'.repeat(48);

const users = vi.hoisted(() => new Map<string, Record<string, any>>());
const roles = vi.hoisted(() => new Map<string, Record<string, any>>());

vi.mock('../db/database.js', () => ({
  getAsync: vi.fn(async (sql: string, params: any[] = []) => {
    const text = sql.replace(/\s+/g, ' ');
    if (text.includes('FROM users')) {
      const liveOnly = text.includes('deletedAt IS NULL');
      return [...users.values()].find((u) => u.username === params[0] && (!liveOnly || !u.deletedAt));
    }
    if (text.includes('FROM roles')) return roles.get(params[0]);
    throw new Error(`Unexpected SQL in test: ${text}`);
  }),
}));

import { signToken, verifyToken, getAuthSecret } from './token.js';
import { requireAuth, isAuthorizedWebSocketUrl } from './requireAuth.js';
import { requireLiveUser } from './requireLiveUser.js';
import { createAuthRoutes } from '../routes/auth.js';

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('signed tokens', () => {
  it('round-trips the claims', () => {
    const token = signToken({ sub: 'u1', username: 'cashier', exp: nowSeconds() + 60 }, SECRET);
    expect(verifyToken(token, SECRET)).toMatchObject({ sub: 'u1', username: 'cashier' });
  });

  it('rejects a token signed with another secret', () => {
    const token = signToken({ sub: 'u1', username: 'cashier', exp: nowSeconds() + 60 }, 'y'.repeat(48));
    expect(verifyToken(token, SECRET)).toBeNull();
  });

  it('rejects a token whose payload was edited', () => {
    const [header, , signature] = signToken({ sub: 'u1', username: 'cashier', exp: nowSeconds() + 60 }, SECRET).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', username: 'admin', exp: nowSeconds() + 60 })).toString('base64url');
    expect(verifyToken(`${header}.${forged}.${signature}`, SECRET)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = signToken({ sub: 'u1', username: 'cashier', exp: nowSeconds() - 1 }, SECRET);
    expect(verifyToken(token, SECRET)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyToken('not-a-token', SECRET)).toBeNull();
    expect(verifyToken('a.b.c', SECRET)).toBeNull();
  });

  it('refuses to start without a long enough AUTH_SECRET', () => {
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = 'short';
    expect(() => getAuthSecret()).toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = SECRET;
    expect(getAuthSecret()).toBe(SECRET);
    process.env.AUTH_SECRET = previous;
  });
});

describe('websocket upgrade check', () => {
  it('accepts a valid token in the query string and nothing else', () => {
    const token = signToken({ sub: 'u1', username: 'cashier', exp: nowSeconds() + 60 }, SECRET);
    expect(isAuthorizedWebSocketUrl(`/api/ws?token=${token}`, SECRET)).toBe(true);
    expect(isAuthorizedWebSocketUrl('/api/ws', SECRET)).toBe(false);
    expect(isAuthorizedWebSocketUrl('/api/ws?token=bad', SECRET)).toBe(false);
    expect(isAuthorizedWebSocketUrl(undefined, SECRET)).toBe(false);
  });
});

describe('HTTP: login and the API guard', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(requireAuth(SECRET));
    app.use('/api/auth', createAuthRoutes(SECRET));
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api/payments', (_req, res) => res.json({ user: res.locals.authUser }));
    app.get('/', (_req, res) => res.send('<html>app</html>'));
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  beforeEach(async () => {
    users.clear();
    roles.clear();
    roles.set('role-cashier', { id: 'role-cashier', name: 'Cashier', permissions: '[{"resource":"orders","actions":["create"]}]', createdAt: 'x' });
    const passwordHash = await bcrypt.hash('right-password', 4);
    for (const [id, username] of [['u1', 'cashier'], ['u2', 'manager']]) {
      users.set(id, { id, username, fullName: username, roleId: 'role-cashier', isActive: true, passwordHash, createdAt: 'x', updatedAt: 'x' });
    }
  });

  const login = (username: string, password: string) =>
    fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

  it('blocks API calls without a token', async () => {
    const res = await fetch(`${base}/api/payments`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Authentication required' });
  });

  it('blocks API calls with a bad token', async () => {
    const res = await fetch(`${base}/api/payments`, { headers: { Authorization: 'Bearer nope' } });
    expect(res.status).toBe(401);
  });

  it('leaves health, login and the web app itself open', async () => {
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
    expect((await fetch(`${base}/`)).status).toBe(200);
    expect((await login('cashier', 'wrong')).status).toBe(401);
  });

  it('logs in, returns a token without the password hash, and the token opens the API', async () => {
    const res = await login('cashier', 'right-password');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ id: 'u1', username: 'cashier', isActive: true });
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.role).toMatchObject({ id: 'role-cashier', permissions: [{ resource: 'orders', actions: ['create'] }] });
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 7 * 3600 * 1000);

    const api = await fetch(`${base}/api/payments`, { headers: { Authorization: `Bearer ${body.token}` } });
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({ user: { id: 'u1', username: 'cashier' } });
  });

  it('rejects a wrong password and an unknown user the same way', async () => {
    for (const res of [await login('cashier', 'wrong'), await login('nobody', 'x')]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Invalid credentials' });
    }
  });

  it('rejects a disabled account', async () => {
    users.get('u1')!.isActive = false;
    const res = await login('cashier', 'right-password');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Account is disabled' });
  });

  it('login refuses a deleted user and finds the live user with the same username', async () => {
    users.get('u1')!.deletedAt = '2026-11-01T00:00:00.000Z';
    expect((await login('cashier', 'right-password')).status).toBe(401);

    const passwordHash = await bcrypt.hash('new-password', 4);
    users.set('u3', { id: 'u3', username: 'cashier', fullName: 'New Cashier', roleId: 'role-cashier', isActive: true, passwordHash, createdAt: 'x', updatedAt: 'x' });
    const res = await login('cashier', 'new-password');
    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({ id: 'u3' });
  });

  it('requires both fields', async () => {
    expect((await login('cashier', '')).status).toBe(400);
  });

  it('locks a username after repeated wrong passwords, without affecting other users', async () => {
    for (let i = 0; i < 10; i += 1) await login('manager', `guess-${i}`);
    const locked = await login('manager', 'right-password');
    expect(locked.status).toBe(429);
    expect((await login('cashier', 'right-password')).status).toBe(200);
  });
});

describe('requireLiveUser', () => {
  let server: Server;
  let base: string;
  let clock = 1_000_000;
  const live = new Set<string>(['u1']);
  const lookup = vi.fn(async (id: string) => live.has(id));

  beforeAll(async () => {
    const app = express();
    app.use(requireAuth(SECRET));
    app.use(requireLiveUser(lookup, () => clock));
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api/payments', (_req, res) => res.json({ ok: true }));
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const call = (id: string) =>
    fetch(`${base}/api/payments`, {
      headers: { Authorization: `Bearer ${signToken({ sub: id, username: id, exp: nowSeconds() + 600 }, SECRET)}` },
    });

  it("a deleted user's token is rejected on the next request after the cache window", async () => {
    expect((await call('u1')).status).toBe(200);

    live.delete('u1'); // deleted in the Recycle Bin
    clock += 29_000;
    expect((await call('u1')).status).toBe(200); // still inside the 30 s window: cached verdict

    clock += 2_000;
    const res = await call('u1');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Authentication required' });
  });

  it('answers a generic 500, logs the real error and does not cache a failed lookup', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    lookup.mockRejectedValueOnce(new Error('connection to db-host:5432 refused'));
    const res = await call('flaky');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Could not verify the session' });
    expect(spy).toHaveBeenCalled();

    live.add('flaky');
    expect((await call('flaky')).status).toBe(200);
    spy.mockRestore();
  });

  it('caches a not-live verdict too, and does not guard public paths', async () => {
    lookup.mockClear();
    expect((await call('ghost')).status).toBe(401);
    expect((await call('ghost')).status).toBe(401);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
  });
});
