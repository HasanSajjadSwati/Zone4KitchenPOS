import { db } from '@/db';
import { createId } from '@/utils/uuid';
import type {
  Order,
  OrderItem,
  Payment,
  VariantSelection,
  DealItemBreakdown,
  Variant,
  VariantOption,
  SelectionMode,
} from '@/db/types';
import { logAudit } from '@/utils/audit';
import { useAuthStore } from '@/stores/authStore';

// Validation helper for variant selections
export function validateVariantSelections(
  itemVariants: Array<{
    variant: Variant;
    options: VariantOption[];
    isRequired: boolean;
    selectionMode: SelectionMode;
  }>,
  selectedVariants: VariantSelection[]
): { valid: boolean; error?: string } {
  for (const iv of itemVariants) {
    const selection = selectedVariants.find(sv => sv.variantId === iv.variant.id);

    if (iv.isRequired && !selection) {
      return { valid: false, error: `${iv.variant.name} is required` };
    }

    if (selection) {
      switch (iv.selectionMode) {
        case 'single':
          // Must have exactly one option selected
          if (!selection.optionId) {
            return { valid: false, error: `Select one option for ${iv.variant.name}` };
          }
          break;

        case 'multiple':
          // Must have at least one option selected
          if (!selection.selectedOptions || selection.selectedOptions.length === 0) {
            return { valid: false, error: `Select at least one option for ${iv.variant.name}` };
          }
          break;

        case 'all':
          // For 'all' mode, at least one option must be selected (user can unselect but needs at least one)
          if (iv.isRequired && (!selection.selectedOptions || selection.selectedOptions.length === 0)) {
            return { valid: false, error: `At least one option required for ${iv.variant.name}` };
          }
          break;
      }
    }
  }

  return { valid: true };
}

interface CreateOrderParams {
  orderType: 'dine_in' | 'take_away' | 'delivery';
  registerSessionId: string;
  tableId?: string;
  waiterId?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  riderId?: string;
  deliveryAddress?: string;
  notes?: string;
  userId: string;
}

export async function createOrder(params: CreateOrderParams): Promise<Order> {
  // Note: orderNumber is generated on the backend to ensure uniqueness and avoid duplicates on app restart
  const orderData = {
    registerSessionId: params.registerSessionId,
    orderType: params.orderType,
    tableId: params.tableId || null,
    waiterId: params.waiterId || null,
    customerName: params.customerName || null,
    customerPhone: params.customerPhone || null,
    customerId: params.customerId || null,
    riderId: params.riderId || null,
    deliveryAddress: params.deliveryAddress || null,
    subtotal: 0,
    discountType: null,
    discountValue: 0,
    discountAmount: 0,
    total: 0,
    createdBy: params.userId,
    notes: params.notes || null,
  };

  // Backend will generate orderNumber and return complete order
  const newOrder = await db.orders.add(orderData);

  await logAudit({
    userId: params.userId,
    action: 'create',
    tableName: 'orders',
    recordId: newOrder.id,
    description: `Created ${params.orderType} order ${newOrder.orderNumber}`,
    after: newOrder,
  });

  return newOrder;
}

interface AddMenuItemParams {
  orderId: string;
  menuItemId: string;
  quantity: number;
  selectedVariants: VariantSelection[];
  notes?: string;
  userId: string;
}

