import { db } from '@/db';
import { apiClient } from '@/services/api';
import type { Settings, Permission } from '@/db/types';
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
  userId: string,
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  return await apiClient.getAuditLogs(limit, offset, userId);
}

// Users for the management screen. Deleted users are kept on the server (orders and payments
// point at them) and are hidden here; reports read db.users directly so their names still resolve.
export async function getAllUsers() {
  const users = await db.users.toArray();
  return users.filter((user: { deletedAt?: string | null }) => !user.deletedAt);
}

export async function getAllRoles() {
  return await db.roles.toArray();
}

export async function updateRolePermissions(
  roleId: string,
  permissions: Permission[],
  userId: string
): Promise<void> {
  const role = await db.roles.get(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  await db.roles.update(roleId, { permissions });

  await logAudit({
    userId,
    action: 'update',
    tableName: 'roles',
    recordId: roleId,
    description: `Updated permissions for role: ${role.name}`,
    before: { permissions: role.permissions },
    after: { permissions },
  });
}
