import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  menuItems: { toArrayWithDeleted: vi.fn() },
  categories: { toArrayWithDeleted: vi.fn() },
  deals: { toArrayWithDeleted: vi.fn() },
  waiters: { toArrayWithDeleted: vi.fn() },
}));
const apiClient = vi.hoisted(() => ({
  getOrders: vi.fn(),
  getOrderItemsBulk: vi.fn(),
}));

vi.mock('@/db', () => ({ db }));
vi.mock('@/services/api', () => ({ apiClient }));

import { getWaiterPerformance, getCategorySales, getCategorySalesDetailed, getDealSales, getItemSales } from './reportService';
import { DELETED_ITEMS_LABEL } from '@/constants/recycle';

const range = { startDate: new Date('2026-11-01T00:00:00Z'), endDate: new Date('2026-11-06T23:59:59Z') };
const line = (o: Record<string, unknown>) => ({ itemType: 'menu_item', menuItemId: null, dealId: null, quantity: 1, ...o });

beforeEach(() => {
  vi.clearAllMocks();
  apiClient.getOrders.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }]);
  db.menuItems.toArrayWithDeleted.mockResolvedValue([{ id: 'm1', name: 'Zinger', categoryId: 'sub1' }]);
  db.deals.toArrayWithDeleted.mockResolvedValue([{ id: 'd1', name: 'Family Deal' }]);
  db.categories.toArrayWithDeleted.mockResolvedValue([
    { id: 'maj1', name: 'Fast Food', type: 'major', parentId: null, isActive: true },
    { id: 'sub1', name: 'Burgers', type: 'sub', parentId: 'maj1', isActive: true },
    { id: 'majGone', name: 'Old Drinks', type: 'major', parentId: null, isActive: true, deletedAt: '2026-11-05T00:00:00Z' },
  ]);
  apiClient.getOrderItemsBulk.mockResolvedValue([
    line({ orderId: 'o1', menuItemId: 'm1', totalPrice: 500, quantity: 2 }),
    line({ orderId: 'o1', menuItemId: null, totalPrice: 100, quantity: 1 }), // old delete: id nulled
    line({ orderId: 'o2', menuItemId: 'gone', totalPrice: 200, quantity: 2 }), // id points at nothing
    line({ orderId: 'o3', menuItemId: null, totalPrice: 50, quantity: 1 }),
    line({ itemType: 'deal', orderId: 'o1', dealId: 'd1', totalPrice: 900 }),
    line({ itemType: 'deal', orderId: 'o2', dealId: null, totalPrice: 300, quantity: 3 }),
    line({ itemType: 'deal', orderId: 'o3', dealId: 'gone', totalPrice: 80, quantity: 2 }),
  ]);
});

describe('register-session reports keep every sale', () => {
  it('session item sales adds the label row with the same totals the server computes', async () => {
    const rows = await getItemSales(range, 'session-1');

    expect(rows.map((r) => [r.itemId, r.itemName, r.totalSales, r.totalQuantity, r.orderCount])).toEqual([
      ['m1', 'Zinger', 500, 2, 1],
      [null, DELETED_ITEMS_LABEL, 350, 4, 3],
    ]);
    const label = rows[1];
    expect(label.categoryId).toBeNull();
    expect(label.categoryName).toBeNull();
    expect(label.averagePrice).toBe(87.5);
    expect(rows.reduce((s, r) => s + r.totalSales, 0)).toBe(850);
  });

  it('session deal sales adds the label row for null and missing deals', async () => {
    const rows = await getDealSales(range, 'session-1');

    expect(rows.map((r) => [r.dealId, r.dealName, r.totalSales, r.totalQuantity, r.orderCount])).toEqual([
      ['d1', 'Family Deal', 900, 1, 1],
      [null, DELETED_ITEMS_LABEL, 380, 5, 2],
    ]);
  });

  it('session category sales counts unlinked menu-item lines under the label and never deal lines', async () => {
    const rows = await getCategorySales(range, 'session-1');

    expect(rows.map((r) => [r.categoryId, r.categoryName, r.totalSales])).toEqual([
      ['sub1', 'Burgers', 500],
      [null, DELETED_ITEMS_LABEL, 350],
    ]);
  });

  it('session detailed tree appends the label entry and hides an unsold deleted category', async () => {
    const tree = await getCategorySalesDetailed(range, 'session-1');

    expect(tree.map((m) => m.categoryName)).toEqual(['Fast Food', DELETED_ITEMS_LABEL]);
    expect(tree[0].totalSales).toBe(500);
    expect(tree[1]).toMatchObject({ categoryId: null, totalSales: 350, totalQuantity: 4, orderCount: 3, subCategories: [] });
  });
});

describe('history resolves rows deleted after the sale', () => {
  it('waiter performance resolves a deleted waiter\'s name', async () => {
    apiClient.getOrders.mockResolvedValue([{ id: 'o1', waiterId: 'w1', total: 400, tableId: 't1' }]);
    db.waiters.toArrayWithDeleted.mockResolvedValue([
      { id: 'w1', name: 'Ali', deletedAt: '2026-11-05T00:00:00Z' },
    ]);

    const rows = await getWaiterPerformance(range);

    expect(rows.map((r) => [r.waiterId, r.waiterName, r.totalSales])).toEqual([['w1', 'Ali', 400]]);
  });
});