export async function addMenuItem(params: AddMenuItemParams): Promise<OrderItem> {
  const menuItem = await db.menuItems.get(params.menuItemId);
  if (!menuItem) throw new Error('Menu item not found');

  // Calculate price with variant modifiers (support both single and multi-select)
  let variantsTotal = 0;
  params.selectedVariants.forEach((variant) => {
    if (variant.selectedOptions && variant.selectedOptions.length > 0) {
      // Multi-select or all mode: sum all selected options
      variantsTotal += variant.selectedOptions.reduce((sum, opt) => sum + opt.priceModifier, 0);
    } else {
      // Single select: use the single priceModifier
      variantsTotal += variant.priceModifier;
    }
  });

  const unitPrice = menuItem.price + variantsTotal;
  const totalPrice = unitPrice * params.quantity;

  const orderItem: OrderItem = {
    id: createId(),
    orderId: params.orderId,
    itemType: 'menu_item',
    menuItemId: params.menuItemId,
    dealId: null,
    quantity: params.quantity,
    unitPrice,
    totalPrice,
    notes: params.notes || null,
    selectedVariants: params.selectedVariants,
    dealBreakdown: null,
    addedAt: new Date(),
    lastPrintedAt: null,
    createdAt: new Date(),
  };

  await db.orderItems.add(orderItem);
  await recalculateOrderTotal(params.orderId);

  await logAudit({
    userId: params.userId,
    action: 'create',
    tableName: 'orderItems',
    recordId: orderItem.id,
    description: `Added ${params.quantity}x ${menuItem.name} to order`,
    after: orderItem,
  });

  return orderItem;
}

interface AddDealParams {
  orderId: string;
  dealId: string;
  quantity: number;
  dealBreakdown: DealItemBreakdown[];
  selectedVariants?: VariantSelection[];
  notes?: string;
  userId: string;
}

export async function addDeal(params: AddDealParams): Promise<OrderItem> {
  const deal = await db.deals.get(params.dealId);
  if (!deal) throw new Error('Deal not found');

  const totalPrice = deal.price * params.quantity;

  const orderItem: OrderItem = {
    id: createId(),
    orderId: params.orderId,
    itemType: 'deal',
    menuItemId: null,
    dealId: params.dealId,
    quantity: params.quantity,
    unitPrice: deal.price,
    totalPrice,
    notes: params.notes || null,
    selectedVariants: params.selectedVariants || [],
    dealBreakdown: params.dealBreakdown,
    addedAt: new Date(),
    lastPrintedAt: null,
    createdAt: new Date(),
  };

  await db.orderItems.add(orderItem);
  await recalculateOrderTotal(params.orderId);

  await logAudit({
    userId: params.userId,
    action: 'create',
    tableName: 'orderItems',
    recordId: orderItem.id,
    description: `Added ${params.quantity}x ${deal.name} deal to order`,
    after: orderItem,
  });

  return orderItem;
}

export async function updateOrderItemQuantity(
  itemId: string,
  quantity: number,
  userId: string
): Promise<void> {
  const item = await db.orderItems.get(itemId);
  if (!item) throw new Error('Order item not found');

  const newTotalPrice = (item.totalPrice / item.quantity) * quantity;

  await db.orderItems.update(itemId, {
    quantity,
    totalPrice: newTotalPrice,
  });

  await recalculateOrderTotal(item.orderId);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'orderItems',
    recordId: itemId,
    description: `Updated quantity to ${quantity}`,
    before: item,
    after: { ...item, quantity, totalPrice: newTotalPrice },
  });
}

export interface UpdateOrderItemVariantsParams {
  itemId: string;
  selectedVariants: VariantSelection[];
  notes?: string;
  userId: string;
}

export async function updateOrderItemVariants(
  params: UpdateOrderItemVariantsParams
): Promise<void> {
  const item = await db.orderItems.get(params.itemId);
  if (!item) throw new Error('Order item not found');

  if (item.itemType !== 'menu_item') {
    throw new Error('Cannot update variants for deal items');
  }

  const menuItem = await db.menuItems.get(item.menuItemId!);
  if (!menuItem) throw new Error('Menu item not found');

  // Calculate new price based on variant selections (support both single and multi-select)
  let variantsTotal = 0;
  params.selectedVariants.forEach((variant) => {
    if (variant.selectedOptions && variant.selectedOptions.length > 0) {
      // Multi-select or all mode: sum all selected options
      variantsTotal += variant.selectedOptions.reduce((sum, opt) => sum + opt.priceModifier, 0);
    } else {
      // Single select: use the single priceModifier
      variantsTotal += variant.priceModifier;
    }
  });

  const newUnitPrice = menuItem.price + variantsTotal;
  const newTotalPrice = newUnitPrice * item.quantity;

  const before = { ...item };

  await db.orderItems.update(params.itemId, {
    selectedVariants: params.selectedVariants,
    notes: params.notes || null,
    unitPrice: newUnitPrice,
    totalPrice: newTotalPrice,
  });

  await recalculateOrderTotal(item.orderId);

  await logAudit({
    userId: params.userId,
    action: 'update',
    tableName: 'orderItems',
    recordId: params.itemId,
    description: `Updated item variants`,
    before,
    after: { ...item, selectedVariants: params.selectedVariants, notes: params.notes, unitPrice: newUnitPrice, totalPrice: newTotalPrice },
  });
}

