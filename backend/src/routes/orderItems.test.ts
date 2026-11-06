import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const db = vi.hoisted(() => ({
  allAsync: vi.fn(async (_sql: string, _params?: any[]) => [] as any[]),
}));

vi.mock('../db/database.js', () => ({
  allAsync: db.allAsync,
  convertBooleans: (row: any) => row,
}));

import { orderItemRoutes } from './orderItems.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/order-items', orderItemRoutes);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/order-items`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  db.allAsync.mockClear();
});

const lastQuery = () => {
  const [sql, params] = db.allAsync.mock.calls[0];
  return { sql: sql.replace(/\s+/g, ' '), params };
};

describe('GET /api/order-items ids filter', () => {
  it('returns only the requested items instead of the whole table', async () => {
    db.allAsync.mockResolvedValueOnce([{ id: 'item-1', orderId: 'order-1', selectedVariants: null, dealBreakdown: null }]);

    const res = await fetch(`${baseUrl}?ids=item-1`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'item-1', orderId: 'order-1', selectedVariants: [], dealBreakdown: null }]);
    const { sql, params } = lastQuery();
    expect(sql).toContain('WHERE oi.id IN (?)');
    expect(params).toEqual(['item-1']);
  });

  it('accepts a comma-separated list of ids', async () => {
    await fetch(`${baseUrl}?ids=item-1,item-2`);

    const { sql, params } = lastQuery();
    expect(sql).toContain('oi.id IN (?,?)');
    expect(params).toEqual(['item-1', 'item-2']);
  });

  it('combines ids with orderIds', async () => {
    await fetch(`${baseUrl}?orderIds=order-1&ids=item-1`);

    const { sql, params } = lastQuery();
    expect(sql).toContain('oi.orderId IN (?)');
    expect(sql).toContain('oi.id IN (?)');
    expect(params).toEqual(['order-1', 'item-1']);
  });
});
