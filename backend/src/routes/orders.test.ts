import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// The live auditLogs table: userId is NOT NULL (FK to users) and action must be one of these.
const ALLOWED_AUDIT_ACTIONS = ['create', 'update', 'delete', 'print', 'export', 'login', 'logout', 'backup', 'restore', 'wipe', 'import'];

const state = vi.hoisted(() => ({
  orders: new Map<string, Record<string, any>>(),
  users: new Map<string, { id: string; fullName: string; roleName: string }>(),
  audits: [] as Array<{ userId: string | null; action: string; tableName: string; recordId: string; description: string }>,
  listQueries: [] as string[],
  deleted: new Set<string>(),
  items: [] as string[],
}));

// isPaid/isActive are BOOLEAN in Postgres, which rejects an integer literal there.
function assertPostgresBooleans(sql: string) {
  if (/\b(isPaid|isActive)\s*=\s*[01]\b/i.test(sql)) {
    throw new Error('operator does not exist: boolean = integer');
  }
}

function fakeQuery(sql: string, params: any[] = []) {
  const text = sql.replace(/\s+/g, ' ').trim();
  assertPostgresBooleans(text);
  if (text.startsWith('SELECT COUNT(*) as total FROM orders')) {
    state.listQueries.push(text);
    return { total: 0 };
  }
  if (text.startsWith('UPDATE orders SET') && !text.startsWith('UPDATE orders SET isPaid')) return { rowCount: 1 };
  if (text.startsWith('UPDATE orders SET isPaid')) {
    Object.assign(state.orders.get(params[1])!, { isPaid: false, status: 'open', updatedAt: params[0] });
    return { rowCount: 1 };
  }
  if (text.startsWith('SELECT * FROM orders WHERE id')) {
    const order = state.orders.get(params[0]);
    return order ? { ...order } : undefined;
  }
  if (text.startsWith('SELECT u.id, u.fullName, r.name as roleName FROM users u')) {
    return state.users.get(params[0]);
  }
  if (text.startsWith('INSERT INTO auditLogs')) {
    const [, userId, action, tableName, recordId, , , description] = params;
    if (userId == null) throw new Error('null value in column "userid" of relation "auditlogs" violates not-null constraint');
    if (!ALLOWED_AUDIT_ACTIONS.includes(action)) throw new Error('violates check constraint "auditlogs_action_check"');
    state.audits.push({ userId, action, tableName, recordId, description });
    return { rowCount: 1 };
  }
  const exists = text.match(/^SELECT 1 FROM (\w+) WHERE id = \?( AND deletedAt IS NULL)?$/);
  if (exists) {
    const id = params[0];
    return exists[1] === 'registerSessions' || exists[1] === 'users' || !(exists[2] && state.deleted.has(id)) ? { '?column?': 1 } : undefined;
  }
  const deletedAtRow = text.match(/^SELECT deletedAt FROM (menuItems|deals) WHERE id = \?$/);
  if (deletedAtRow) return { deletedAt: state.deleted.has(params[0]) ? '2026-11-01T00:00:00.000Z' : null };
  if (text.startsWith('INSERT INTO orderItems')) {
    state.items.push(params[0]);
    return { rowCount: 1 };
  }
  if (text.startsWith('SELECT * FROM orderItems WHERE id')) return { id: params[0] };
  throw new Error(`Unexpected SQL in test: ${text}`);
}

vi.mock('../db/database.js', () => ({
  getAsync: vi.fn(async (sql: string, params?: any[]) => fakeQuery(sql, params)),
  runAsync: vi.fn(async (sql: string, params?: any[]) => fakeQuery(sql, params)),
  allAsync: vi.fn(async (sql: string) => {
    assertPostgresBooleans(sql);
    return [];
  }),
  convertBooleans: (row: any) => row,
  convertBooleansArray: (rows: any[]) => rows,
}));
vi.mock('../websocket.js', () => ({ broadcastSync: vi.fn() }));