export async function removeOrderItem(itemId: string, userId: string): Promise<void> {
  const item = await db.orderItems.get(itemId);
  if (!item) throw new Error('Order item not found');

  const orderId = item.orderId;

  await db.orderItems.delete(itemId);
  await recalculateOrderTotal(orderId);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'orderItems',
    recordId: itemId,
    description: `Removed item from order`,
    before: item,
  });
}

interface ApplyDiscountParams {
  orderId: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountReference?: string;
  userId: string;
}

export async function applyDiscount(params: ApplyDiscountParams): Promise<void> {
  // Check permission - only Admin and Manager can apply discounts
  const { currentRole } = useAuthStore.getState();
  if (!currentRole || !currentRole.permissions.some(
    p => p.resource === 'discounts' && p.actions.includes('create')
  )) {
    throw new Error('Unauthorized: Only Managers and Admins can apply discounts');
  }

  const order = await db.orders.get(params.orderId);
  if (!order) throw new Error('Order not found');

  let discountAmount = 0;
  if (params.discountType === 'percentage') {
    discountAmount = (order.subtotal * params.discountValue) / 100;
  } else {
    discountAmount = params.discountValue;
  }

  const newTotal = Math.max(0, order.subtotal - discountAmount);

  await db.orders.update(params.orderId, {
    discountType: params.discountType,
    discountValue: params.discountValue,
    discountReference: params.discountReference || null,
    discountAmount,
    total: newTotal,
    updatedAt: new Date(),
  });

  await logAudit({
    userId: params.userId,
    action: 'update',
    tableName: 'orders',
    recordId: params.orderId,
    description: `Applied ${params.discountType} discount of ${params.discountValue}`,
    before: order,
    after: { ...order, discountAmount, total: newTotal },
  });
}

export async function removeDiscount(orderId: string, userId: string): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Order not found');

  await db.orders.update(orderId, {
    discountType: null,
    discountValue: 0,
    discountReference: null,
    discountAmount: 0,
    total: order.subtotal,
    updatedAt: new Date(),
  });

  await logAudit({
    userId,
    action: 'update',
    tableName: 'orders',
    recordId: orderId,
    description: `Removed discount`,
    before: order,
  });
}

interface CompleteOrderParams {
  orderId: string;
  isPaid: boolean;
  paymentMethod?: 'cash' | 'card' | 'online' | 'other';
  paymentAmount?: number;
  paymentReference?: string;
  userId: string;
}

export async function completeOrder(params: CompleteOrderParams): Promise<void> {
  const order = await db.orders.get(params.orderId);
  if (!order) throw new Error('Order not found');

  await db.transaction('rw', [db.orders, db.payments, db.customers], async () => {
    // Update order
    await db.orders.update(params.orderId, {
      status: 'completed',
      isPaid: params.isPaid,
      completedBy: params.userId,
      completedAt: new Date(),
      updatedAt: new Date(),
    });

    // Record payment if paid
    if (params.isPaid && params.paymentMethod) {
      const payment: Payment = {
        id: createId(),
        orderId: params.orderId,
        amount: params.paymentAmount || order.total,
        method: params.paymentMethod,
        reference: params.paymentReference || null,
        paidAt: new Date(),
        receivedBy: params.userId,
        notes: null,
        createdAt: new Date(),
      };
      await db.payments.add(payment);
    }

    // Update customer stats if delivery
    if (order.customerId) {
      const customer = await db.customers.get(order.customerId);
      if (customer) {
        await db.customers.update(order.customerId, {
          lastOrderAt: new Date(),
          totalOrders: customer.totalOrders + 1,
          updatedAt: new Date(),
        });
      }
    }
  });

  await logAudit({
    userId: params.userId,
    action: 'update',
    tableName: 'orders',
    recordId: params.orderId,
    description: `Completed order ${order.orderNumber}, paid: ${params.isPaid}`,
    before: order,
  });
}

