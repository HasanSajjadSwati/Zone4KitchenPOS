import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getOrderItem: vi.fn(),
  getOrderItemsBulk: vi.fn(),
  updateOrderItem: vi.fn(),
  deleteOrderItem: vi.fn(),
  getMenuItems: vi.fn(),
}));

vi.mock('@/services/api', () => ({ apiClient: api }));

import { db } from './index';

const ITEM = { id: 'item-1', orderId: 'order-1', quantity: 2 };

beforeEach(() => {
  vi.clearAllMocks();
});

// The order-items table holds every item ever sold (17 MB+ in production). Touching one
// item must never download all of it.
describe('db.orderItems single-item access', () => {
  it('get(id) asks the server for that one item', async () => {
    api.getOrderItem.mockResolvedValue(ITEM);

    expect(await db.orderItems.get('item-1')).toEqual(ITEM);
    expect(api.getOrderItem).toHaveBeenCalledWith('item-1');
    expect(api.getOrderItemsBulk).not.toHaveBeenCalled();
  });

  it('update(id) looks the item up by id, then updates it under its order', async () => {
    api.getOrderItem.mockResolvedValue(ITEM);

    await db.orderItems.update('item-1', { lastPrintedAt: 'now' });

    expect(api.updateOrderItem).toHaveBeenCalledWith('order-1', 'item-1', { lastPrintedAt: 'now' });
    expect(api.getOrderItemsBulk).not.toHaveBeenCalled();
  });

  it('update(id) of an unknown item is a no-op', async () => {
    api.getOrderItem.mockResolvedValue(null);

    expect(await db.orderItems.update('missing', { quantity: 1 })).toBeNull();
    expect(api.updateOrderItem).not.toHaveBeenCalled();
  });

  it('delete(id) looks the item up by id, then deletes it under its order', async () => {
    api.getOrderItem.mockResolvedValue(ITEM);

    await db.orderItems.delete('item-1');

    expect(api.deleteOrderItem).toHaveBeenCalledWith('order-1', 'item-1');
    expect(api.getOrderItemsBulk).not.toHaveBeenCalled();
  });
});

describe('db toArrayWithDeleted', () => {
  it('menuItems.toArrayWithDeleted() asks for deleted rows', async () => {
    api.getMenuItems.mockResolvedValue([]);
    await db.menuItems.toArrayWithDeleted();
    expect(api.getMenuItems).toHaveBeenCalledWith({ includeDeleted: true });
  });

  it('menuItems.toArray() does not', async () => {
    api.getMenuItems.mockResolvedValue([]);
    await db.menuItems.toArray();
    expect(api.getMenuItems).toHaveBeenCalledWith();
  });
});