import { orderRoutes } from './orders.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.authUser = { id: 'cashier-1', username: 'cashier' };
    next();
  });
  app.use('/api/orders', orderRoutes);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/orders`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  state.orders.clear();
  state.users.clear();
  state.audits.length = 0;
  state.listQueries.length = 0;
  state.deleted.clear();
  state.items.length = 0;
  state.orders.set('order-1', { id: 'order-1', isPaid: true, status: 'completed', subtotal: 1000, discountAmount: 0, total: 1000 });
});

const send = (method: string, path: string, body: Record<string, unknown>) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('order modification audit trail', () => {
  it('records a blocked change to a paid order against the logged-in user', async () => {
    // No x-user-id header and no userId in the body: the till often sends neither.
    const res = await send('PUT', '/order-1', { total: 1 });

    expect(res.status).toBe(403);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({ userId: 'cashier-1', action: 'update', tableName: 'orders', recordId: 'order-1' });
    expect(state.audits[0].description).toMatch(/^\[BLOCKED_UPDATE_ORDER\] /);
  });

  it('records a blocked admin unlock with an action the audit table accepts', async () => {
    state.users.set('staff-1', { id: 'staff-1', fullName: 'Staff One', roleName: 'Cashier' });

    const res = await send('POST', '/order-1/admin-unlock', { adminUserId: 'staff-1', reason: 'customer asked for a change' });

    expect(res.status).toBe(403);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({ userId: 'staff-1', action: 'update' });
    expect(state.audits[0].description).toMatch(/^\[BLOCKED_ADMIN_UNLOCK\] /);
  });
});

describe('boolean columns in order SQL', () => {
  it.each(['true', 'false'])('filters the orders list by isPaid=%s', async (isPaid) => {
    const res = await fetch(`${baseUrl}?isPaid=${isPaid}&limit=50`);

    expect(res.status).toBe(200);
    expect(state.listQueries[0]).toContain(`isPaid = ${isPaid.toUpperCase()}`);
  });

  it('lets an admin unlock a paid order', async () => {
    state.users.set('admin-1', { id: 'admin-1', fullName: 'Owner', roleName: 'Admin' });

    const res = await send('POST', '/order-1/admin-unlock', { adminUserId: 'admin-1', reason: 'wrong item charged, refunding' });

    expect(res.status).toBe(200);
    expect(state.orders.get('order-1')).toMatchObject({ isPaid: false, status: 'open' });
    expect(state.audits[0]).toMatchObject({ userId: 'admin-1', action: 'update' });
    expect(state.audits[0].description).toMatch(/^\[ADMIN_UNLOCK_ORDER\] /);
  });
});

describe('deleted records cannot start new work', () => {
  const item = { itemType: 'menuItem', quantity: 1, unitPrice: 100, totalPrice: 100 };

  beforeEach(() => {
    state.orders.set('order-open', { id: 'order-open', isPaid: false, status: 'open', subtotal: 0, discountAmount: 0, total: 0 });
  });

  it('adding a deleted menu item to an order is 400', async () => {
    state.deleted.add('menu-1');
    const res = await send('POST', '/order-open/items', { ...item, menuItemId: 'menu-1' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This menu item has been deleted' });
    expect(state.items).toHaveLength(0);
  });

  it('adding a deleted deal to an order is 400', async () => {
    state.deleted.add('deal-1');
    const res = await send('POST', '/order-open/items', { ...item, itemType: 'deal', dealId: 'deal-1' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This deal has been deleted' });
  });

  it('a completed order keeps its deleted waiter: resending the same waiterId is 200, changing to another deleted waiter is 400', async () => {
    state.orders.set('order-done', { id: 'order-done', isPaid: false, status: 'completed', waiterId: 'waiter-old', subtotal: 0, discountAmount: 0, total: 0 });
    state.deleted.add('waiter-old');
    state.deleted.add('waiter-other');

    expect((await send('PUT', '/order-done', { waiterId: 'waiter-old', notes: 'x' })).status).toBe(200);

    const res = await send('PUT', '/order-done', { waiterId: 'waiter-other' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This waiter has been deleted' });
  });

  it('creating an order with a deleted waiter is 400', async () => {
    state.deleted.add('waiter-1');
    const res = await send('POST', '/', { registerSessionId: 's1', orderType: 'dine-in', createdBy: 'cashier-1', waiterId: 'waiter-1' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This waiter has been deleted' });
  });
});