export async function cancelOrder(
  orderId: string,
  userId: string,
  cancellationReason: string
): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Order not found');

  await db.orders.update(orderId, {
    status: 'cancelled',
    cancellationReason,
    updatedAt: new Date(),
  });

  await logAudit({
    userId,
    action: 'update',
    tableName: 'orders',
    recordId: orderId,
    description: `Cancelled order ${order.orderNumber}${cancellationReason ? `: ${cancellationReason}` : ''}`,
    before: order,
  });
}

interface MarkAsPaidParams {
  orderId: string;
  paymentMethod: 'cash' | 'card' | 'online' | 'other';
  paymentAmount?: number;
  paymentReference?: string;
  userId: string;
}

export async function markOrderAsPaid(params: MarkAsPaidParams): Promise<void> {
  const order = await db.orders.get(params.orderId);
  if (!order) throw new Error('Order not found');

  if (order.status === 'completed') {
    throw new Error('Cannot mark completed order as paid');
  }

  await db.transaction('rw', [db.orders, db.payments], async () => {
    // Update order as paid
    await db.orders.update(params.orderId, {
      isPaid: true,
      updatedAt: new Date(),
    });

    // Record payment
    const payment: Payment = {
      id: createId(),
      orderId: params.orderId,
      amount: params.paymentAmount || order.total,
      method: params.paymentMethod,
      reference: params.paymentReference || null,
      paidAt: new Date(),
      receivedBy: params.userId,
      notes: null,
      createdAt: new Date(),
    };
    await db.payments.add(payment);
  });

  await logAudit({
    userId: params.userId,
    action: 'update',
    tableName: 'orders',
    recordId: params.orderId,
    description: `Marked order ${order.orderNumber} as paid (${params.paymentMethod})`,
    before: order,
  });
}

export async function getOrder(orderId: string): Promise<Order | undefined> {
  return await db.orders.get(orderId);
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  return await db.orderItems.where('orderId').equals(orderId).toArray();
}

export async function getOpenOrders(): Promise<Order[]> {
  return await db.orders.where('status').equals('open').reverse().sortBy('createdAt');
}

export async function getOrdersByType(orderType: string): Promise<Order[]> {
  return await db.orders.where('orderType').equals(orderType).reverse().sortBy('createdAt');
}

export async function getTodaysOrders(): Promise<Order[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await db.orders
    .where('createdAt')
    .aboveOrEqual(today)
    .reverse()
    .sortBy('createdAt');
}

export async function updateDeliveryStatus(
  orderId: string,
  deliveryStatus: 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered',
  userId: string
): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Order not found');

  if (order.orderType !== 'delivery') {
    throw new Error('Can only update delivery status for delivery orders');
  }

  await db.orders.update(orderId, {
    deliveryStatus,
    updatedAt: new Date(),
  });

  await logAudit({
    userId,
    action: 'update',
    tableName: 'orders',
    recordId: orderId,
    description: `Updated delivery status to ${deliveryStatus} for order ${order.orderNumber}`,
    before: { deliveryStatus: order.deliveryStatus },
    after: { deliveryStatus },
  });
}

// Helper function to recalculate order totals
async function recalculateOrderTotal(orderId: string): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) return;

  const items = await db.orderItems.where('orderId').equals(orderId).toArray();
  const subtotal = items.reduce((sum: number, item: OrderItem) => sum + item.totalPrice, 0);

  let discountAmount = 0;
  if (order.discountType === 'percentage') {
    discountAmount = (subtotal * order.discountValue) / 100;
  } else if (order.discountType === 'fixed') {
    discountAmount = order.discountValue;
  }

  const total = Math.max(0, subtotal - discountAmount);

  await db.orders.update(orderId, {
    subtotal,
    discountAmount,
    total,
    updatedAt: new Date(),
  });
}
