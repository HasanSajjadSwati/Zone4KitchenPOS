import { describeForeverDelete, type BinEntry } from '@/services/recycleBinService';

// The Recycle Bin screen's behaviour, kept free of React so it can be tested in node.
export interface RecycleBinDeps {
  restore: (type: string, id: string) => Promise<unknown>;
  deleteForever: (type: string, id: string) => Promise<unknown>;
  confirm: (params: {
    title: string;
    message: string;
    variant: 'danger';
    confirmLabel: string;
    cancelLabel: string;
  }) => Promise<boolean>;
  alert: (message: string, title: string) => Promise<unknown>;
  reload: () => Promise<unknown>;
  onBusyChange?: (busyKeys: ReadonlySet<string>) => void;
}

export const binKey = (e: Pick<BinEntry, 'type' | 'id'>) => `${e.type}:${e.id}`;

export function createRecycleBinActions(deps: RecycleBinDeps) {
  const busy = new Set<string>();
  const setBusy = (key: string, on: boolean) => {
    if (on) busy.add(key);
    else busy.delete(key);
    deps.onBusyChange?.(new Set(busy));
  };

  // Runs one row's action; a second click on the same row while it is in flight is ignored.
  const guarded = async (entry: BinEntry, failTitle: string, failText: string, run: () => Promise<void>) => {
    const key = binKey(entry);
    if (busy.has(key)) return;
    setBusy(key, true);
    try {
      await run();
    } catch (error) {
      // The server's message is written for people (e.g. "Restore category Drinks first"): show it verbatim.
      await deps.alert(error instanceof Error ? error.message : failText, failTitle);
    } finally {
      setBusy(key, false);
    }
    // Reload after success or failure so the list reflects what the server now holds.
    await deps.reload();
  };

  return {
    isBusy: (entry: BinEntry) => busy.has(binKey(entry)),
    restore: (entry: BinEntry) =>
      guarded(entry, 'Cannot restore', 'Failed to restore', async () => {
        await deps.restore(entry.type, entry.id);
      }),
    deleteForever: async (entry: BinEntry) => {
      if (busy.has(binKey(entry))) return;
      const confirmed = await deps.confirm({
        title: 'Delete forever',
        message: describeForeverDelete(entry),
        variant: 'danger',
        confirmLabel: 'Delete forever',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
      await guarded(entry, 'Cannot delete', 'Failed to delete', async () => {
        await deps.deleteForever(entry.type, entry.id);
      });
    },
  };
}
