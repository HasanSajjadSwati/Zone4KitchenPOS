import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecycleBinActions } from './recycleBinActions';
import type { BinEntry } from './recycleBinService';

const entry: BinEntry = {
  type: 'categories', typeLabel: 'Category', id: 'c1', name: 'Drinks',
  deletedAt: '2026-11-06T00:00:00Z', deletedBy: 'u1', deletedByName: 'Admin',
  usedBy: [{ label: 'menu items', count: 3 }],
};

const deps = {
  restore: vi.fn(), deleteForever: vi.fn(), confirm: vi.fn(), alert: vi.fn(), reload: vi.fn(),
};
const make = () => createRecycleBinActions(deps);

beforeEach(() => {
  vi.resetAllMocks();
  deps.restore.mockResolvedValue(undefined);
  deps.deleteForever.mockResolvedValue('removed');
  deps.confirm.mockResolvedValue(true);
  deps.alert.mockResolvedValue(undefined);
  deps.reload.mockResolvedValue(undefined);
});

describe('recycle bin actions', () => {
  it('restore success reloads the list without an alert', async () => {
    await make().restore(entry);
    expect(deps.restore).toHaveBeenCalledWith('categories', 'c1');
    expect(deps.reload).toHaveBeenCalledTimes(1);
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('restore 409 shows the server message verbatim and still reloads', async () => {
    deps.restore.mockRejectedValue(new Error('Restore category Food first'));
    await make().restore(entry);
    expect(deps.alert).toHaveBeenCalledWith('Restore category Food first', 'Cannot restore');
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it('delete forever cancelled sends nothing', async () => {
    deps.confirm.mockResolvedValue(false);
    await make().deleteForever(entry);
    expect(deps.deleteForever).not.toHaveBeenCalled();
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('delete forever confirmed asks with the used-by text, deletes and reloads', async () => {
    await make().deleteForever(entry);
    expect(deps.confirm.mock.calls[0][0].message).toBe(
      '"Drinks" is used by 3 menu items. It will stay on that history as "Drinks (Deleted)" and cannot be restored.',
    );
    expect(deps.deleteForever).toHaveBeenCalledWith('categories', 'c1');
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it('delete forever failure is shown verbatim', async () => {
    deps.deleteForever.mockRejectedValue(new Error('Nope'));
    await make().deleteForever(entry);
    expect(deps.alert).toHaveBeenCalledWith('Nope', 'Cannot delete');
  });

  it('a second restore while the first is pending is ignored, and busy is reported', async () => {
    let release!: () => void;
    deps.restore.mockReturnValue(new Promise<void>((r) => { release = r; }));
    const actions = make();
    const first = actions.restore(entry);
    expect(actions.isBusy(entry)).toBe(true);
    await actions.restore(entry);
    expect(deps.restore).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(actions.isBusy(entry)).toBe(false);
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it('a delete forever click while a restore is pending is ignored before confirming', async () => {
    deps.restore.mockReturnValue(new Promise(() => undefined));
    const actions = make();
    void actions.restore(entry);
    await actions.deleteForever(entry);
    expect(deps.confirm).not.toHaveBeenCalled();
  });
});
