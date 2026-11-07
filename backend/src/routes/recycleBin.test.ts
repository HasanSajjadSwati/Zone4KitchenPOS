import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const state = vi.hoisted(() => ({
  users: new Map<string, Record<string, any>>(),
  authUserId: 'admin-1' as string,
  statements: [] as string[],
  listBin: null as any,
  restore: null as any,
  deleteForever: null as any,
}));

vi.mock('../db/database.js', () => ({
  getAsync: vi.fn(async (sql: string, params: any[] = []) => {
    const text = sql.replace(/\s+/g, ' ').trim();
    state.statements.push(text);
    const user = state.users.get(params[0]);
    if (!user || user.deletedAt || !user.isActive) return undefined;
    return { roleName: user.roleName };
  }),
}));

vi.mock('../recycle/recycleService.js', () => ({
  listBin: (...a: any[]) => state.listBin(...a),
  restore: (...a: any[]) => state.restore(...a),
  deleteForever: (...a: any[]) => state.deleteForever(...a),
}));

import { recycleBinRoutes } from './recycleBin.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.authUser = { id: state.authUserId, username: 'x' };
    next();
  });
  app.use('/api/recycle-bin', recycleBinRoutes);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/recycle-bin`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  state.users.clear();
  state.users.set('admin-1', { id: 'admin-1', roleName: 'Admin', isActive: true, deletedAt: null });
  state.users.set('cashier-1', { id: 'cashier-1', roleName: 'Cashier', isActive: true, deletedAt: null });
  state.authUserId = 'admin-1';
  state.listBin = vi.fn(async () => []);
  state.restore = vi.fn(async () => ({ ok: true }));
  state.deleteForever = vi.fn(async () => ({ ok: true, outcome: 'removed' }));
});

describe('recycle bin API', () => {
  it('non-admin gets 403 even when sending adminUserId of an admin', async () => {
    state.authUserId = 'cashier-1';
    const res = await fetch(`${baseUrl}?adminUserId=admin-1`, { headers: { 'x-admin-user-id': 'admin-1' } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Admins only' });
    const del = await fetch(`${baseUrl}/users/u1`, {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ adminUserId: 'admin-1' }),
    });
    expect(del.status).toBe(403);
    expect(state.listBin).not.toHaveBeenCalled();
    expect(state.deleteForever).not.toHaveBeenCalled();
  });

  it('unknown or inactive token user gets 403', async () => {
    state.authUserId = 'ghost';
    expect((await fetch(baseUrl)).status).toBe(403);
    state.users.get('admin-1')!.isActive = false;
    state.authUserId = 'admin-1';
    expect((await fetch(baseUrl)).status).toBe(403);
  });

  it('admin lists the bin', async () => {
    const entries = [{ type: 'users', typeLabel: 'Users', id: 'u1', name: 'Bob' }];
    state.listBin = vi.fn(async () => entries);
    const res = await fetch(`${baseUrl}?type=users`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(entries);
    expect(state.listBin).toHaveBeenCalledWith('users');
    await fetch(baseUrl);
    expect(state.listBin).toHaveBeenLastCalledWith(undefined);
  });

  it('restore and delete forever pass the token user as actor', async () => {
    const r = await fetch(`${baseUrl}/users/u1/restore`, { method: 'POST' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ message: 'Restored' });
    expect(state.restore).toHaveBeenCalledWith('users', 'u1', 'admin-1');
    const d = await fetch(`${baseUrl}/customers/c1`, { method: 'DELETE' });
    expect(d.status).toBe(200);
    expect(await d.json()).toEqual({ outcome: 'removed' });
    expect(state.deleteForever).toHaveBeenCalledWith('customers', 'c1', 'admin-1');
  });

  it('unknown type is 400', async () => {
    expect((await fetch(`${baseUrl}?type=nope`)).status).toBe(400);
    const r = await fetch(`${baseUrl}/nope/x/restore`, { method: 'POST' });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'Unknown type' });
    expect((await fetch(`${baseUrl}/nope/x`, { method: 'DELETE' })).status).toBe(400);
  });

  it('service 409 is passed through with its message', async () => {
    state.deleteForever = vi.fn(async () => ({ ok: false, status: 409, error: 'In use' }));
    const res = await fetch(`${baseUrl}/users/u1`, { method: 'DELETE' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'In use' });
  });

  it('unexpected exception is 500', async () => {
    state.restore = vi.fn(async () => { throw new Error('boom'); });
    const res = await fetch(`${baseUrl}/users/u1/restore`, { method: 'POST' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'boom' });
  });
});
