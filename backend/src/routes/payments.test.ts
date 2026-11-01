import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// In-memory stand-in for the rows the payment routes touch.
const state = vi.hoisted(() => ({
  orders: new Map<string, { total: number }>(),
  payments: [] as Array<Record<string, any>>,
  audits: [] as Array<{ action: string; description: string; userId: string | null }>,
}));

function fakeQuery(sql: string, params: any[] = []) {
  const text = sql.replace(/\s+/g, ' ').trim();
  if (text.startsWith('SELECT total FROM orders')) {
    const order = state.orders.get(params[0]);
    return order ? { ...order } : undefined;
  }
  if (text.startsWith('SELECT COALESCE(SUM(amount), 0) AS paid FROM payments')) {
    const paid = state.payments.filter((p) => p.orderId === params[0]).reduce((s, p) => s + p.amount, 0);
    return { paid };
  }
  if (text.startsWith('INSERT INTO payments')) {
    const [id, orderId, amount, method, reference, paidAt, receivedBy, notes, createdAt] = params;
    state.payments.push({ id, orderId, amount, method, reference, paidAt, receivedBy, notes, createdAt });
    return { rowCount: 1 };
  }
  if (text.startsWith('SELECT * FROM payments WHERE id')) {
    return state.payments.find((p) => p.id === params[0]);
  }
  if (text.startsWith('INSERT INTO auditLogs')) {
    const [, userId, action, , , , , description] = params;
    state.audits.push({ userId, action, description });
    return { rowCount: 1 };
  }
  if (text.startsWith('UPDATE payments SET')) {
    const payment = state.payments.find((p) => p.id === params[4]);
    if (payment) Object.assign(payment, { amount: params[0], method: params[1], reference: params[2], notes: params[3] });
    return { rowCount: payment ? 1 : 0 };
  }
  throw new Error(`Unexpected SQL in test: ${text}`);
}

vi.mock('../db/database.js', () => ({
  getAsync: vi.fn(async (sql: string, params?: any[]) => fakeQuery(sql, params)),
  runAsync: vi.fn(async (sql: string, params?: any[]) => fakeQuery(sql, params)),
  allAsync: vi.fn(async () => []),
  withTransaction: vi.fn(async (fn: (tx: any) => Promise<any>) =>
    fn({
      getAsync: async (sql: string, params?: any[]) => fakeQuery(sql, params),
      runAsync: async (sql: string, params?: any[]) => fakeQuery(sql, params),
    })
  ),
}));
vi.mock('../websocket.js', () => ({ broadcastSync: vi.fn() }));

import { paymentRoutes } from './payments.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.authUser = { id: 'admin-1', username: 'admin' };
    next();
  });
  app.use('/api/payments', paymentRoutes);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/payments`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  state.orders.clear();
  state.payments.length = 0;
  state.audits.length = 0;
  state.orders.set('order-1', { total: 1200 });
});

const pay = (body: Record<string, unknown>) =>
  fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: 'order-1', method: 'cash', receivedBy: 'cashier-1', ...body }),
  });

describe('POST /api/payments overpayment guard', () => {
  it('records a payment that settles the order', async () => {
    const res = await pay({ id: 'p1', amount: 1200 });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: 'p1', orderId: 'order-1', amount: 1200 });
    expect(state.payments).toHaveLength(1);
  });

  it('rejects a second full payment for an order that is already paid', async () => {
    await pay({ id: 'p1', amount: 1200 });
    const res = await pay({ id: 'p2', amount: 1200 });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Order is already fully paid' });
    expect(state.payments.map((p) => p.id)).toEqual(['p1']);
  });

  it('rejects a payment larger than the outstanding balance', async () => {
    await pay({ id: 'p1', amount: 500 });
    const res = await pay({ id: 'p2', amount: 800 });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Payment of 800 exceeds the outstanding balance of 700');
    expect(state.payments).toHaveLength(1);
  });

  it('accepts a payment for exactly the outstanding balance', async () => {
    await pay({ id: 'p1', amount: 500 });
    const res = await pay({ id: 'p2', amount: 700 });

    expect(res.status).toBe(201);
    expect(state.payments).toHaveLength(2);
  });

  it('returns 404 for an unknown order', async () => {
    const res = await pay({ id: 'p1', orderId: 'missing', amount: 100 });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Order not found' });
  });

  it('still rejects missing required fields', async () => {
    const res = await pay({ amount: undefined });

    expect(res.status).toBe(400);
  });
});

describe('payment audit rows', () => {
  it('writes the create audit with an action the auditlogs table accepts', async () => {
    await pay({ id: 'p1', amount: 1200 });

    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].action).toBe('create');
    expect(state.audits[0].description).toMatch(/^\[CREATE_PAYMENT\] Payment of 1200 created via cash/);
    expect(state.audits[0].userId).toBe('cashier-1');
  });

  it('writes the update audit as the signed-in user', async () => {
    await pay({ id: 'p1', amount: 1200 });
    await fetch(`${baseUrl}/p1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'card' }),
    });

    expect(state.audits[1]).toMatchObject({ action: 'update', userId: 'admin-1' });
    expect(state.audits[1].description).toMatch(/^\[UPDATE_PAYMENT\]/);
  });

  it('writes the blocked-delete audit as a delete by the signed-in user', async () => {
    await pay({ id: 'p1', amount: 1200 });
    const res = await fetch(`${baseUrl}/p1`, { method: 'DELETE' });

    expect(res.status).toBe(403);
    expect(state.audits[1]).toMatchObject({ action: 'delete', userId: 'admin-1' });
    expect(state.audits[1].description).toMatch(/^\[BLOCKED_DELETE_PAYMENT\] BLOCKED/);
  });
});
