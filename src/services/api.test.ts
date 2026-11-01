import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  session: null as null | { token?: string },
  logout: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => auth },
}));

import { apiClient } from './api';

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  fetchMock.mockReset();
  auth.logout.mockReset();
  auth.session = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('API client authentication', () => {
  it('sends the login token on every request', async () => {
    auth.session = { token: 'tok-123' };
    fetchMock.mockResolvedValue(reply(200, []));

    await apiClient.getPaymentsByOrder('order-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/payments\/order\/order-1$/);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok-123', 'Content-Type': 'application/json' });
  });

  it('sends no Authorization header before login', async () => {
    fetchMock.mockResolvedValue(reply(200, []));

    await apiClient.getPayments();

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('signs the till out when the server rejects its token', async () => {
    auth.session = { token: 'expired' };
    fetchMock.mockResolvedValue(reply(401, { error: 'Authentication required' }));

    await expect(apiClient.getPayments()).rejects.toThrow('Authentication required');
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('does not sign out on a failed login attempt', async () => {
    fetchMock.mockResolvedValue(reply(401, { error: 'Invalid credentials' }));

    await expect(apiClient.login('cashier', 'wrong')).rejects.toThrow('Invalid credentials');
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('logs in by posting the credentials to the server', async () => {
    fetchMock.mockResolvedValue(reply(200, { token: 't', expiresAt: 'x', user: {}, role: {} }));

    await apiClient.login('cashier', 'secret');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ username: 'cashier', password: 'secret' });
  });
});
