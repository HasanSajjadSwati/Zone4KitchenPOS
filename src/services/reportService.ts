import { db } from '@/db';
import { apiClient } from '@/services/api';
import type { Order, OrderItem, Payment, RegisterSession, User, Customer, Expense, Waiter, Rider, MenuItem, Category, Deal } from '@/db/types';

// Report Types
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SalesSummary {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  totalItems: number;
  totalDiscounts: number;
  // By order type
  dineInSales: number;
  dineInOrders: number;
  takeAwaySales: number;
  takeAwayOrders: number;
  deliverySales: number;
  deliveryOrders: number;
  // By payment method
  cashSales: number;
  cardSales: number;
  onlineSales: number;
  otherSales: number;
  // Paid vs unpaid
  paidOrders: number;
  unpaidOrders: number;
  paidAmount: number;
  unpaidAmount: number;
}

export interface CategorySales {
  categoryId: string;
  categoryName: string;
  totalSales: number;
  totalQuantity: number;
  orderCount: number;
  averagePrice: number;
}

export interface ItemSales {
  itemId: string;
  itemName: string;
  categoryId: string | null;
  categoryName: string | null;
  totalSales: number;
  totalQuantity: number;
  orderCount: number;
  averagePrice: number;
}

export interface DealSales {
  dealId: string;
  dealName: string;
  totalSales: number;
  totalQuantity: number;
  orderCount: number;
  averagePrice: number;
}

export interface WaiterPerformance {
  waiterId: string;
  waiterName: string;
  totalOrders: number;
  totalSales: number;
  averageOrderValue: number;
  totalTables: number; // Unique tables served
}

export interface RiderPerformance {
  riderId: string;
  riderName: string;
  totalDeliveries: number;
  totalSales: number;
  averageOrderValue: number;
}

export interface RegisterSessionSummary {
  sessionId: string;
  openedAt: Date;
  closedAt: Date | null;
  openedBy: string;
  closedBy: string | null;
  openingCash: number;
  expectedCash: number | null;
  actualCash: number | null;
  difference: number | null;
  totalSales: number;
  totalOrders: number;
  cashPayments: number;
  cardPayments: number;
  onlinePayments: number;
  otherPayments: number;
}

export interface DailySales {
  date: string; // YYYY-MM-DD
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
}

export interface HourlySales {
  hour: number; // 0-23
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
}

export interface CancelledOrder {
  orderId: string;
  orderNumber: string;
  orderType: 'dine_in' | 'take_away' | 'delivery';
  orderDate: Date;
  cancellationReason: string | null;
  cancelledBy: string;
  cancelledByName: string;
  total: number;
}

export interface DailyExpenseReport {
  date: string; // YYYY-MM-DD
  totalExpenses: number;
  totalSales: number;
  netProfit: number;
  expensesByCategory: { category: string; amount: number }[];
}

export interface DiscountReportItem {
  orderId: string;
  orderNumber: string;
  orderDate: Date;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  discountReference: string | null;
  orderTotal: number;
  subtotal: number;
}

export interface CustomerDetailedReport {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  totalOrders: number;
  paidOrders: number;
  unpaidOrders: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  lastOrderDate: Date | null;
  orderHistory: CustomerOrderDetail[];
}

export interface CustomerOrderDetail {
  orderId: string;
  orderNumber: string;
  orderDate: Date;
  orderType: string;
  total: number;
  isPaid: boolean;
  status: string;
}

const buildRangeFilters = (range: DateRange): Record<string, string> => ({
  startDate: range.startDate.toISOString(),
  endDate: range.endDate.toISOString(),
});

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const parseDateValue = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveOrderDate = (order: Order): Date | null => {
  const raw = (order as any).completedAt || order.createdAt;
  return parseDateValue(raw);
};

const filterOrdersInRange = (orders: Order[], range: DateRange): Order[] => {
  const startTime = range.startDate.getTime();
  const endTime = range.endDate.getTime();
  return orders.filter((order) => {
    const date = resolveOrderDate(order);
    if (!date) return false;
    const time = date.getTime();
    return time >= startTime && time <= endTime;
  });
};

