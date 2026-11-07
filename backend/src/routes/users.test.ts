import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const state = vi.hoisted(() => ({
  users: new Map<string, Record<string, any>>(),
  statements: [] as string[],
  softDelete: null as any,
}));

function fakeQuery(sql: string, params: any[] = []) {
  const text = sql.replace(/\s+/g, ' ').trim();
  state.statements.push(text);
  if (text.startsWith('SELECT u.id, r.name as roleName FROM users u') || text.startsWith('SELECT u.id, u.username, r.name as roleName FROM users u')) {
    const user = state.users.get(params[0]);
    return user ? { id: user.id, username: user.username, roleName: user.roleName } : undefined;
  }
  if (text.startsWith('DELETE FROM users') || text.startsWith('UPDATE users')) {
    // Deleting is the Recycle Bin service's job now; the route must not write users itself.
    throw new Error(`users route wrote directly: ${text}`);
  }
  throw new Error(`Unexpected SQL in test: ${text}`);
}

vi.mock('../db/database.js', () => ({
  getAsync: vi.fn(async (sql: string, params?: any[]) => fakeQuery(sql, params)),
  runAsync: vi.fn(async (sql: string, params?: any[]) => fakeQuery(sql, params)),
  allAsync: vi.fn(async (sql: string) => {
    state.statements.push(sql.replace(/\s+/g, ' ').trim());
    return [...state.users.values()];
  }),
}));

vi.mock('../recycle/recycleService.js', () => ({ softDelete: (...args: any[]) => state.softDelete(...args) }));

import { userRoutes } from './users.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.authUser = { id: 'admin-1', username: 'admin' };
    next();
  });
  app.use('/api/users', userRoutes);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/users`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  state.users.clear();
  state.statements.length = 0;
  state.softDelete = vi.fn(async () => ({ ok: true, outcome: 'tombstoned' }));
  state.users.set('admin-1', { id: 'admin-1', username: 'admin', roleName: 'Admin', isActive: true, deletedAt: null });
  state.users.set('cashier-1', { id: 'cashier-1', username: 'fahad', roleName: 'Cashier', isActive: true, deletedAt: null });
});

const remove = (id: string) => fetch(`${baseUrl}/${id}?adminUserId=admin-1`, { method: 'DELETE' });

describe('DELETE /api/users/:id', () => {
  it('moves a user to the Recycle Bin without writing the users table itself', async () => {
    const res = await remove('cashier-1');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Moved to the Recycle Bin' });
    expect(state.softDelete).toHaveBeenCalledWith('users', 'cashier-1', 'admin-1');
    expect(state.statements.some((s) => s.startsWith('DELETE FROM users') || s.startsWith('UPDATE users'))).toBe(false);
  });

  it('no longer renames the username (restore needs the original)', async () => {
    await remove('cashier-1');

    expect(state.users.get('cashier-1')!.username).toBe('fahad');
  });

  it('still refuses to delete an admin', async () => {
    state.users.set('admin-2', { id: 'admin-2', username: 'owner', roleName: 'Admin', isActive: true, deletedAt: null });

    const res = await remove('admin-2');

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Admin users cannot be deleted' });
    expect(state.softDelete).not.toHaveBeenCalled();
  });
});

describe('GET /api/users', () => {
  it('hides deleted users unless includeDeleted=true', async () => {
    await fetch(baseUrl);
    expect(state.statements.at(-1)).toContain('u.deletedAt IS NULL');

    await fetch(`${baseUrl}?includeDeleted=true`);
    expect(state.statements.at(-1)).not.toContain('u.deletedAt IS NULL');
  });
});
