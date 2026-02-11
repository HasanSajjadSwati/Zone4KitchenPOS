import { db } from '@/db';
import type { Order, Payment, RegisterSession } from '@/db/types';
import { apiClient } from '@/services/api';
import { logAudit } from '@/utils/audit';
import { createId } from '@/utils/uuid';

function getAppliedPaymentsByMethod(orderTotal: number, payments: Payment[]) {
  const sortedPayments = [...payments].sort((a, b) => {
    const aTime = new Date(a.paidAt).getTime();
    const bTime = new Date(b.paidAt).getTime();
    const safeATime = Number.isFinite(aTime) ? aTime : 0;
    const safeBTime = Number.isFinite(bTime) ? bTime : 0;
    if (safeATime !== safeBTime) return safeATime - safeBTime;
    return String(a.id).localeCompare(String(b.id));
  });

  const byMethod = {
    cash: 0,
    card: 0,
    online: 0,
    other: 0,
  };

  let remaining = Math.max(0, orderTotal);
  for (const payment of sortedPayments) {
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0 || remaining <= 0) continue;

    const applied = Math.min(amount, remaining);
    byMethod[payment.method] += applied;
    remaining -= applied;
  }

  return byMethod;
}

export async function openRegister(
  openingCash: number,
  userId: string
): Promise<RegisterSession> {
  // Check if there's already an open session
  const existingOpen = await db.registerSessions
    .where('status')
    .equals('open')
    .first();

  if (existingOpen) {
    throw new Error('A register session is already open. Please close it first.');
  }

  const newSession: RegisterSession = {
    id: createId(),
    openedBy: userId,
    closedBy: null,
    openedAt: new Date(),
    closedAt: null,
    openingCash,
    closingCash: null,
    expectedCash: null,
    cashDifference: null,
    totalSales: 0,
    totalOrders: 0,
    notes: null,
    status: 'open',
  };

  await db.registerSessions.add(newSession);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'registerSessions',
    recordId: newSession.id,
    description: `Opened register with Rs ${openingCash}`,
    after: newSession,
  });

  return newSession;
}

export async function closeRegister(
  sessionId: string,
  closingCash: number,
  notes: string | null,
  userId: string
): Promise<RegisterSession> {
  const session = await db.registerSessions.get(sessionId);

  if (!session) {
    throw new Error('Register session not found');
  }

  if (session.status === 'closed') {
    throw new Error('Register session is already closed');
  }

  // Calculate sales from this session
  const orders = await db.orders
    .where('registerSessionId')
    .equals(sessionId)
    .toArray();

  const completedOrders = orders.filter((o) => o.status === 'completed');
  const totalSales = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = completedOrders.length;

  // Calculate expected cash (opening + applied cash sales)
  const payments = await db.payments
    .where('orderId')
    .anyOf(completedOrders.map((o) => o.id))
    .toArray();

  const paymentsByOrder = new Map<string, Payment[]>();
  for (const payment of payments) {
    if (!paymentsByOrder.has(payment.orderId)) {
      paymentsByOrder.set(payment.orderId, []);
    }
    paymentsByOrder.get(payment.orderId)!.push(payment);
  }

  const cashSales = completedOrders.reduce((sum, order) => {
    const applied = getAppliedPaymentsByMethod(order.total, paymentsByOrder.get(order.id) || []);
    return sum + applied.cash;
  }, 0);

  const expectedCash = session.openingCash + cashSales;
  const cashDifference = closingCash - expectedCash;

  await db.registerSessions.update(sessionId, {
    closedBy: userId,
    closedAt: new Date(),
    closingCash,
    expectedCash,
    cashDifference,
    totalSales,
    totalOrders,
    notes,
    status: 'closed',
  });

  const updatedSession = await db.registerSessions.get(sessionId);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'registerSessions',
    recordId: sessionId,
    description: `Closed register. Difference: Rs ${cashDifference}`,
    before: session,
    after: updatedSession,
  });

  return updatedSession!;
}