async function fetchPaymentsByOrderIds(orderIds: string[]): Promise<Payment[]> {
  if (orderIds.length === 0) return [];
  const chunks = chunkArray(orderIds, 200);
  const results = await Promise.all(
    chunks.map((ids) => apiClient.getPayments({ orderIds: ids.join(',') }))
  );
  return results.flat();
}

function buildCustomerReport(customer: Customer, orders: Order[]): CustomerDetailedReport {
  const totalOrders = orders.length;
  const paidOrders = orders.filter((o: Order) => o.isPaid).length;
  const unpaidOrders = totalOrders - paidOrders;

  const totalAmount = orders.reduce((sum: number, o: Order) => sum + o.total, 0);
  const paidAmount = orders
    .filter((o: Order) => o.isPaid)
    .reduce((sum: number, o: Order) => sum + o.total, 0);
  const unpaidAmount = totalAmount - paidAmount;

  const datedOrders = orders
    .map((order: Order) => ({
      order,
      orderDate: parseDateValue(order.createdAt),
    }))
    .filter((entry: { order: Order; orderDate: Date | null }): entry is { order: Order; orderDate: Date } => entry.orderDate !== null);

  const lastOrderDate = datedOrders.length > 0
    ? datedOrders.reduce((latest: Date, entry) => entry.orderDate > latest ? entry.orderDate : latest, datedOrders[0].orderDate)
    : null;

  const orderHistory: CustomerOrderDetail[] = datedOrders
    .map(({ order, orderDate }) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderDate,
      orderType: order.orderType,
      total: order.total,
      isPaid: order.isPaid,
      status: order.status,
    }))
    .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());

  return {
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    totalOrders,
    paidOrders,
    unpaidOrders,
    totalAmount,
    paidAmount,
    unpaidAmount,
    lastOrderDate,
    orderHistory,
  };
}

/**
 * Get sales summary for a date range
 */
export async function getSalesSummary(range: DateRange): Promise<SalesSummary> {
  const rangeFilters = buildRangeFilters(range);
  try {
    const summary = await apiClient.getSalesSummaryReport(rangeFilters);
    if (summary) {
      return summary as SalesSummary;
    }
  } catch (error) {
    console.warn('Sales summary report endpoint failed, falling back to client aggregation:', error);
  }

  const orders = filterOrdersInRange(
    await apiClient.getOrders({ ...rangeFilters, status: 'completed' }),
    range
  );

  const payments = await fetchPaymentsByOrderIds(orders.map((order: Order) => order.id));

  let totalSales = 0;
  let totalDiscounts = 0;
  let dineInSales = 0;
  let dineInOrders = 0;
  let takeAwaySales = 0;
  let takeAwayOrders = 0;
  let deliverySales = 0;
  let deliveryOrders = 0;
  let paidOrders = 0;
  let unpaidOrders = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;

  for (const order of orders) {
    totalSales += order.total;
    totalDiscounts += order.discountAmount;

    if (order.isPaid) {
      paidOrders++;
      paidAmount += order.total;
    } else {
      unpaidOrders++;
      unpaidAmount += order.total;
    }

    switch (order.orderType) {
      case 'dine_in':
        dineInSales += order.total;
        dineInOrders++;
        break;
      case 'take_away':
        takeAwaySales += order.total;
        takeAwayOrders++;
        break;
      case 'delivery':
        deliverySales += order.total;
        deliveryOrders++;
        break;
    }
  }

  // Calculate payment method totals
  const cashSales = payments
    .filter((p: Payment) => p.method === 'cash')
    .reduce((sum: number, p: Payment) => sum + p.amount, 0);
  const cardSales = payments
    .filter((p: Payment) => p.method === 'card')
    .reduce((sum: number, p: Payment) => sum + p.amount, 0);
  const onlineSales = payments
    .filter((p: Payment) => p.method === 'online')
    .reduce((sum: number, p: Payment) => sum + p.amount, 0);
  const otherSales = payments
    .filter((p: Payment) => p.method === 'other')
    .reduce((sum: number, p: Payment) => sum + p.amount, 0);

  // Count total items (non-critical — don't let this fail the entire summary)
  let totalItems = 0;
  try {
    const orderIdsForItems = orders.map((order: Order) => order.id);
    const orderItems = orderIdsForItems.length > 0
      ? await apiClient.getOrderItemsBulk({ orderIds: orderIdsForItems.join(',') })
      : [];
    totalItems = orderItems.reduce((sum: number, item: OrderItem) => sum + item.quantity, 0);
  } catch (error) {
    console.warn('Failed to fetch order items for total count, defaulting to 0:', error);
  }

  return {
    totalSales,
    totalOrders: orders.length,
    averageOrderValue: orders.length > 0 ? totalSales / orders.length : 0,
    totalItems,
    totalDiscounts,
    dineInSales,
    dineInOrders,
    takeAwaySales,
    takeAwayOrders,
    deliverySales,
    deliveryOrders,
    cashSales,
    cardSales,
    onlineSales,
    otherSales,
    paidOrders,
    unpaidOrders,
    paidAmount,
    unpaidAmount,
  };
}

