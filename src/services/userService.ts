import { db } from '@/db';
import { logAudit } from '@/utils/audit';
import type { User } from '@/db/types';
import * as bcrypt from 'bcryptjs';

export interface CreateUserParams {
  username: string;
  password: string;
  fullName: string;
  roleId: 'manager' | 'cashier';
  isActive: boolean;
  createdBy: string;
}

export interface UpdateUserParams {
  id: string;
  fullName?: string;
  roleId?: 'manager' | 'cashier';
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

  const passwordHash = await bcrypt.hash(params.password, 10);

  const user: User = {
    id: crypto.randomUUID(),
    username: params.username,
    passwordHash: passwordHash,
    fullName: params.fullName,
    roleId: params.roleId,
    isActive: params.isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.users.add(user);

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

  const updates: Partial<User> = {
    updatedAt: new Date(),
  };

  if (params.fullName !== undefined) updates.fullName = params.fullName;
  if (params.roleId !== undefined) updates.roleId = params.roleId;
  if (params.isActive !== undefined) updates.isActive = params.isActive;
  if (params.password) {
    updates.passwordHash = await bcrypt.hash(params.password, 10);
  }

  await db.users.update(params.id, updates);

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
