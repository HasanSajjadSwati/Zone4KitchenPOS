import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const seen = vi.hoisted(() => ({ statements: [] as string[] }));

// categories.isActive is BOOLEAN in Postgres, which rejects an integer literal there.
function postgresQuery(sql: string) {
  const text = sql.replace(/\s+/g, ' ').trim();
  seen.statements.push(text);
  if (/\b(isPaid|isActive)\s*=\s*[01]\b/i.test(text)) {
    throw new Error('operator does not exist: boolean = integer');
  }
  return [];
}

vi.mock('../db/database.js', () => ({
  allAsync: vi.fn(async (sql: string) => postgresQuery(sql)),
  getAsync: vi.fn(async (sql: string) => postgresQuery(sql)[0]),
}));

import { reportRoutes } from './reports.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/reports', reportRoutes);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/reports`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('GET /api/reports/category-sales-detailed', () => {
  it('loads the active categories with a boolean comparison Postgres accepts', async () => {
    const res = await fetch(`${baseUrl}/category-sales-detailed?startDate=2026-11-01T00:00:00.000Z&endDate=2026-11-06T23:59:59.999Z`);

    expect(res.status).toBe(200);
    expect(seen.statements.some((s) => s.includes('FROM categories WHERE isActive = TRUE'))).toBe(true);
  });
});