/**
 * Get sales by category
 */
export async function getCategorySales(range: DateRange): Promise<CategorySales[]> {
  const rangeFilters = buildRangeFilters(range);
  try {
    const categories = await apiClient.getCategorySalesReport(rangeFilters);
    if (Array.isArray(categories)) {
      return categories as CategorySales[];
    }
  } catch (error) {
    console.warn('Category sales report endpoint failed, falling back to client aggregation:', error);
  }

  const orders = filterOrdersInRange(
    await apiClient.getOrders({ ...rangeFilters, status: 'completed' }),
    range
  );
  const orderIds = orders.map((order: Order) => order.id);
  const allItems = orderIds.length > 0
    ? await apiClient.getOrderItemsBulk({ orderIds: orderIds.join(',') }) as OrderItem[]
    : [];
  const orderItems = allItems.filter((item: OrderItem) => item.itemType === 'menu_item');

  const categories = await db.categories.toArray();
  const menuItems = await db.menuItems.toArray();

  // Group by category
  const categoryMap = new Map<string, {
    totalSales: number;
    totalQuantity: number;
    orderCount: Set<string>;
  }>();

  for (const item of orderItems) {
    if (!item.menuItemId) continue;

    const menuItem = menuItems.find((m: MenuItem) => m.id === item.menuItemId);
    if (!menuItem || !menuItem.categoryId) continue;

    const category = categories.find((c: Category) => c.id === menuItem.categoryId);
    if (!category) continue;

    if (!categoryMap.has(category.id)) {
      categoryMap.set(category.id, {
        totalSales: 0,
        totalQuantity: 0,
        orderCount: new Set(),
      });
    }

    const stats = categoryMap.get(category.id)!;
    stats.totalSales += item.totalPrice;
    stats.totalQuantity += item.quantity;
    stats.orderCount.add(item.orderId);
  }

  const result: CategorySales[] = [];
  for (const [categoryId, stats] of categoryMap.entries()) {
    const category = categories.find((c: Category) => c.id === categoryId);
    if (!category) continue;

    result.push({
      categoryId,
      categoryName: category.name,
      totalSales: stats.totalSales,
      totalQuantity: stats.totalQuantity,
      orderCount: stats.orderCount.size,
      averagePrice: stats.totalQuantity > 0 ? stats.totalSales / stats.totalQuantity : 0,
    });
  }

  return result.sort((a, b) => b.totalSales - a.totalSales);
}

/**
 * Get sales by menu item
 */
