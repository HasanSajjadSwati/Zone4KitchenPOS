import { db } from '@/db';
import { apiClient } from '@/services/api';
import { logAudit } from '@/utils/audit';

export async function wipeAllData(userId: string, keepSettings: boolean = true): Promise<void> {
  // Log the wipe action first
  await logAudit({
    userId,
    action: 'wipe',
    tableName: 'system',
    recordId: 'wipe',
    description: `Wiped all data (keepSettings: ${keepSettings})`,
  });

  await apiClient.wipeAllData({ keepSettings });
}

export async function wipeMenuData(userId: string): Promise<void> {
  await logAudit({
    userId,
    action: 'wipe',
    tableName: 'menu',
    recordId: 'wipe',
    description: 'Wiped all menu data',
  });

  await db.transaction('rw', [
    db.categories,
    db.menuItems,
    db.menuItemVariants,
    db.variants,
    db.variantOptions,
    db.deals,
    db.dealItems,
  ], async () => {
    await db.categories.clear();
    await db.menuItems.clear();
    await db.menuItemVariants.clear();
    await db.variants.clear();
    await db.variantOptions.clear();
    await db.deals.clear();
    await db.dealItems.clear();
  });
}

export async function wipeOrderData(userId: string): Promise<void> {
  await logAudit({
    userId,
    action: 'wipe',
    tableName: 'orders',
    recordId: 'wipe',
    description: 'Wiped all order data',
  });

  await db.transaction('rw', [
    db.orders,
    db.orderItems,
    db.payments,
    db.kotPrints,
  ], async () => {
    await db.orders.clear();
    await db.orderItems.clear();
    await db.payments.clear();
    await db.kotPrints.clear();
  });
}

export async function wipeCustomerData(userId: string): Promise<void> {
  await logAudit({
    userId,
    action: 'wipe',
    tableName: 'customers',
    recordId: 'wipe',
    description: 'Wiped all customer data',
  });

  await db.customers.clear();
}

export async function wipeStaffData(userId: string): Promise<void> {
  await logAudit({
    userId,
    action: 'wipe',
    tableName: 'staff',
    recordId: 'wipe',
    description: 'Wiped all staff data',
  });

  await db.transaction('rw', [
    db.diningTables,
    db.waiters,
    db.riders,
  ], async () => {
    await db.diningTables.clear();
    await db.waiters.clear();
    await db.riders.clear();
  });
}
