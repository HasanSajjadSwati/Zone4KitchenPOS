import { apiClient } from '@/services/api';

export interface BinEntry {
  type: string;
  typeLabel: string;
  id: string;
  name: string;
  deletedAt: string;
  deletedBy: string | null;
  deletedByName: string | null;
  usedBy: { label: string; count: number }[];
}

export async function listRecycleBin(type?: string): Promise<BinEntry[]> {
  return apiClient.getRecycleBin(type);
}

export async function restore(type: string, id: string): Promise<void> {
  await apiClient.restoreRecycleItem(type, id);
}

export async function deleteForever(type: string, id: string): Promise<'removed' | 'tombstoned'> {
  const res = await apiClient.deleteRecycleItemForever(type, id);
  return res.outcome;
}

// Confirm text for "Delete forever". Used items stay on history as "<name> (Deleted)".
export function describeForeverDelete(entry: BinEntry): string {
  if (entry.usedBy.length === 0) {
    return `"${entry.name}" is not used anywhere and will be removed completely.`;
  }
  const usedBy = entry.usedBy.map((u) => `${u.count} ${u.label}`).join(', ');
  return `"${entry.name}" is used by ${usedBy}. It will stay on that history as "${entry.name} (Deleted)" and cannot be restored.`;
}