export async function getItemSales(range: DateRange): Promise<ItemSales[]> {
  const rangeFilters = buildRangeFilters(range);
  try {
    const items = await apiClient.getItemSalesReport(rangeFilters);
    if (Array.isArray(items)) {
      return items as ItemSales[];
    }
  } catch (error) {
    console.warn('Item sales report endpoint failed, falling back to client aggregation:', error);
  }

  const orders = filterOrdersInRange(
    await apiClient.getOrders({ ...rangeFilters, status: 'completed' }),
    range
  );
  const orderIds = orders.map((order: Order) => order.id);
  const allItems = orderIds.length > 0
    ? await apiClient.getOrderItemsBulk({ orderIds: orderIds.join(',') }) as OrderItem[]
    : [];
  const orderItems = allItems.filter((item: OrderItem) => item.itemType === 'menu_item');

  const menuItems = await db.menuItems.toArray();
  const categories = await db.categories.toArray();

  // Group by item
  const itemMap = new Map<string, {
    totalSales: number;
    totalQuantity: number;
    orderCount: Set<string>;
  }>();

  for (const item of orderItems) {
    if (!item.menuItemId) continue;

    if (!itemMap.has(item.menuItemId)) {
      itemMap.set(item.menuItemId, {
        totalSales: 0,
        totalQuantity: 0,
        orderCount: new Set(),
      });
    }

    const stats = itemMap.get(item.menuItemId)!;
    stats.totalSales += item.totalPrice;
    stats.totalQuantity += item.quantity;
    stats.orderCount.add(item.orderId);
  }

  const result: ItemSales[] = [];
  for (const [itemId, stats] of itemMap.entries()) {
    const menuItem = menuItems.find((m: MenuItem) => m.id === itemId);
    if (!menuItem) continue;

    const category = menuItem.categoryId
      ? categories.find((c: Category) => c.id === menuItem.categoryId)
      : null;

    result.push({
      itemId,
      itemName: menuItem.name,
      categoryId: menuItem.categoryId,
      categoryName: category?.name || null,
      totalSales: stats.totalSales,
      totalQuantity: stats.totalQuantity,
      orderCount: stats.orderCount.size,
      averagePrice: stats.totalQuantity > 0 ? stats.totalSales / stats.totalQuantity : 0,
    });
  }

  return result.sort((a, b) => b.totalSales - a.totalSales);
}

/**
 * Get sales by deal
 */
export async function getDealSales(range: DateRange): Promise<DealSales[]> {
  const rangeFilters = buildRangeFilters(range);
  try {
    const deals = await apiClient.getDealSalesReport(rangeFilters);
    if (Array.isArray(deals)) {
      return deals as DealSales[];
    }
  } catch (error) {
    console.warn('Deal sales report endpoint failed, falling back to client aggregation:', error);
  }

  const orders = filterOrdersInRange(
    await apiClient.getOrders({ ...rangeFilters, status: 'completed' }),
    range
  );
  const orderIds = orders.map((order: Order) => order.id);
  const allItems = orderIds.length > 0
    ? await apiClient.getOrderItemsBulk({ orderIds: orderIds.join(',') }) as OrderItem[]
    : [];
  const orderItems = allItems.filter((item: OrderItem) => item.itemType === 'deal');

  const deals = await db.deals.toArray();

  // Group by deal
  const dealMap = new Map<string, {
    totalSales: number;
    totalQuantity: number;
    orderCount: Set<string>;
  }>();

  for (const item of orderItems) {
    if (!item.dealId) continue;

    if (!dealMap.has(item.dealId)) {
      dealMap.set(item.dealId, {
        totalSales: 0,
        totalQuantity: 0,
        orderCount: new Set(),
      });
    }

    const stats = dealMap.get(item.dealId)!;
    stats.totalSales += item.totalPrice;
    stats.totalQuantity += item.quantity;
    stats.orderCount.add(item.orderId);
  }

  const result: DealSales[] = [];
  for (const [dealId, stats] of dealMap.entries()) {
    const deal = deals.find((d: Deal) => d.id === dealId);
    if (!deal) continue;

    result.push({
      dealId,
      dealName: deal.name,
      totalSales: stats.totalSales,
      totalQuantity: stats.totalQuantity,
      orderCount: stats.orderCount.size,
      averagePrice: stats.totalQuantity > 0 ? stats.totalSales / stats.totalQuantity : 0,
    });
  }

  return result.sort((a, b) => b.totalSales - a.totalSales);
}

/**
 * Get waiter performance
 */
export async function getWaiterPerformance(range: DateRange): Promise<WaiterPerformance[]> {
  const rangeFilters = buildRangeFilters(range);
  const orders = await apiClient.getOrders({ ...rangeFilters, status: 'completed', orderType: 'dine_in' });
  const dineInOrders = orders.filter((o: Order) => o.waiterId);

  const waiters = await db.waiters.toArray();

  // Group by waiter
  const waiterMap = new Map<string, {
    totalSales: number;
    orderCount: number;
    tables: Set<string>;
  }>();

  for (const order of dineInOrders) {
    if (!order.waiterId) continue;

    if (!waiterMap.has(order.waiterId)) {
      waiterMap.set(order.waiterId, {
        totalSales: 0,
        orderCount: 0,
        tables: new Set(),
      });
    }

    const stats = waiterMap.get(order.waiterId)!;
    stats.totalSales += order.total;
    stats.orderCount++;
    if (order.tableId) {
      stats.tables.add(order.tableId);
    }
  }

  const result: WaiterPerformance[] = [];
  for (const [waiterId, stats] of waiterMap.entries()) {
    const waiter = waiters.find((w: Waiter) => w.id === waiterId);
    if (!waiter) continue;

    result.push({
      waiterId,
      waiterName: waiter.name,
      totalOrders: stats.orderCount,
      totalSales: stats.totalSales,
      averageOrderValue: stats.orderCount > 0 ? stats.totalSales / stats.orderCount : 0,
      totalTables: stats.tables.size,
    });
  }

  return result.sort((a, b) => b.totalSales - a.totalSales);
}

