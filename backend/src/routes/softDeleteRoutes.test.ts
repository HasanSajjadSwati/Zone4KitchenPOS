import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const state = vi.hoisted(() => ({
  statements: [] as string[],
  waiters: [] as Array<Record<string, any>>,
  menuItem: null as Record<string, any> | null,
  customers: [] as Array<Record<string, any>>,
  softDelete: null as any,
}));

const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

vi.mock('../db/database.js', () => ({
  getAsync: vi.fn(async (sql: string, params: any[] = []) => {
    const text = norm(sql);
    state.statements.push(text);
    if (text.startsWith('SELECT u.id, r.name as roleName FROM users u')) return { id: 'admin-1', roleName: 'Admin' };
    if (text.startsWith('SELECT u.id, u.username, r.name as roleName FROM users u')) {
      return { id: params[0], username: 'fahad', roleName: 'Cashier' };
    }
    if (text.startsWith('SELECT * FROM menuItems WHERE id')) return state.menuItem ?? undefined;
    if (text.includes('FROM customers c') && text.includes('c.phone = ?')) {
      return state.customers.find((c) => c.phone === params[0] && (!text.includes('c.deletedAt IS NULL') || !c.deletedAt));
    }
    return undefined;
  }),
  runAsync: vi.fn(async (sql: string) => {
    state.statements.push(norm(sql));
    return { rowCount: 1 };
  }),
  allAsync: vi.fn(async (sql: string) => {
    const text = norm(sql);
    state.statements.push(text);
    if (text.startsWith('SELECT * FROM waiters')) {
      return state.waiters.filter((w) => !text.includes('deletedAt IS NULL') || !w.deletedAt);
    }
    return [];
  }),
  convertBooleans: (row: any) => row,
  convertBooleansArray: (rows: any[]) => rows,
}));

vi.mock('../recycle/recycleService.js', () => ({
  softDelete: (...args: any[]) => state.softDelete(...args),
}));
vi.mock('../websocket.js', () => ({ broadcastSync: vi.fn() }));

import { userRoutes } from './users.js';
import { customerRoutes } from './customers.js';
import { staffRoutes } from './staff.js';
import { employeeRoutes } from './employees.js';
import { roleRoutes } from './roles.js';
import { categoryRoutes } from './categories.js';
import { variantRoutes } from './variants.js';
import { menuItemRoutes } from './menuItems.js';
import { dealRoutes } from './deals.js';
import { expenseRoutes } from './expenses.js';

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
  app.use('/api/roles', roleRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/menu-items', menuItemRoutes);
  app.use('/api/variants', variantRoutes);
  app.use('/api/deals', dealRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/customers', customerRoutes);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  state.statements.length = 0;
  state.waiters = [];
  state.menuItem = null;
  state.customers = [];
  state.softDelete = vi.fn(async () => ({ ok: true, outcome: 'removed' }));
});

const ENDPOINTS: Array<[string, string, string]> = [
  ['users', '/api/users/u1?adminUserId=admin-1', 'users'],
  ['customers', '/api/customers/x1', 'customers'],
  ['waiters', '/api/staff/waiters/x1', 'waiters'],
  ['riders', '/api/staff/riders/x1', 'riders'],
  ['tables', '/api/staff/tables/x1', 'diningTables'],
  ['employees', '/api/employees/x1', 'employees'],
  ['roles', '/api/roles/x1', 'roles'],
  ['categories', '/api/categories/x1', 'categories'],
  ['variants', '/api/variants/x1', 'variants'],
  ['menu items', '/api/menu-items/x1', 'menuItems'],
  ['deals', '/api/deals/x1', 'deals'],
  ['expenses', '/api/expenses/x1', 'expenses'],
];

