import { db } from '@/db';
import type { Customer, Order } from '@/db/types';
import { logAudit } from '@/utils/audit';
import { createId } from '@/utils/uuid';

export async function createCustomer(
  customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'lastOrderAt' | 'totalOrders'>,
  userId: string
): Promise<Customer> {
  const newCustomer: Customer = {
    id: createId(),
    ...customer,
    lastOrderAt: null,
    totalOrders: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.customers.add(newCustomer);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'customers',
    recordId: newCustomer.id,
    description: `Created customer: ${newCustomer.name} (${newCustomer.phone})`,
    after: newCustomer,
  });

  return newCustomer;
}

export async function updateCustomer(
  id: string,
  updates: Partial<Customer>,
  userId: string
): Promise<void> {
  const before = await db.customers.get(id);

  await db.customers.update(id, {
    ...updates,
    updatedAt: new Date(),
  });

  const after = await db.customers.get(id);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'customers',
    recordId: id,
    description: `Updated customer: ${after?.name}`,
    before,
    after,
  });
}

export async function deleteCustomer(id: string, userId: string): Promise<void> {
  const customer = await db.customers.get(id);

  await db.customers.delete(id);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'customers',
    recordId: id,
    description: `Deleted customer: ${customer?.name}`,
    before: customer,
  });
}

export async function getCustomerByPhone(phone: string): Promise<Customer | undefined> {
  return await db.customers.where('phone').equals(phone).first();
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const allCustomers = await db.customers.toArray();
  const lowerQuery = query.toLowerCase();

  return allCustomers.filter(
    (customer: Customer) =>
      customer.name.toLowerCase().includes(lowerQuery) ||
      customer.phone.includes(query) ||
      customer.address?.toLowerCase().includes(lowerQuery)
  );
}

export async function getAllCustomers(): Promise<Customer[]> {
  return await db.customers.orderBy('name').toArray();
}

export async function getCustomerOrderHistory(customerId: string): Promise<Order[]> {
  return await db.orders
    .where('customerId')
    .equals(customerId)
    .reverse()
    .sortBy('createdAt');
}

export async function getTopCustomers(limit: number = 10): Promise<Customer[]> {
  return await db.customers
    .orderBy('totalOrders')
    .reverse()
    .limit(limit)
    .toArray();
}