/**
 * Get rider performance
 */
export async function getRiderPerformance(range: DateRange): Promise<RiderPerformance[]> {
  const rangeFilters = buildRangeFilters(range);
  const orders = await apiClient.getOrders({ ...rangeFilters, status: 'completed', orderType: 'delivery' });
  const deliveryOrders = orders.filter((o: Order) => o.riderId);

  const riders = await db.riders.toArray();

  // Group by rider
  const riderMap = new Map<string, {
    totalSales: number;
    orderCount: number;
  }>();

  for (const order of deliveryOrders) {
    if (!order.riderId) continue;

    if (!riderMap.has(order.riderId)) {
      riderMap.set(order.riderId, {
        totalSales: 0,
        orderCount: 0,
      });
    }

    const stats = riderMap.get(order.riderId)!;
    stats.totalSales += order.total;
    stats.orderCount++;
  }

  const result: RiderPerformance[] = [];
  for (const [riderId, stats] of riderMap.entries()) {
    const rider = riders.find((r: Rider) => r.id === riderId);
    if (!rider) continue;

    result.push({
      riderId,
      riderName: rider.name,
      totalDeliveries: stats.orderCount,
      totalSales: stats.totalSales,
      averageOrderValue: stats.orderCount > 0 ? stats.totalSales / stats.orderCount : 0,
    });
  }

  return result.sort((a, b) => b.totalSales - a.totalSales);
}

/**
 * Get register session summaries
 */
export async function getRegisterSessions(range: DateRange): Promise<RegisterSessionSummary[]> {
  const allSessions = await db.registerSessions.toArray();
  const sessions = allSessions.filter((session: RegisterSession) => {
    const openedAt = new Date(session.openedAt);
    return openedAt >= range.startDate && openedAt <= range.endDate;
  });

  const users = await db.users.toArray();

  const result: RegisterSessionSummary[] = [];

  const sessionIds = sessions.map((session: RegisterSession) => session.id);
  const orders = sessionIds.length > 0
    ? await apiClient.getOrders({ registerSessionIds: sessionIds.join(','), status: 'completed' })
    : [];

  const ordersBySession = new Map<string, Order[]>();
  for (const order of orders) {
    if (!ordersBySession.has(order.registerSessionId)) {
      ordersBySession.set(order.registerSessionId, []);
    }
    ordersBySession.get(order.registerSessionId)!.push(order);
  }

  const payments = await fetchPaymentsByOrderIds(orders.map((order: Order) => order.id));
  const paymentsByOrder = new Map<string, Payment[]>();
  for (const payment of payments) {
    if (!paymentsByOrder.has(payment.orderId)) {
      paymentsByOrder.set(payment.orderId, []);
    }
    paymentsByOrder.get(payment.orderId)!.push(payment);
  }

  for (const session of sessions) {
    const sessionOrders = ordersBySession.get(session.id) || [];
    const sessionPayments = sessionOrders.flatMap((order) => paymentsByOrder.get(order.id) || []);

    const openedByUser = users.find((u: User) => u.id === session.openedBy);
    const closedByUser = session.closedBy ? users.find((u: User) => u.id === session.closedBy) : null;

    const totalSales = sessionOrders.reduce((sum: number, o: Order) => sum + o.total, 0);
    const cashPayments = sessionPayments
      .filter((p: Payment) => p.method === 'cash')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0);
    const cardPayments = sessionPayments
      .filter((p: Payment) => p.method === 'card')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0);
    const onlinePayments = sessionPayments
      .filter((p: Payment) => p.method === 'online')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0);
    const otherPayments = sessionPayments
      .filter((p: Payment) => p.method === 'other')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0);

    result.push({
      sessionId: session.id,
      openedAt: parseDateValue(session.openedAt) || new Date(0),
      closedAt: parseDateValue(session.closedAt),
      openedBy: openedByUser?.fullName || 'Unknown',
      closedBy: closedByUser?.fullName || null,
      openingCash: session.openingCash,
      expectedCash: session.expectedCash,
      actualCash: session.closingCash,
      difference: session.cashDifference,
      totalSales,
      totalOrders: sessionOrders.length,
      cashPayments,
      cardPayments,
      onlinePayments,
      otherPayments,
    });
  }

  return result.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
}

