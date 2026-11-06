import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.hoisted(() => ({
  getRecycleBin: vi.fn(),
  restoreRecycleItem: vi.fn(),
  deleteRecycleItemForever: vi.fn(),
}));

vi.mock('@/services/api', () => ({ apiClient }));

import { deleteForever, describeForeverDelete, listRecycleBin, restore } from './recycleBinService';

const entry = (o: Record<string, unknown> = {}) => ({
  type: 'menuItems', typeLabel: 'Menu item', id: 'm1', name: 'Zinger',
  deletedAt: '2026-11-06T00:00:00Z', deletedBy: 'u1', deletedByName: 'Admin', usedBy: [], ...o,
});

beforeEach(() => vi.clearAllMocks());

describe('recycleBinService', () => {
  it('lists the bin, optionally for one type', async () => {
    apiClient.getRecycleBin.mockResolvedValue([entry()]);
    expect(await listRecycleBin('menuItems')).toHaveLength(1);
    expect(apiClient.getRecycleBin).toHaveBeenCalledWith('menuItems');
    await listRecycleBin();
    expect(apiClient.getRecycleBin).toHaveBeenLastCalledWith(undefined);
  });

  it('restore calls POST /recycle-bin/menuItems/<id>/restore', async () => {
    apiClient.restoreRecycleItem.mockResolvedValue({ message: 'Restored' });
    await restore('menuItems', 'm1');
    expect(apiClient.restoreRecycleItem).toHaveBeenCalledWith('menuItems', 'm1');
  });

  it('deleteForever returns the server outcome', async () => {
    apiClient.deleteRecycleItemForever.mockResolvedValue({ outcome: 'tombstoned' });
    expect(await deleteForever('menuItems', 'm1')).toBe('tombstoned');
  });

  it('describes a used item with where it is used', () => {
    const text = describeForeverDelete(entry({ usedBy: [{ label: 'order items', count: 12 }, { label: 'deals', count: 1 }] }) as never);
    expect(text).toBe('"Zinger" is used by 12 order items, 1 deals. It will stay on that history as "Zinger (Deleted)" and cannot be restored.');
  });

  it('describes an unused item as removed completely', () => {
    expect(describeForeverDelete(entry() as never)).toBe('"Zinger" is not used anywhere and will be removed completely.');
  });
});
