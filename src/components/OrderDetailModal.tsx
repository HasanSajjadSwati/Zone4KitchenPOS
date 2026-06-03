import React, { useEffect, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { getOrderWithItems } from '@/services/orderService';
import { formatCurrency, formatDateTime } from '@/utils/validation';
import type { Order, OrderItem } from '@/db/types';
import { db } from '@/db';

interface OrderDetailModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const DELIVERY_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-800' },
  { value: 'preparing', label: 'Preparing', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'ready', label: 'Ready', color: 'bg-blue-100 text-blue-800' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-purple-100 text-purple-800' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-800' },
] as const;

const getDeliveryStatusInfo = (status: string | null) => {
  const info = DELIVERY_STATUSES.find(s => s.value === status);
  return info || { value: status, label: status || 'Unknown', color: 'bg-gray-100 text-gray-800' };
};

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ orderId, isOpen, onClose }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [menuItemNames, setMenuItemNames] = useState<Record<string, string>>({});
  const [dealNames, setDealNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderDetails(orderId);
    }
    if (!isOpen) {
      setOrder(null);
      setOrderItems([]);
    }
  }, [isOpen, orderId]);

  const loadOrderDetails = async (id: string) => {
    setIsLoading(true);
    try {
      // Backend GET /orders/:id checks both active and past orders
      const result = await getOrderWithItems(id);

      if (result) {
        setOrder(result.order);
        setOrderItems(result.items);
      } else {
        setOrder(null);
        setOrderItems([]);
      }

      // Load menu item and deal names for display
      const menuItems = await db.menuItems.toArray();
      const deals = await db.deals.toArray();
      const miMap: Record<string, string> = {};
      const dMap: Record<string, string> = {};
      for (const mi of menuItems) miMap[mi.id] = mi.name;
      for (const d of deals) dMap[d.id] = d.name;
      setMenuItemNames(miMap);
      setDealNames(dMap);
    } catch (error) {
      console.error('Failed to load order details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getItemDisplayName = (item: OrderItem) => {
    if (item.itemType === 'menu_item') {
      return item.menuItemId ? menuItemNames[item.menuItemId] || item.itemName || 'Unknown Item' : 'Unknown Item';
    }
    return item.dealId ? dealNames[item.dealId] || item.itemName || 'Unknown Deal' : 'Unknown Deal';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={order ? `Order Details - ${order.orderNumber}` : 'Order Details'}
      size="lg"
    >
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading order details...</div>
      ) : !order ? (
        <div className="text-center py-12 text-gray-400">Order not found</div>
      ) : (
        <div className="space-y-4">
          {/* Order Info Grid */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-semibold">{order.status.toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment</p>
              <p className="font-semibold">{order.isPaid ? 'PAID' : 'UNPAID'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Type</p>
              <p className="font-semibold">{order.orderType.replace('_', ' ').toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="font-semibold">{formatDateTime(order.createdAt)}</p>
            </div>
            {order.orderType === 'delivery' && (
              <div>
                <p className="text-sm text-gray-600">Delivery Status</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getDeliveryStatusInfo(order.deliveryStatus).color}`}>
                  {getDeliveryStatusInfo(order.deliveryStatus).label}
                </span>
              </div>
            )}
            {order.customerName && (
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-semibold">{order.customerName}</p>
                {order.customerPhone && (
                  <p className="text-sm text-gray-500">{order.customerPhone}</p>
                )}
              </div>
            )}
            {order.deliveryAddress && (
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Delivery Address</p>
                <p className="font-semibold">{order.deliveryAddress}</p>
              </div>
            )}
            {order.cancellationReason && (
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Cancellation Reason</p>
                <p className="font-semibold text-red-600">{order.cancellationReason}</p>
              </div>
            )}
            {order.notes && (
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Notes</p>
                <p className="font-semibold text-gray-700">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
            <div className="space-y-2">
              {orderItems.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {item.quantity}x {getItemDisplayName(item)}
                    </p>
                    {item.selectedVariants && item.selectedVariants.length > 0 && (
                      <p className="text-sm text-gray-600">
                        {item.selectedVariants
                          .map((v) => {
                            if (v.selectedOptions && v.selectedOptions.length > 0) {
                              const optionNames = v.selectedOptions.map((o) => o.optionName).join(', ');
                              return `${v.variantName}: ${optionNames}`;
                            }
                            return `${v.variantName}: ${v.optionName}`;
                          })
                          .join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-sm text-gray-500 italic">{item.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">{formatCurrency(item.unitPrice)} each</p>
                    <p className="font-bold text-gray-900">{formatCurrency(item.totalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">{formatCurrency(order.subtotal)}</span>
            </div>

            {order.discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>
                  Discount
                  {order.discountReference && ` (${order.discountReference})`}
                  :
                </span>
                <span className="font-semibold">-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}

            {order.orderType === 'delivery' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Charges:</span>
                <span className="font-semibold">{formatCurrency(order.deliveryCharge)}</span>
              </div>
            )}

            <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
              <span>Total:</span>
              <span className="text-primary-600">{formatCurrency(order.total)}</span>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
