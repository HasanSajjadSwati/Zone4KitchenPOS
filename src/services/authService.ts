import { db } from '@/db';
import type { Role, User } from '@/db/types';
import { apiClient } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { logAudit } from '@/utils/audit';

interface LoginResponse {
  token: string;
  expiresAt: string;
  user: User;
  role: Role;
}

export async function login(username: string, password: string) {
  // The server checks the password and signs an 8-hour token; it rejects
  // unknown users, wrong passwords and disabled accounts with a message.
  const { token, expiresAt, user, role } = (await apiClient.login(username, password)) as LoginResponse;

  const session = {
    userId: user.id,
    loginAt: new Date(),
    expiresAt: new Date(expiresAt),
    token,
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

  // Sessions saved before server-side login have no token and cannot call the API.
  if (!session.token) {
    authStore.logout();
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