/**
 * Get daily sales breakdown
 */
export async function getDailySales(range: DateRange): Promise<DailySales[]> {
  const rangeFilters = buildRangeFilters(range);
  try {
    const daily = await apiClient.getDailySalesReport(rangeFilters);
    if (Array.isArray(daily)) {
      return daily as DailySales[];
    }
  } catch (error) {
    console.warn('Daily sales report endpoint failed, falling back to client aggregation:', error);
  }

  const orders = filterOrdersInRange(
    await apiClient.getOrders({ ...rangeFilters, status: 'completed' }),
    range
  );

  // Group by date
  const dailyMap = new Map<string, {
    totalSales: number;
    orderCount: number;
  }>();

  for (const order of orders) {
    const d = resolveOrderDate(order);
    if (!d) continue;
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        totalSales: 0,
        orderCount: 0,
      });
    }

    const stats = dailyMap.get(date)!;
    stats.totalSales += order.total;
    stats.orderCount++;
  }

  const result: DailySales[] = [];
  for (const [date, stats] of dailyMap.entries()) {
    result.push({
      date,
      totalSales: stats.totalSales,
      totalOrders: stats.orderCount,
      averageOrderValue: stats.orderCount > 0 ? stats.totalSales / stats.orderCount : 0,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get hourly sales breakdown (for today)
 */
export async function getHourlySales(): Promise<HourlySales[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const orders = await apiClient.getOrders({
    startDate: today.toISOString(),
    endDate: tomorrow.toISOString(),
    status: 'completed',
  });

  // Group by hour
  const hourlyMap = new Map<number, {
    totalSales: number;
    orderCount: number;
  }>();

  for (const order of orders) {
    const hour = new Date(order.createdAt).getHours();

    if (!hourlyMap.has(hour)) {
      hourlyMap.set(hour, {
        totalSales: 0,
        orderCount: 0,
      });
    }

    const stats = hourlyMap.get(hour)!;
    stats.totalSales += order.total;
    stats.orderCount++;
  }

  const result: HourlySales[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const stats = hourlyMap.get(hour) || { totalSales: 0, orderCount: 0 };
    result.push({
      hour,
      totalSales: stats.totalSales,
      totalOrders: stats.orderCount,
      averageOrderValue: stats.orderCount > 0 ? stats.totalSales / stats.orderCount : 0,
    });
  }

  return result;
}

/**
 * Get cancelled orders report for a date range
 */
export async function getCancelledOrders(range: DateRange): Promise<CancelledOrder[]> {
  const rangeFilters = buildRangeFilters(range);
  const cancelledOrders = await apiClient.getOrders({ ...rangeFilters, status: 'cancelled' });

  const users = (await db.users.toArray()) as User[];
  const userMap = new Map<string, string>(users.map((u: User) => [u.id, u.fullName]));

  return cancelledOrders
    .map((order: Order) => {
      const orderDate = parseDateValue(order.createdAt);
      if (!orderDate) {
        return null;
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        orderDate,
        cancellationReason: order.cancellationReason,
        cancelledBy: order.completedBy || order.createdBy,
        cancelledByName: userMap.get(order.completedBy || order.createdBy) || 'Unknown',
        total: order.total,
      };
    })
    .filter((item: CancelledOrder | null): item is CancelledOrder => item !== null)
    .sort((a: CancelledOrder, b: CancelledOrder) => b.orderDate.getTime() - a.orderDate.getTime());
}

/**
 * Get daily expense report with sales - expenses = net profit
 */
export async function getDailyExpenseReport(range: DateRange): Promise<DailyExpenseReport[]> {
  const rangeFilters = buildRangeFilters(range);
  const completedOrders = await apiClient.getOrders({ ...rangeFilters, status: 'completed' });

  const allExpenses = await db.expenses.toArray();
  const expenses = allExpenses.filter((expense: Expense) => {
    const expenseDate = new Date(expense.date);
    return expenseDate >= range.startDate && expenseDate <= range.endDate;
  });

  // Group by date
  const dateMap = new Map<string, { sales: number; expenses: number; expensesByCategory: Map<string, number> }>();

  // Add sales
  completedOrders.forEach((order: Order) => {
    const d = new Date(order.createdAt);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const existing = dateMap.get(dateKey) || { sales: 0, expenses: 0, expensesByCategory: new Map() };
    existing.sales += order.total;
    dateMap.set(dateKey, existing);
  });

  // Add expenses
  expenses.forEach((expense: Expense) => {
    const d = new Date(expense.date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const existing = dateMap.get(dateKey) || { sales: 0, expenses: 0, expensesByCategory: new Map() };
    existing.expenses += expense.amount;

    const catAmount = existing.expensesByCategory.get(expense.category) || 0;
    existing.expensesByCategory.set(expense.category, catAmount + expense.amount);

    dateMap.set(dateKey, existing);
  });

  const result: DailyExpenseReport[] = [];
  for (const [date, data] of dateMap.entries()) {
    const expensesByCategory = Array.from(data.expensesByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    result.push({
      date,
      totalExpenses: data.expenses,
      totalSales: data.sales,
      netProfit: data.sales - data.expenses,
      expensesByCategory,
    });
  }

  return result.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get discounted orders report
 */
export async function getDiscountedOrders(range: DateRange): Promise<DiscountReportItem[]> {
  const rangeFilters = buildRangeFilters(range);
  const orders = (await apiClient.getOrders({ ...rangeFilters, status: 'completed' }))
    .filter((o: Order) => o.discountAmount > 0);

  return orders
    .map((order: Order) => {
      const orderDate = new Date(order.createdAt);
      if (Number.isNaN(orderDate.getTime())) {
        return null;
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderDate,
        discountType: order.discountType!,
        discountValue: order.discountValue,
        discountAmount: order.discountAmount,
        discountReference: order.discountReference,
        orderTotal: order.total,
        subtotal: order.subtotal,
      };
    })
    .filter((item: DiscountReportItem | null): item is DiscountReportItem => item !== null)
    .sort((a: DiscountReportItem, b: DiscountReportItem) => b.orderDate.getTime() - a.orderDate.getTime());
}

/**
 * Get customer detailed report
 */
export async function getCustomerDetailedReport(customerId: string): Promise<CustomerDetailedReport | null> {
  const customer = await db.customers.get(customerId);
  if (!customer) return null;

  const allOrders = (await apiClient.getOrders({ customerId })) as Order[];

  return buildCustomerReport(customer, allOrders);
}

/**
 * Search customer reports by name or phone
 */
export async function searchCustomerReports(query: string): Promise<CustomerDetailedReport[]> {
  const customers = (await db.customers.toArray()) as Customer[];
  const lowerQuery = query.toLowerCase();

  const matchingCustomers = customers.filter(
    (customer: Customer) =>
      customer.name.toLowerCase().includes(lowerQuery) ||
      customer.phone.includes(query)
  );

  if (matchingCustomers.length === 0) {
    return [];
  }

  const customerIds = matchingCustomers.map((customer) => customer.id);
  const orders = (await apiClient.getOrders({ customerIds: customerIds.join(',') })) as Order[];

  const ordersByCustomer = new Map<string, Order[]>();
  for (const order of orders) {
    if (!order.customerId) continue;
    if (!ordersByCustomer.has(order.customerId)) {
      ordersByCustomer.set(order.customerId, []);
    }
    ordersByCustomer.get(order.customerId)!.push(order);
  }

  const reports = matchingCustomers.map((customer) => {
    const customerOrders = ordersByCustomer.get(customer.id) || [];
    return buildCustomerReport(customer, customerOrders);
  });

  return reports.sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Export data to CSV format
 */
export function exportToCSV(data: any[], filename: string): void {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle values that contain commas or quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
