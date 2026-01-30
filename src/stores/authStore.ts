import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '@/db/types';

interface Session {
  userId: string;
  loginAt: Date;
  expiresAt: Date;
}

interface AuthStore {
  session: Session | null;
  currentUser: User | null;
  currentRole: Role | null;
  setSession: (session: Session | null) => void;
  setCurrentUser: (user: User | null) => void;
  setCurrentRole: (role: Role | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasPermission: (resource: string, action: string) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      session: null,
      currentUser: null,
      currentRole: null,

      setSession: (session) => set({ session }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentRole: (role) => set({ currentRole: role }),

      logout: () => {
        set({ session: null, currentUser: null, currentRole: null });
      },

      isAuthenticated: () => {
        const { session } = get();
        if (!session) return false;

        const now = new Date();
        const expiresAt = new Date(session.expiresAt);

        if (expiresAt < now) {
          get().logout();
          return false;
        }

        return true;
      },

      hasPermission: (resource: string, action: string) => {
        const { currentRole } = get();
        if (!currentRole) return false;

        return currentRole.permissions.some(
          (p) => p.resource === resource && p.actions.includes(action as any)
        );
      },
    }),
    {
      name: 'pos-auth-storage',
    }
  )
);
