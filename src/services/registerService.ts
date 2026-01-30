import { db } from '@/db';
import type { RegisterSession } from '@/db/types';
import { logAudit } from '@/utils/audit';

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
    id: crypto.randomUUID(),
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

  // Calculate expected cash (opening + cash sales)
  const cashPayments = await db.payments
    .where('orderId')
    .anyOf(completedOrders.map((o) => o.id))
    .and((p) => p.method === 'cash')
    .toArray();

  const cashSales = cashPayments.reduce((sum, p) => sum + p.amount, 0);
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
  return await db.registerSessions
    .orderBy('openedAt')
    .reverse()
    .limit(limit)
    .toArray();
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

  const paymentsByMethod = payments.reduce((acc, payment) => {
    acc[payment.method] = (acc[payment.method] || 0) + payment.amount;
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
