import { db } from '@/db';
import type { Settings } from '@/db/types';
import { logAudit } from '@/utils/audit';

export async function getSettings(): Promise<Settings | undefined> {
  return await db.settings.get('default');
}

export async function updateSettings(
  updates: Partial<Omit<Settings, 'id' | 'updatedAt' | 'updatedBy'>>,
  userId: string
): Promise<void> {
  const before = await db.settings.get('default');

  await db.settings.update('default', {
    ...updates,
    updatedAt: new Date(),
    updatedBy: userId,
  });

  const after = await db.settings.get('default');

  await logAudit({
    userId,
    action: 'update',
    tableName: 'settings',
    recordId: 'default',
    description: 'Updated system settings',
    before,
    after,
  });
}

export async function getAuditLogs(
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  return await db.auditLogs
    .orderBy('createdAt')
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();
}

export async function getAllUsers() {
  return await db.users.toArray();
}

export async function getAllRoles() {
  return await db.roles.toArray();
}
