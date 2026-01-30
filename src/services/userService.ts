import { db } from '@/db';
import { apiClient } from '@/services/api';
import { logAudit } from '@/utils/audit';
import type { User } from '@/db/types';

export interface CreateUserParams {
  username: string;
  password: string;
  fullName: string;
  roleId: string;
  isActive: boolean;
  createdBy: string;
}

export interface UpdateUserParams {
  id: string;
  fullName?: string;
  roleId?: string;
  isActive?: boolean;
  password?: string;
  updatedBy: string;
}

export async function createUser(params: CreateUserParams): Promise<User> {
  // Check if username already exists
  const existingUser = await db.users.where('username').equals(params.username).first();
  if (existingUser) {
    throw new Error('Username already exists');
  }

  const user = await apiClient.createUser({
    username: params.username,
    password: params.password,
    fullName: params.fullName,
    roleId: params.roleId,
    isActive: params.isActive,
  });

  await logAudit({
    userId: params.createdBy,
    action: 'create',
    tableName: 'users',
    recordId: user.id,
    description: `Created user ${user.username}`,
    after: user,
  });

  return user;
}

export async function updateUser(params: UpdateUserParams): Promise<void> {
  const user = await db.users.get(params.id);
  if (!user) {
    throw new Error('User not found');
  }

  const updates: Partial<User> = {};

  if (params.fullName !== undefined) updates.fullName = params.fullName;
  if (params.roleId !== undefined) updates.roleId = params.roleId;
  if (params.isActive !== undefined) updates.isActive = params.isActive;

  await apiClient.updateUser(params.id, updates);

  if (params.password) {
    throw new Error('Password updates require the reset password flow.');
  }

  await logAudit({
    userId: params.updatedBy,
    action: 'update',
    tableName: 'users',
    recordId: params.id,
    description: `Updated user ${user.username}`,
    before: user,
    after: { ...user, ...updates },
  });
}

export async function resetUserPassword(userId: string, newPassword: string, adminUserId: string): Promise<void> {
  const user = await db.users.get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  await apiClient.resetUserPassword(userId, adminUserId, newPassword);

  await logAudit({
    userId: adminUserId,
    action: 'update',
    tableName: 'users',
    recordId: userId,
    description: `Reset password for user ${user.username}`,
    before: user,
    after: { ...user, updatedAt: new Date() },
  });
}

export async function deleteUser(userId: string, deletedBy: string): Promise<void> {
  const user = await db.users.get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Prevent deleting yourself
  if (userId === deletedBy) {
    throw new Error('You cannot delete your own user account');
  }

  await db.users.delete(userId);

  await logAudit({
    userId: deletedBy,
    action: 'delete',
    tableName: 'users',
    recordId: userId,
    description: `Deleted user ${user.username}`,
    before: user,
  });
}
