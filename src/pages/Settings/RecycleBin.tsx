import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { useDialog } from '@/hooks/useDialog';
import { RECYCLE_TYPES } from '@/constants/recycle';
import { deleteForever, listRecycleBin, restore, type BinEntry } from '@/services/recycleBinService';
import { binKey, createRecycleBinActions } from '@/services/recycleBinActions';
import { formatDateTime } from '@/utils/validation';

// Admin-only. Everything deleted from the app lands here; it can be restored, or removed for good.
export const RecycleBin: React.FC = () => {
  const dialog = useDialog();
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<BinEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setEntries(await listRecycleBin(type || undefined));
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to load the Recycle Bin', 'Error');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : entries;
  }, [entries, search]);

  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(new Set());
  const loadRef = useRef(load);
  loadRef.current = load;
  const actions = useMemo(
    () =>
      createRecycleBinActions({
        restore,
        deleteForever,
        confirm: (p) => dialog.confirm(p),
        alert: (m, t) => dialog.alert(m, t),
        reload: () => loadRef.current(),
        onBusyChange: setBusyKeys,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <Card padding="lg">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Recycle Bin</h2>
      <p className="text-sm text-gray-600 mb-6">
        Deleted items stay here so you can bring them back. Items already used on past orders or reports
        keep their name on that history as "(Deleted)".
      </p>

      <div className="flex flex-wrap gap-4 mb-6">
        <select
          aria-label="Filter by type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All</option>
          {RECYCLE_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Search by name"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[12rem] max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Type', 'Name', 'Deleted', 'Deleted by', 'Used by', ''].map((h) => (
                <th key={h || 'actions'} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visible.map((entry) => (
              <tr key={binKey(entry)}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.typeLabel}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{entry.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(entry.deletedAt)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.deletedByName || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {entry.usedBy.length === 0 ? '-' : entry.usedBy.map((u) => `${u.count} ${u.label}`).join(', ')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                  <Button size="sm" variant="secondary" disabled={busyKeys.has(binKey(entry))} onClick={() => void actions.restore(entry)}>
                    Restore
                  </Button>
                  <Button size="sm" variant="danger" disabled={busyKeys.has(binKey(entry))} onClick={() => void actions.deleteForever(entry)}>
                    Delete forever
                  </Button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  {isLoading ? 'Loading...' : 'The Recycle Bin is empty.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
