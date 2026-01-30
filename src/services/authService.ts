import bcrypt from 'bcryptjs';
import { addHours } from 'date-fns';
import { db } from '@/db';
import { useAuthStore } from '@/stores/authStore';
import { logAudit } from '@/utils/audit';

export async function login(username: string, password: string) {
  const user = await db.users.where('username').equals(username).first();

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    throw new Error('Account is disabled');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  // Get user role
  const role = await db.roles.get(user.roleId);
  if (!role) {
    throw new Error('User role not found');
  }

  // Create session (8-hour expiration)
  const session = {
    userId: user.id,
    loginAt: new Date(),
    expiresAt: addHours(new Date(), 8),
  };

  // Update store
  const authStore = useAuthStore.getState();
  authStore.setSession(session);
  authStore.setCurrentUser(user);
  authStore.setCurrentRole(role);

  // Log audit
  await logAudit({
    userId: user.id,
    action: 'login',
    tableName: 'users',
    recordId: user.id,
    description: `User ${user.username} logged in`,
  });

  return { user, role };
}

export async function restoreSession(): Promise<boolean> {
  const authStore = useAuthStore.getState();
  const session = authStore.session;

  if (!session) {
    return false;
  }

  try {
    const user = await db.users.get(session.userId);
    if (!user || !user.isActive) {
      authStore.logout();
      return false;
    }

    const role = await db.roles.get(user.roleId);
    if (!role) {
      authStore.logout();
      return false;
    }

    authStore.setCurrentUser(user);
    authStore.setCurrentRole(role);
    return true;
  } catch {
    authStore.logout();
    return false;
  }
}

export async function logout() {
  const authStore = useAuthStore.getState();
  const session = authStore.session;

  if (session) {
    await logAudit({
      userId: session.userId,
      action: 'logout',
      tableName: 'users',
      recordId: session.userId,
      description: 'User logged out',
    });
  }

  authStore.logout();
}

export function checkSession(): boolean {
  const authStore = useAuthStore.getState();
  return authStore.isAuthenticated();
}

export async function hasPermission(resource: string, action: string): Promise<boolean> {
  const authStore = useAuthStore.getState();
  return authStore.hasPermission(resource, action);
}
