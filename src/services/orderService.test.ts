import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    orders: { get: vi.fn(), update: vi.fn() },
    payments: { add: vi.fn(), where: vi.fn() },
    customers: { get: vi.fn(), update: vi.fn() },
    transaction: vi.fn(async (_mode: string, _tables: unknown[], fn: () => Promise<void>) => fn()),
  },
  apiClient: {
    getPayments: vi.fn(),
    getPaymentsByOrder: vi.fn(),
    getOrders: vi.fn(),
    getOrdersPage: vi.fn(),
  },
}));

vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/services/api', () => ({ apiClient: mocks.apiClient }));
vi.mock('@/utils/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({}) } }));

import { completeOrder, getDashboardOrderStats, getOrdersPaginated, markOrderAsPaid } from './orderService';

const ORDER_ID = 'order-1';

function openOrder(overrides: Record<string, unknown> = {}) {
  return { id: ORDER_ID, orderNumber: 'ORD-1', total: 1200, isPaid: false, status: 'open', customerId: null, ...overrides };
}

describe('paid-total lookup when settling an order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.orders.get.mockResolvedValue(openOrder());
  });

  it('fetches only this order\'s payments, never the whole payments table', async () => {
    mocks.apiClient.getPaymentsByOrder.mockResolvedValue([]);

    await completeOrder({ orderId: ORDER_ID, isPaid: true, paymentMethod: 'cash', userId: 'u1' });

    expect(mocks.apiClient.getPaymentsByOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(mocks.apiClient.getPayments).not.toHaveBeenCalled();
    expect(mocks.db.payments.where).not.toHaveBeenCalled();
  });

  it('records the full total when nothing has been paid yet', async () => {
    mocks.apiClient.getPaymentsByOrder.mockResolvedValue([]);

    await completeOrder({ orderId: ORDER_ID, isPaid: true, paymentMethod: 'cash', userId: 'u1' });

    expect(mocks.db.payments.add).toHaveBeenCalledTimes(1);
    expect(mocks.db.payments.add.mock.calls[0][0]).toMatchObject({ orderId: ORDER_ID, amount: 1200, method: 'cash' });
  });

  it('does not record a second payment for an order that is already fully paid', async () => {
    mocks.apiClient.getPaymentsByOrder.mockResolvedValue([{ id: 'p1', orderId: ORDER_ID, amount: 1200 }]);

    await completeOrder({ orderId: ORDER_ID, isPaid: true, paymentMethod: 'cash', userId: 'u1' });

    expect(mocks.db.payments.add).not.toHaveBeenCalled();
    expect(mocks.db.orders.update).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({ status: 'completed', isPaid: true }));
  });

  it('records only the outstanding balance after a partial payment', async () => {
    mocks.apiClient.getPaymentsByOrder.mockResolvedValue([{ id: 'p1', orderId: ORDER_ID, amount: 500 }]);

    await completeOrder({ orderId: ORDER_ID, isPaid: true, paymentMethod: 'card', userId: 'u1' });

    expect(mocks.db.payments.add.mock.calls[0][0]).toMatchObject({ amount: 700, method: 'card' });
  });

  it('treats an empty reply as no payments', async () => {
    mocks.apiClient.getPaymentsByOrder.mockResolvedValue(null);

    await completeOrder({ orderId: ORDER_ID, isPaid: true, paymentMethod: 'cash', userId: 'u1' });

    expect(mocks.db.payments.add.mock.calls[0][0]).toMatchObject({ amount: 1200 });
  });

  it('mark-as-paid uses the same per-order lookup', async () => {
    mocks.apiClient.getPaymentsByOrder.mockResolvedValue([{ id: 'p1', orderId: ORDER_ID, amount: 200 }]);

    await markOrderAsPaid({ orderId: ORDER_ID, paymentMethod: 'cash', userId: 'u1' });

    expect(mocks.apiClient.getPayments).not.toHaveBeenCalled();
    expect(mocks.db.payments.add.mock.calls[0][0]).toMatchObject({ amount: 1000 });
  });
});

describe('dashboard order stats', () => {
  const START = new Date('2026-11-06T00:00:00.000Z');
  const END = new Date('2026-11-06T23:59:59.999Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks the server for this range and for open orders only, never the whole orders table', async () => {
    mocks.apiClient.getOrders.mockResolvedValue([]);

    await getDashboardOrderStats(START, END);

    expect(mocks.apiClient.getOrders).toHaveBeenCalledWith({ startDate: START.toISOString(), endDate: END.toISOString() });
    expect(mocks.apiClient.getOrders).toHaveBeenCalledWith({ status: 'open' });
    for (const call of mocks.apiClient.getOrders.mock.calls) {
      expect(call[0]).toBeTruthy();
    }
  });

  it('counts orders created in the range and the sales of the completed ones', async () => {
    mocks.apiClient.getOrders.mockImplementation(async (filters: Record<string, string>) => {
      if (filters.status === 'open') return [{ id: 'o-open-1' }, { id: 'o-open-2' }];
      return [
        { id: 'a', status: 'completed', total: 500, createdAt: '2026-11-06T09:00:00.000Z' },
        { id: 'b', status: 'completed', total: 700, createdAt: '2026-11-06T12:00:00.000Z' },
        { id: 'c', status: 'open', total: 300, createdAt: '2026-11-06T13:00:00.000Z' },
        // Created yesterday, completed today: the server returns it, but it is not one of today's orders.
        { id: 'd', status: 'completed', total: 900, createdAt: '2026-11-05T23:00:00.000Z' },
      ];
    });

    expect(await getDashboardOrderStats(START, END)).toEqual({
      todayOrders: 3,
      todaySales: 1200,
      completedToday: 2,
      openOrders: 2,
    });
  });
});

describe('orders list paging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Busy days pass 50 orders (58-63 seen in production); the list must know the real total
  // to show page 2.
  it('returns the server total, not the size of the current page', async () => {
    const page = Array.from({ length: 50 }, (_, i) => ({ id: `o${i}` }));
    mocks.apiClient.getOrdersPage.mockResolvedValue({ orders: page, total: 63 });

    const result = await getOrdersPaginated({ limit: 50, offset: 0 });

    expect(result.total).toBe(63);
    expect(result.orders).toHaveLength(50);
    expect(mocks.apiClient.getOrdersPage).toHaveBeenCalledWith({ limit: '50', offset: '0' });
  });
});
