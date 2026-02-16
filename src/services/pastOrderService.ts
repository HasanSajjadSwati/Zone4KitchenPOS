import { apiClient } from '@/services/api';
import type { Order, OrderItem } from '@/db/types';

export interface PastOrderQueryParams {
  status?: 'open' | 'completed' | 'cancelled';
  orderType?: string;
  isPaid?: boolean;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedPastOrdersResult {
  orders: Order[];
  total: number;
}

export interface MigrationPreview {
  ordersToMigrate: number;
  currentActiveOrders: number;
  currentPastOrders: number;
  cutoffDate: string;
}

export interface MigrationResult {
  message: string;
  migratedCount: number;
  totalFound: number;
  errors?: string[];
}

export async function getPastOrdersPaginated(params: PastOrderQueryParams): Promise<PaginatedPastOrdersResult> {
  const filters: Record<string, string> = {};

  if (params.status) filters.status = params.status;
  if (params.orderType && params.orderType !== 'all') filters.orderType = params.orderType;
  if (params.isPaid !== undefined) filters.isPaid = String(params.isPaid);
  if (params.startDate) filters.startDate = params.startDate;
  if (params.endDate) filters.endDate = params.endDate;
  if (params.search) filters.search = params.search;
  if (params.limit) filters.limit = String(params.limit);
  if (params.offset !== undefined) filters.offset = String(params.offset);

  const result = await apiClient.getPastOrders(filters);

  if (Array.isArray(result)) {
    return { orders: result as Order[], total: result.length };
  }

  return result as PaginatedPastOrdersResult;
}

export async function getPastOrder(orderId: string): Promise<Order | undefined> {
  return await apiClient.getPastOrder(orderId);
}

export async function getPastOrderItems(orderId: string): Promise<OrderItem[]> {
  return await apiClient.getPastOrderItems(orderId);
}

export async function getMigrationPreview(olderThanDays: number): Promise<MigrationPreview> {
  return await apiClient.getMigrationPreview(olderThanDays);
}

export async function migrateOrdersToPast(olderThanDays: number): Promise<MigrationResult> {
  return await apiClient.migrateOrdersToPast(olderThanDays);
}