describe.each(ENDPOINTS)('DELETE %s', (_label, path, type) => {
  const id = path.split('/').pop()!.split('?')[0];

  it(`DELETE ${path} calls softDelete(${type}, id, token user)`, async () => {
    const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Moved to the Recycle Bin' });
    expect(state.softDelete).toHaveBeenCalledWith(type, id, 'admin-1');
    expect(state.statements.some((s) => /^DELETE FROM|^UPDATE (orderItems|pastOrderItems)/.test(s))).toBe(false);
  });

  it('maps a 409 from the service to HTTP 409 with its message', async () => {
    state.softDelete = vi.fn(async () => ({ ok: false, status: 409, error: 'Used by 2 live menu items (A, B)' }));

    const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE' });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Used by 2 live menu items (A, B)' });
  });
});

describe('users keep their authorization checks', () => {
  it('still refuses to delete your own account without calling the service', async () => {
    const res = await fetch(`${baseUrl}/api/users/admin-1?adminUserId=admin-1`, { method: 'DELETE' });

    expect(res.status).toBe(400);
    expect(state.softDelete).not.toHaveBeenCalled();
  });
});

describe('list routes hide Recycle Bin rows', () => {
  beforeEach(() => {
    state.waiters = [
      { id: 'w1', name: 'Live', deletedAt: null },
      { id: 'w2', name: 'Gone', deletedAt: '2026-11-01T00:00:00.000Z' },
    ];
  });

  it('GET /api/waiters omits deleted rows', async () => {
    const rows = await (await fetch(`${baseUrl}/api/staff/waiters`)).json();

    expect(rows.map((r: any) => r.id)).toEqual(['w1']);
  });

  it('GET /api/waiters?includeDeleted=true includes them', async () => {
    const rows = await (await fetch(`${baseUrl}/api/staff/waiters?includeDeleted=true`)).json();

    expect(rows.map((r: any) => r.id)).toEqual(['w1', 'w2']);
  });

  it('includeDeleted only counts when it is exactly "true"', async () => {
    const rows = await (await fetch(`${baseUrl}/api/staff/waiters?includeDeleted=1`)).json();

    expect(rows.map((r: any) => r.id)).toEqual(['w1']);
  });

  it('every list query filters deletedAt', async () => {
    for (const p of ['/api/users', '/api/customers', '/api/staff/riders', '/api/staff/tables', '/api/employees',
      '/api/roles', '/api/categories', '/api/variants', '/api/menu-items', '/api/deals', '/api/expenses']) {
      state.statements.length = 0;
      await fetch(`${baseUrl}${p}`);
      expect(state.statements.at(-1), p).toContain('deletedAt IS NULL');
    }
  });
});

describe('single-record reads stay unfiltered', () => {
  it('GET /api/menu-items/:id returns a deleted item', async () => {
    state.menuItem = { id: 'm1', name: 'Zinger', deletedAt: '2026-11-01T00:00:00.000Z' };

    const res = await fetch(`${baseUrl}/api/menu-items/m1`);

    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe('m1');
    expect(state.statements.find((s) => s.startsWith('SELECT * FROM menuItems WHERE id'))).not.toContain('deletedAt');
  });

  it('phone lookup ignores a deleted customer with the same phone', async () => {
    state.customers = [{ id: 'c1', phone: '0300', name: 'Old', deletedAt: '2026-11-01T00:00:00.000Z' }];

    const res = await fetch(`${baseUrl}/api/customers/phone/0300`);

    expect(await res.json()).toBeNull();
  });
});

describe('menu item delete', () => {
  it('no longer unlinks order items', async () => {
    await fetch(`${baseUrl}/api/menu-items/m1`, { method: 'DELETE' });

    expect(state.statements.some((s) => s.startsWith('UPDATE orderItems'))).toBe(false);
    expect(state.statements.some((s) => s.startsWith('UPDATE pastOrderItems'))).toBe(false);
  });
});

describe('expenses', () => {
  it('expense summary excludes deleted expenses', async () => {
    await fetch(`${baseUrl}/api/expenses/summary/by-category?includeDeleted=true`);

    expect(state.statements.at(-1)).toContain('deletedAt IS NULL');
  });
});