export async function getCurrentSession(): Promise<RegisterSession | undefined> {
  return await db.registerSessions.where('status').equals('open').first();
}

export async function getRecentSessions(limit: number = 10): Promise<RegisterSession[]> {
  const sessions = await db.registerSessions
    .orderBy('openedAt')
    .reverse()
    .limit(limit)
    .toArray();

  if (sessions.length === 0) {
    return [];
  }

  const completedOrders = await apiClient.getOrders({
    registerSessionIds: sessions.map((session: RegisterSession) => session.id).join(','),
    status: 'completed',
  }) as Order[];

  const payments = completedOrders.length > 0
    ? await apiClient.getPayments({ orderIds: completedOrders.map((order) => order.id).join(',') }) as Payment[]
    : [];

  const paymentsByOrder = new Map<string, Payment[]>();
  for (const payment of payments) {
    if (!paymentsByOrder.has(payment.orderId)) {
      paymentsByOrder.set(payment.orderId, []);
    }
    paymentsByOrder.get(payment.orderId)!.push(payment);
  }

  const totalsBySession = new Map<string, { totalSales: number; totalOrders: number; cashSales: number }>();
  for (const order of completedOrders) {
    const existing = totalsBySession.get(order.registerSessionId) || { totalSales: 0, totalOrders: 0, cashSales: 0 };
    const applied = getAppliedPaymentsByMethod(order.total, paymentsByOrder.get(order.id) || []);
    existing.totalSales += order.total;
    existing.totalOrders += 1;
    existing.cashSales += applied.cash;
    totalsBySession.set(order.registerSessionId, existing);
  }

  return sessions.map((session: RegisterSession) => {
    const totals = totalsBySession.get(session.id);
    const resolvedExpectedCash = totals
      ? session.openingCash + totals.cashSales
      : session.expectedCash;
    const resolvedCashDifference =
      session.status === 'closed' &&
      session.closingCash !== null &&
      resolvedExpectedCash !== null
        ? session.closingCash - resolvedExpectedCash
        : session.cashDifference;

    return {
      ...session,
      totalSales: totals?.totalSales ?? session.totalSales ?? 0,
      totalOrders: totals?.totalOrders ?? session.totalOrders ?? 0,
      expectedCash: resolvedExpectedCash,
      cashDifference: resolvedCashDifference,
    };
  });
}

export async function getSessionStats(sessionId: string) {
  const session = await db.registerSessions.get(sessionId);
  if (!session) return null;

  const orders = await db.orders
    .where('registerSessionId')
    .equals(sessionId)
    .toArray();

  const completedOrders = orders.filter((o) => o.status === 'completed');
  const openOrders = orders.filter((o) => o.status === 'open');

  // Payment breakdown
  const payments = await db.payments
    .where('orderId')
    .anyOf(completedOrders.map((o) => o.id))
    .toArray();

  const paymentsByOrder = new Map<string, Payment[]>();
  for (const payment of payments) {
    if (!paymentsByOrder.has(payment.orderId)) {
      paymentsByOrder.set(payment.orderId, []);
    }
    paymentsByOrder.get(payment.orderId)!.push(payment);
  }

  const paymentsByMethod = completedOrders.reduce((acc, order) => {
    const applied = getAppliedPaymentsByMethod(order.total, paymentsByOrder.get(order.id) || []);
    acc.cash = (acc.cash || 0) + applied.cash;
    acc.card = (acc.card || 0) + applied.card;
    acc.online = (acc.online || 0) + applied.online;
    acc.other = (acc.other || 0) + applied.other;
    return acc;
  }, {} as Record<string, number>);

  return {
    session,
    totalOrders: completedOrders.length,
    openOrders: openOrders.length,
    totalSales: completedOrders.reduce((sum, o) => sum + o.total, 0),
    paymentsByMethod,
  };
}
