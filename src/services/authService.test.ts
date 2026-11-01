import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const order: string[] = [];
  const store = {
    session: null as null | Record<string, unknown>,
    setSession: vi.fn((s: Record<string, unknown> | null) => { order.push('setSession'); store.session = s; }),
    setCurrentUser: vi.fn(),
    setCurrentRole: vi.fn(),
    logout: vi.fn(() => { store.session = null; }),
  };
  return {
    order,
    store,
    apiClient: { login: vi.fn() },
    db: { users: { get: vi.fn() }, roles: { get: vi.fn() } },
    logAudit: vi.fn(async () => { order.push('logAudit'); }),
  };
});

vi.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => mocks.store } }));
vi.mock('@/services/api', () => ({ apiClient: mocks.apiClient }));
vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/utils/audit', () => ({ logAudit: mocks.logAudit }));

import { login, restoreSession } from './authService';

const user = { id: 'u1', username: 'cashier', isActive: true, roleId: 'r1' };
const role = { id: 'r1', name: 'Cashier', permissions: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.order.length = 0;
  mocks.store.session = null;
});

describe('login', () => {
  it('logs in through the server and keeps its token for later requests', async () => {
    mocks.apiClient.login.mockResolvedValue({ token: 'tok-1', expiresAt: '2030-01-01T08:00:00.000Z', user, role });

    const result = await login('cashier', 'secret');

    expect(mocks.apiClient.login).toHaveBeenCalledWith('cashier', 'secret');
    expect(mocks.store.session).toMatchObject({ userId: 'u1', token: 'tok-1', expiresAt: new Date('2030-01-01T08:00:00.000Z') });
    expect(mocks.store.setCurrentUser).toHaveBeenCalledWith(user);
    expect(mocks.store.setCurrentRole).toHaveBeenCalledWith(role);
    expect(result).toEqual({ user, role });
    // the login audit is an API call, so it must happen after the token is stored
    expect(mocks.order).toEqual(['setSession', 'logAudit']);
  });

  it('passes the server\'s rejection through and stores nothing', async () => {
    mocks.apiClient.login.mockRejectedValue(new Error('Invalid credentials'));

    await expect(login('cashier', 'wrong')).rejects.toThrow('Invalid credentials');
    expect(mocks.store.setSession).not.toHaveBeenCalled();
  });
});

describe('restoreSession', () => {
  it('asks for a fresh login when the saved session predates server tokens', async () => {
    mocks.store.session = { userId: 'u1', loginAt: new Date(), expiresAt: new Date(Date.now() + 3600_000) };

    expect(await restoreSession()).toBe(false);
    expect(mocks.store.logout).toHaveBeenCalled();
    expect(mocks.db.users.get).not.toHaveBeenCalled();
  });

  it('restores a session that has a token', async () => {
    mocks.store.session = { userId: 'u1', token: 'tok-1', loginAt: new Date(), expiresAt: new Date(Date.now() + 3600_000) };
    mocks.db.users.get.mockResolvedValue(user);
    mocks.db.roles.get.mockResolvedValue(role);

    expect(await restoreSession()).toBe(true);
    expect(mocks.store.setCurrentUser).toHaveBeenCalledWith(user);
  });
});
