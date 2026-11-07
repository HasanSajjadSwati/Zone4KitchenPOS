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

describe('order items', () => {
  it('fetches a single order item by id', async () => {
    fetchMock.mockResolvedValue(reply(200, [{ id: 'item-1', orderId: 'order-1' }]));

    expect(await apiClient.getOrderItem('item-1')).toEqual({ id: 'item-1', orderId: 'order-1' });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/order-items\?ids=item-1$/);
  });

  it('returns null for an order item that does not exist', async () => {
    fetchMock.mockResolvedValue(reply(200, []));

    expect(await apiClient.getOrderItem('missing')).toBeNull();
  });

  it('keeps the server total when fetching a page of orders', async () => {
    fetchMock.mockResolvedValue(reply(200, { orders: [{ id: 'o1' }], total: 63 }));

    expect(await apiClient.getOrdersPage({ limit: '50', offset: '50' })).toEqual({ orders: [{ id: 'o1' }], total: 63 });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/orders\?limit=50&offset=50$/);
  });

  it('counts the rows when an orders page comes back as a bare array', async () => {
    fetchMock.mockResolvedValue(reply(200, [{ id: 'o1' }, { id: 'o2' }]));

    expect(await apiClient.getOrdersPage({ limit: '50' })).toEqual({ orders: [{ id: 'o1' }, { id: 'o2' }], total: 2 });
  });

  // A failed or cut-off /order-items download used to trigger a "fallback" that fetched every
  // order (12 MB+) and then one request per order: it turned one error into thousands of requests.
  it('reports a failed order-items request instead of downloading every order', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"truncated', { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    await expect(apiClient.getOrderItemsBulk()).rejects.toThrow('Invalid JSON response');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('API client list options', () => {
  it('getMenuItems({ includeDeleted: true }) requests ?includeDeleted=true', async () => {
    fetchMock.mockResolvedValue(reply(200, []));
    await apiClient.getMenuItems({ includeDeleted: true });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/menu-items\?includeDeleted=true$/);
  });

  it('getMenuItems() asks for the plain list', async () => {
    fetchMock.mockResolvedValue(reply(200, []));
    await apiClient.getMenuItems();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/menu-items$/);
  });
});
