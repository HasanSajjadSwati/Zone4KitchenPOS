import { db } from '@/db';
import type { Waiter, Rider, TableRecord } from '@/db/types';
import { logAudit } from '@/utils/audit';

// Waiters
export async function createWaiter(
  waiter: Omit<Waiter, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Waiter> {
  const newWaiter: Waiter = {
    id: crypto.randomUUID(),
    ...waiter,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.waiters.add(newWaiter);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'waiters',
    recordId: newWaiter.id,
    description: `Created waiter: ${newWaiter.name}`,
    after: newWaiter,
  });

  return newWaiter;
}

export async function updateWaiter(
  id: string,
  updates: Partial<Waiter>,
  userId: string
): Promise<void> {
  const before = await db.waiters.get(id);

  await db.waiters.update(id, {
    ...updates,
    updatedAt: new Date(),
  });

  const after = await db.waiters.get(id);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'waiters',
    recordId: id,
    description: `Updated waiter: ${after?.name}`,
    before,
    after,
  });
}

export async function deleteWaiter(id: string, userId: string): Promise<void> {
  const waiter = await db.waiters.get(id);

  await db.waiters.delete(id);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'waiters',
    recordId: id,
    description: `Deleted waiter: ${waiter?.name}`,
    before: waiter,
  });
}

export async function getAllWaiters(): Promise<Waiter[]> {
  return await db.waiters.toArray();
}

export async function getActiveWaiters(): Promise<Waiter[]> {
  return await db.waiters.filter((waiter) => waiter.isActive).toArray();
}

// Riders
export async function createRider(
  rider: Omit<Rider, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Rider> {
  const newRider: Rider = {
    id: crypto.randomUUID(),
    ...rider,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.riders.add(newRider);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'riders',
    recordId: newRider.id,
    description: `Created rider: ${newRider.name}`,
    after: newRider,
  });

  return newRider;
}

export async function updateRider(
  id: string,
  updates: Partial<Rider>,
  userId: string
): Promise<void> {
  const before = await db.riders.get(id);

  await db.riders.update(id, {
    ...updates,
    updatedAt: new Date(),
  });

  const after = await db.riders.get(id);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'riders',
    recordId: id,
    description: `Updated rider: ${after?.name}`,
    before,
    after,
  });
}

export async function deleteRider(id: string, userId: string): Promise<void> {
  const rider = await db.riders.get(id);

  await db.riders.delete(id);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'riders',
    recordId: id,
    description: `Deleted rider: ${rider?.name}`,
    before: rider,
  });
}

export async function getAllRiders(): Promise<Rider[]> {
  return await db.riders.toArray();
}

export async function getActiveRiders(): Promise<Rider[]> {
  return await db.riders.filter((rider) => rider.isActive).toArray();
}

// Tables
export async function createTable(
  table: Omit<TableRecord, 'id' | 'createdAt'>,
  userId: string
): Promise<TableRecord> {
  const newTable: TableRecord = {
    id: crypto.randomUUID(),
    ...table,
    createdAt: new Date(),
  };

  await db.diningTables.add(newTable);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'tables',
    recordId: newTable.id,
    description: `Created table: ${newTable.tableNumber}`,
    after: newTable,
  });

  return newTable;
}

export async function updateTable(
  id: string,
  updates: Partial<TableRecord>,
  userId: string
): Promise<void> {
  const before = await db.diningTables.get(id);

  await db.diningTables.update(id, updates);

  const after = await db.diningTables.get(id);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'tables',
    recordId: id,
    description: `Updated table: ${after?.tableNumber}`,
    before,
    after,
  });
}

export async function deleteTable(id: string, userId: string): Promise<void> {
  const table = await db.diningTables.get(id);

  await db.diningTables.delete(id);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'tables',
    recordId: id,
    description: `Deleted table: ${table?.tableNumber}`,
    before: table,
  });
}

export async function getAllTables(): Promise<TableRecord[]> {
  return await db.diningTables.toArray();
}

export async function getActiveTables(): Promise<TableRecord[]> {
  return await db.diningTables.filter((table) => table.isActive).toArray();
}
