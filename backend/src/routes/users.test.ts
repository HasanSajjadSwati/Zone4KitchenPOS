import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const state = vi.hoisted(() => ({
  users: new Map<string, Record<string, any>>(),
  statements: [] as string[],
}));

function fakeQuery(sql: string, params: any[] = []) {
  const text = sql.replace(/\s+/g, ' ').trim();
  state.statements.push(text);
  if (text.startsWith('SELECT u.id, r.name as roleName FROM users u') || text.startsWith('SELECT u.id, u.username, r.name as roleName FROM users u')) {
    const user = state.users.get(params[0]);
    return user ? { id: user.id, username: user.username, roleName: user.roleName } : undefined;
  }
  if (text.startsWith('UPDATE users SET isActive = ?, deletedAt = ?, username = ?, updatedAt = ? WHERE id = ?')) {
    const [isActive, deletedAt, username, , id] = params;
    // users.isActive is BOOLEAN in Postgres: an integer would be rejected.
    if (typeof isActive !== 'boolean') throw new Error('column "isactive" is of type boolean but expression is of type integer');
    Object.assign(state.users.get(id)!, { isActive, deletedAt, username });
    return { rowCount: 1 };
  }
  if (text.startsWith('DELETE FROM users')) {
    // Every user who ever logged in or took an order is referenced by auditLogs/orders/payments.
    throw new Error('update or delete on table "users" violates foreign key constraint "auditlogs_userid_fkey" on table "auditlogs"');
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

import { userRoutes } from './users.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/users`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  state.users.clear();
  state.statements.length = 0;
  state.users.set('admin-1', { id: 'admin-1', username: 'admin', roleName: 'Admin', isActive: true, deletedAt: null });
  state.users.set('cashier-1', { id: 'cashier-1', username: 'fahad', roleName: 'Cashier', isActive: true, deletedAt: null });
});

const remove = (id: string) => fetch(`${baseUrl}/${id}?adminUserId=admin-1`, { method: 'DELETE' });

describe('DELETE /api/users/:id', () => {
  it('deletes a user who has history, keeping the rows that point at them', async () => {
    const res = await remove('cashier-1');

    expect(res.status).toBe(200);
    expect(state.statements.some((s) => s.startsWith('DELETE FROM users'))).toBe(false);
    const user = state.users.get('cashier-1')!;
    expect(user.isActive).toBe(false);
    expect(user.deletedAt).toBeTruthy();
  });

  it('frees the username so a new user can take it', async () => {
    await remove('cashier-1');

    const user = state.users.get('cashier-1')!;
    expect(user.username).not.toBe('fahad');
    expect(user.username).toMatch(/^fahad\.deleted\./);
  });

  it('still refuses to delete an admin', async () => {
    state.users.set('admin-2', { id: 'admin-2', username: 'owner', roleName: 'Admin', isActive: true, deletedAt: null });

    const res = await remove('admin-2');

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Admin users cannot be deleted' });
    expect(state.users.get('admin-2')!.deletedAt).toBeNull();
  });
});

describe('GET /api/users', () => {
  it('returns deletedAt so screens can hide deleted users while reports still find their names', async () => {
    await fetch(baseUrl);

    expect(state.statements.at(-1)).toContain('u.deletedAt');
  });
});
