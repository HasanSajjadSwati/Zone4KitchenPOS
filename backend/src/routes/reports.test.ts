import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const seen = vi.hoisted(() => ({
  statements: [] as string[],
  // Rows a test wants back for a statement (matched on its normalised text); default is none.
  respond: null as null | ((sql: string) => any[] | undefined),
}));

// categories.isActive is BOOLEAN in Postgres, which rejects an integer literal there.
function postgresQuery(sql: string) {
  const text = sql.replace(/\s+/g, ' ').trim();
  seen.statements.push(text);
  if (/\b(isPaid|isActive)\s*=\s*[01]\b/i.test(text)) {
    throw new Error('operator does not exist: boolean = integer');
  }
  return seen.respond?.(text) ?? [];
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

const RANGE = 'startDate=2026-11-01T00:00:00.000Z&endDate=2026-11-06T23:59:59.999Z';
const LABEL = 'Deleted items (name not recorded)';
const get = async (path: string) => (await fetch(`${baseUrl}/${path}?${RANGE}`)).json() as Promise<any>;

beforeEach(() => {
  seen.statements.length = 0;
  seen.respond = null;
});
afterEach(() => {
  seen.respond = null;
});

describe('GET /api/reports/category-sales-detailed', () => {
  it('loads categories without an integer boolean comparison Postgres rejects', async () => {
    const res = await fetch(`${baseUrl}/category-sales-detailed?${RANGE}`);

    expect(res.status).toBe(200);
    expect(seen.statements.some((s) => s.includes('FROM categories'))).toBe(true);
  });

  it('keeps a deleted category that had sales and drops one that had none', async () => {
    const cat = (id: string, name: string, type: string, parentId: string | null, isActive = true, deletedAt: string | null = null) => ({
      id, name, type, parentId, sortOrder: 0, isActive, deletedAt,
    });
    seen.respond = (sql) => {
      if (sql.includes('"categoryType"')) {
        return [
          { categoryId: 'subGone', categoryName: 'Old Wraps', categoryType: 'sub', parentId: 'majLive', totalSales: '400', totalQuantity: '4', orderCount: '3', averagePrice: '100' },
          { categoryId: 'majGone', categoryName: 'Old Menu', categoryType: 'major', parentId: null, totalSales: '100', totalQuantity: '1', orderCount: '1', averagePrice: '100' },
          { categoryId: null, categoryName: null, categoryType: null, parentId: null, totalSales: '300', totalQuantity: '3', orderCount: '2', averagePrice: '100' },
        ];
      }
      if (sql.includes('FROM categories')) {
        return [
          cat('majLive', 'Fast Food', 'major', null),
          cat('subLive', 'Burgers', 'sub', 'majLive'),
          cat('subGone', 'Old Wraps', 'sub', 'majLive', false, '2026-11-05T00:00:00.000Z'),
          cat('subGoneNoSales', 'Old Rolls', 'sub', 'majLive', false, '2026-11-05T00:00:00.000Z'),
          cat('majGone', 'Old Menu', 'major', null, true, '2026-11-05T00:00:00.000Z'),
          cat('majGoneNoSales', 'Old Drinks', 'major', null, true, '2026-11-05T00:00:00.000Z'),
          cat('majInactive', 'Seasonal', 'major', null, false),
          cat('majLiveEmpty', 'Desserts', 'major', null),
        ];
      }
      return undefined;
    };

    const body = await get('category-sales-detailed');
    const names = body.map((m: any) => m.categoryName);

    expect(names).toContain('Fast Food');
    expect(names).toContain('Old Menu');
    expect(names).toContain('Desserts');
    expect(names).not.toContain('Old Drinks');
    expect(names).not.toContain('Seasonal');
    const fast = body.find((m: any) => m.categoryName === 'Fast Food');
    expect(fast.subCategories.map((s: any) => s.categoryName).sort()).toEqual(['Burgers', 'Old Wraps']);
    expect(fast.totalSales).toBe(400);
    const label = body.find((m: any) => m.categoryName === LABEL);
    expect(label).toMatchObject({ categoryId: null, totalSales: 300, totalQuantity: 3, orderCount: 2, subCategories: [] });
  });

  it('has no label entry when every line is linked', async () => {
    seen.respond = (sql) =>
      sql.includes('"categoryType"')
        ? []
        : sql.includes('FROM categories')
          ? [{ id: 'maj', name: 'Fast Food', type: 'major', parentId: null, sortOrder: 0, isActive: true, deletedAt: null }]
          : undefined;

    const body = await get('category-sales-detailed');

    expect(body.map((m: any) => m.categoryName)).toEqual(['Fast Food']);
  });
});

describe('reports keep every sale', () => {
  it('item sales returns a "Deleted items (name not recorded)" row for unlinked lines', async () => {
    seen.respond = (sql) =>
      sql.includes('"itemName"')
        ? [
            { itemId: 'm1', itemName: 'Zinger', categoryId: 'c1', categoryName: 'Burgers', totalSales: '500', totalQuantity: '2', orderCount: '2', averagePrice: '250' },
            { itemId: null, itemName: null, categoryId: null, categoryName: null, totalSales: '300', totalQuantity: '3', orderCount: '2', averagePrice: '100' },
          ]
        : undefined;

    const body = await get('item-sales');

    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ itemId: 'm1', itemName: 'Zinger', totalSales: 500 });
    expect(body[1]).toEqual({ itemId: null, itemName: LABEL, categoryId: null, categoryName: null, totalSales: 300, totalQuantity: 3, orderCount: 2, averagePrice: 100 });
    const sql = seen.statements.find((s) => s.includes('"itemName"'))!;
    expect(sql).toMatch(/LEFT JOIN menuItems m ON m\.id = oi\.menuItemId/);
    expect(sql).not.toMatch(/(?<!LEFT )JOIN menuItems/);
  });

  it('item sales of a tombstoned item keeps its rows under "Zinger (Deleted)"', async () => {
    seen.respond = (sql) =>
      sql.includes('"itemName"')
        ? [{ itemId: 'm1', itemName: 'Zinger (Deleted)', categoryId: 'c1', categoryName: 'Burgers', totalSales: '500', totalQuantity: '2', orderCount: '2', averagePrice: '250' }]
        : undefined;

    const body = await get('item-sales');

    expect(body).toHaveLength(1);
    expect(body[0].itemName).toBe('Zinger (Deleted)');
    expect(body[0].itemId).toBe('m1');
  });

  it('deal sales does the same for deals', async () => {
    seen.respond = (sql) =>
      sql.includes('"dealName"')
        ? [
            { dealId: 'd1', dealName: 'Family Deal', totalSales: '900', totalQuantity: '1', orderCount: '1', averagePrice: '900' },
            { dealId: null, dealName: null, totalSales: '200', totalQuantity: '2', orderCount: '2', averagePrice: '100' },
          ]
        : undefined;

    const body = await get('deal-sales');

    expect(body.map((r: any) => [r.dealId, r.dealName])).toEqual([['d1', 'Family Deal'], [null, LABEL]]);
    const sql = seen.statements.find((s) => s.includes('"dealName"'))!;
    expect(sql).toMatch(/LEFT JOIN deals d ON d\.id = oi\.dealId/);
    expect(sql).toContain("oi.itemType = 'deal'");
  });

  it('category sales counts unlinked menu-item lines under the label and never deal lines', async () => {
    seen.respond = (sql) =>
      sql.includes('"categoryName"') && !sql.includes('"categoryType"')
        ? [
            { categoryId: 'c1', categoryName: 'Burgers', totalSales: '500', totalQuantity: '2', orderCount: '2', averagePrice: '250' },
            { categoryId: null, categoryName: null, totalSales: '300', totalQuantity: '3', orderCount: '2', averagePrice: '100' },
          ]
        : undefined;

    const body = await get('category-sales');

    expect(body.map((r: any) => [r.categoryId, r.categoryName])).toEqual([['c1', 'Burgers'], [null, LABEL]]);
    const sql = seen.statements.find((s) => s.includes('"categoryName"') && !s.includes('"categoryType"'))!;
    expect(sql).toContain("oi.itemType = 'menu_item'");
    expect(sql).not.toContain("'deal'");
    expect(sql).toMatch(/LEFT JOIN menuItems m ON m\.id = oi\.menuItemId/);
    expect(sql).toMatch(/LEFT JOIN categories c ON c\.id = m\.categoryId/);
    expect(sql).toMatch(/m\.id IS NULL OR c\.id IS NOT NULL/);
  });
});
