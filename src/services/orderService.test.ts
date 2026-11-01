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
  },
}));

vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/services/api', () => ({ apiClient: mocks.apiClient }));
vi.mock('@/utils/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({}) } }));

import { completeOrder, markOrderAsPaid } from './orderService';

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
