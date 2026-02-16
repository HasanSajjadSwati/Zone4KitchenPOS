import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  PrinterIcon,
  XMarkIcon,
  PencilIcon,
  CurrencyDollarIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { Button, Card, Modal, Select, Input } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  getOrdersPaginated,
  getOrderItems,
  cancelOrder,
  markOrderAsPaid,
  updateDeliveryStatus,
} from '@/services/orderService';
import { printKOT, printCustomerReceipt } from '@/services/printService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { useSyncRefresh } from '@/contexts/SyncContext';
import { useDayRange } from '@/hooks/useDayRange';
import { formatCurrency, formatDateTime } from '@/utils/validation';
import type { Order, OrderItem, MenuItem, Deal } from '@/db/types';
import { db } from '@/db';

const paymentSchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'online', 'other']),
  paymentAmount: z.number().optional(),
  paymentReference: z.string().optional(),
});

const cancelSchema = z.object({
  cancellationReason: z.string().min(3, 'Reason must be at least 3 characters').max(500, 'Reason is too long'),
});

type PaymentFormData = z.infer<typeof paymentSchema>;
type CancelFormData = z.infer<typeof cancelSchema>;

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

export const OrderList: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const { getTodayRange, ready: dayRangeReady } = useDayRange();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'completed' | 'cancelled'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeliveryStatusModalOpen, setIsDeliveryStatusModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [menuItemNameById, setMenuItemNameById] = useState<Record<string, string>>({});
  const [dealNameById, setDealNameById] = useState<Record<string, string>>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const pageSize = 50; // Orders per page);

  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentMethod: 'cash' },
  });

  const cancelForm = useForm<CancelFormData>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { cancellationReason: '' },
  });

  useEffect(() => {
    if (dayRangeReady) loadOrders();
  }, [filterStatus, filterType, filterPayment, currentPage, dayRangeReady]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterType, filterPayment]);

  useEffect(() => {
    const loadItemLookups = async () => {
      try {
        const [menuItems, deals] = await Promise.all([
          db.menuItems.toArray(),
          db.deals.toArray(),
        ]);
        const menuItemNames: Record<string, string> = {};
        const dealNames: Record<string, string> = {};

        (menuItems as MenuItem[]).forEach((item) => {
          menuItemNames[item.id] = item.name;
        });

        (deals as Deal[]).forEach((deal) => {
          dealNames[deal.id] = deal.name;
        });

        setMenuItemNameById(menuItemNames);
        setDealNameById(dealNames);
      } catch (error) {
        console.warn('Failed to load item names for order details:', error);
      }
    };

    loadItemLookups();
  }, []);

  const getItemDisplayName = (item: OrderItem) => {
    if (item.itemType === 'menu_item') {
      return item.menuItemId ? menuItemNameById[item.menuItemId] || 'Unknown Item' : 'Unknown Item';
    }
    return item.dealId ? dealNameById[item.dealId] || 'Unknown Deal' : 'Unknown Deal';
  };

  const loadOrders = useCallback(async () => {
    // Use day range based on setting (register session or calendar day)
    const { startDate: rangeStart, endDate: rangeEnd } = await getTodayRange();

    const startDate = rangeStart.toISOString();
    const endDate = rangeEnd.toISOString();

    const result = await getOrdersPaginated({
      status: filterStatus !== 'all' ? filterStatus : undefined,
      orderType: filterType !== 'all' ? filterType : undefined,
      isPaid: filterPayment === 'paid' ? true : filterPayment === 'unpaid' ? false : undefined,
      startDate,
      endDate,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    });

    setOrders(result.orders);
    setTotalOrders(result.total);
  }, [filterStatus, filterType, filterPayment, currentPage, pageSize, getTodayRange]);

  // Real-time sync: auto-refresh when orders/payments change on other terminals
  useSyncRefresh(['orders', 'order_items', 'payments'], loadOrders);

  const handleViewDetails = async (order: Order) => {
    setSelectedOrder(order);
    const items = await getOrderItems(order.id);
    setSelectedOrderItems(items);
    setIsDetailsModalOpen(true);
  };

  const openCancelModal = async (order: Order) => {
    setSelectedOrder(order);
    cancelForm.reset({ cancellationReason: '' });
    setIsCancelModalOpen(true);
  };

  const handleCancelOrder = async (data: CancelFormData) => {
    if (!currentUser || !selectedOrder) return;

    setIsLoading(true);
    try {
      await cancelOrder(selectedOrder.id, currentUser.id, data.cancellationReason);
      setIsCancelModalOpen(false);
      await loadOrders();
      await dialog.alert('Order cancelled successfully', 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to cancel order', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintKOT = async (orderId: string) => {
    if (!currentUser) return;

    try {
      await printKOT(orderId, currentUser.id, false);
      await dialog.alert('KOT printed successfully!', 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to print KOT', 'Error');
    }
  };

  const handlePrintReceipt = async (orderId: string) => {
    if (!currentUser) return;

    try {
      await printCustomerReceipt(orderId, currentUser.id);
      await dialog.alert('Receipt printed successfully!', 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to print receipt', 'Error');
    }
  };

  const handleEditOrder = (orderId: string) => {
    navigate(`/orders/new?orderId=${orderId}`);
  };

  const openDeliveryStatusModal = (order: Order) => {
    setSelectedOrder(order);
    setIsDeliveryStatusModalOpen(true);
  };

  const handleUpdateDeliveryStatus = async (newStatus: string) => {
    if (!currentUser || !selectedOrder) return;

    setIsLoading(true);
    try {
      await updateDeliveryStatus(
        selectedOrder.id,
        newStatus as 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered',
        currentUser.id
      );
      setIsDeliveryStatusModalOpen(false);
      await loadOrders();
      await dialog.alert(`Delivery status updated to "${getDeliveryStatusInfo(newStatus).label}"`, 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to update delivery status', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const openPaymentModal = (order: Order) => {
    setSelectedOrder(order);
    paymentForm.reset({
      paymentMethod: 'cash',
      paymentAmount: order.total,
    });
    setIsPaymentModalOpen(true);
  };

  const handleMarkAsPaid = async (data: PaymentFormData) => {
    if (!currentUser || !selectedOrder) return;

    setIsLoading(true);
    try {
      await markOrderAsPaid({
        orderId: selectedOrder.id,
        paymentMethod: data.paymentMethod,
        paymentAmount: data.paymentAmount,
        paymentReference: data.paymentReference,
        userId: currentUser.id,
      });

      await loadOrders();
      setIsPaymentModalOpen(false);
      await dialog.alert('Order marked as paid successfully!', 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to mark order as paid', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Today's Orders</h1>
        <Button onClick={() => navigate('/orders/new')} variant="primary">
          New Order
        </Button>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          <Select
            label="Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="dine_in">Dine In</option>
            <option value="take_away">Take Away</option>
            <option value="delivery">Delivery</option>
          </Select>

          <Select
            label="Payment"
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value as any)}
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </Select>

          <div className="flex items-end">
            <Button
              fullWidth
              variant="secondary"
              onClick={loadOrders}
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 gap-4">
        {orders.map((order) => (
          <Card key={order.id} padding="md" hoverable>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="font-bold text-gray-900 text-lg">
                    {order.orderNumber}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      order.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'open'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {order.status.toUpperCase()}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      order.isPaid
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {order.isPaid ? 'PAID' : 'UNPAID'}
                  </span>
                  <span className="text-sm text-gray-600">
                    {order.orderType.replace('_', ' ').toUpperCase()}
                  </span>
                  {order.orderType === 'delivery' && order.deliveryStatus && (
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getDeliveryStatusInfo(order.deliveryStatus).color}`}
                    >
                      {getDeliveryStatusInfo(order.deliveryStatus).label}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Created</p>
                    <p className="font-semibold">{formatDateTime(order.createdAt)}</p>
                  </div>

                  {order.customerName && (
                    <div>
                      <p className="text-gray-600">Customer</p>
                      <p className="font-semibold">{order.customerName}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-gray-600">Subtotal</p>
                    <p className="font-semibold">{formatCurrency(order.subtotal)}</p>
                  </div>

                  <div>
                    <p className="text-gray-600">Total</p>
                    <p className="font-bold text-primary-600 text-lg">
                      {formatCurrency(order.total)}
                    </p>
                  </div>
                </div>

                {order.notes && (
                  <p className="text-sm text-gray-500 italic mt-2">{order.notes}</p>
                )}
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleViewDetails(order)}
                  leftIcon={<EyeIcon className="w-4 h-4" />}
                >
                  View
                </Button>

                {order.status === 'open' && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleEditOrder(order.id)}
                      leftIcon={<PencilIcon className="w-4 h-4" />}
                    >
                      Edit
                    </Button>
                    {order.orderType === 'delivery' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openDeliveryStatusModal(order)}
                        leftIcon={<TruckIcon className="w-4 h-4" />}
                      >
                        Delivery
                      </Button>
                    )}
                    {!order.isPaid && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => openPaymentModal(order)}
                        leftIcon={<CurrencyDollarIcon className="w-4 h-4" />}
                      >
                        Mark Paid
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handlePrintKOT(order.id)}
                      leftIcon={<PrinterIcon className="w-4 h-4" />}
                    >
                      KOT
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => openCancelModal(order)}
                      leftIcon={<XMarkIcon className="w-4 h-4" />}
                    >
                      Cancel
                    </Button>
                  </>
                )}

                {order.status === 'completed' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePrintReceipt(order.id)}
                    leftIcon={<PrinterIcon className="w-4 h-4" />}
                  >
                    Receipt
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}

        {orders.length === 0 && (
          <Card padding="lg">
            <div className="text-center text-gray-500 py-12">
              <p>No orders found matching your filters</p>
            </div>
          </Card>
        )}

        {/* Pagination Controls */}
        {totalOrders > pageSize && (
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalOrders)} of {totalOrders} orders
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="px-3 py-1 text-sm bg-gray-100 rounded">
                Page {currentPage} of {Math.ceil(totalOrders / pageSize)}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= Math.ceil(totalOrders / pageSize)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`Order Details - ${selectedOrder?.orderNumber}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-semibold">{selectedOrder.status.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment</p>
                <p className="font-semibold">
                  {selectedOrder.isPaid ? 'PAID' : 'UNPAID'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="font-semibold">
                  {selectedOrder.orderType.replace('_', ' ').toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="font-semibold">{formatDateTime(selectedOrder.createdAt)}</p>
              </div>
              {selectedOrder.orderType === 'delivery' && (
                <div>
                  <p className="text-sm text-gray-600">Delivery Status</p>
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getDeliveryStatusInfo(selectedOrder.deliveryStatus).color}`}>
                    {getDeliveryStatusInfo(selectedOrder.deliveryStatus).label}
                  </span>
                </div>
              )}
              {selectedOrder.customerName && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-semibold">{selectedOrder.customerName}</p>
                  {selectedOrder.customerPhone && (
                    <p className="text-sm text-gray-500">{selectedOrder.customerPhone}</p>
                  )}
                </div>
              )}
              {selectedOrder.deliveryAddress && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Delivery Address</p>
                  <p className="font-semibold">{selectedOrder.deliveryAddress}</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
              <div className="space-y-2">
                {selectedOrderItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {item.quantity}x{' '}
                        {getItemDisplayName(item)}
                      </p>
                      {item.selectedVariants.length > 0 && (
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
                      <p className="text-sm text-gray-600">
                        {formatCurrency(item.unitPrice)} each
                      </p>
                      <p className="font-bold text-gray-900">
                        {formatCurrency(item.totalPrice)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">{formatCurrency(selectedOrder.subtotal)}</span>
              </div>

              {selectedOrder.discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>
                    Discount
                    {selectedOrder.discountReference &&
                      ` (${selectedOrder.discountReference})`}
                    :
                  </span>
                  <span className="font-semibold">
                    -{formatCurrency(selectedOrder.discountAmount)}
                  </span>
                </div>
              )}

              {selectedOrder.orderType === 'delivery' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery Charges:</span>
                  <span className="font-semibold">
                    {formatCurrency(selectedOrder.deliveryCharge)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                <span>Total:</span>
                <span className="text-primary-600">{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              {selectedOrder.status === 'open' && (
                <Button
                  variant="secondary"
                  onClick={() => handlePrintKOT(selectedOrder.id)}
                  leftIcon={<PrinterIcon className="w-5 h-5" />}
                >
                  Print KOT
                </Button>
              )}
              {selectedOrder.status === 'completed' && (
                <Button
                  variant="secondary"
                  onClick={() => handlePrintReceipt(selectedOrder.id)}
                  leftIcon={<PrinterIcon className="w-5 h-5" />}
                >
                  Print Receipt
                </Button>
              )}
              <Button onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Mark Order as Paid - ${selectedOrder?.orderNumber}`}
        size="md"
      >
        {selectedOrder && (
          <form onSubmit={paymentForm.handleSubmit(handleMarkAsPaid)} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Order Total:</span>
                <span className="text-2xl font-bold text-primary-600">
                  {formatCurrency(selectedOrder.total)}
                </span>
              </div>
            </div>

            <Select
              label="Payment Method"
              {...paymentForm.register('paymentMethod')}
              error={paymentForm.formState.errors.paymentMethod?.message}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </Select>

            <Input
              label="Amount Tendered"
              type="number"
              step="0.01"
              helperText="Used for change calculation only. Recorded payment is capped to remaining order balance."
              {...paymentForm.register('paymentAmount', { valueAsNumber: true })}
              error={paymentForm.formState.errors.paymentAmount?.message}
            />

            {/* Change Due Calculator */}
            {(() => {
              const paymentAmount = paymentForm.watch('paymentAmount');
              const orderTotal = selectedOrder.total;
              const change = (paymentAmount || 0) - orderTotal;

              if (paymentAmount && change > 0) {
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-green-700 font-medium">Change to Return:</span>
                      <span className="text-2xl font-bold text-green-600">
                        {formatCurrency(change)}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <Input
              label="Payment Reference (optional)"
              type="text"
              placeholder="Transaction ID, Check Number, etc."
              {...paymentForm.register('paymentReference')}
              error={paymentForm.formState.errors.paymentReference?.message}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsPaymentModalOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Processing...' : 'Mark as Paid'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Cancel Order Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={`Cancel Order - ${selectedOrder?.orderNumber}`}
        size="md"
      >
        {selectedOrder && (
          <form onSubmit={cancelForm.handleSubmit(handleCancelOrder)} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Order Total:</span>
                <span className="text-xl font-bold text-gray-900">
                  {formatCurrency(selectedOrder.total)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                {...cancelForm.register('cancellationReason')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Please provide a reason for cancelling this order (minimum 3 characters)"
              />
              {cancelForm.formState.errors.cancellationReason && (
                <p className="mt-1 text-sm text-red-600">
                  {cancelForm.formState.errors.cancellationReason.message}
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={isLoading}
              >
                Keep Order
              </Button>
              <Button type="submit" variant="danger" disabled={isLoading}>
                {isLoading ? 'Cancelling...' : 'Cancel Order'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delivery Status Modal */}
      <Modal
        isOpen={isDeliveryStatusModalOpen}
        onClose={() => setIsDeliveryStatusModalOpen(false)}
        title={`Update Delivery Status - ${selectedOrder?.orderNumber}`}
        size="md"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Customer:</span>
                <span className="font-semibold">{selectedOrder.customerName || 'N/A'}</span>
              </div>
              {selectedOrder.deliveryAddress && (
                <div className="flex justify-between items-start">
                  <span className="text-gray-600">Address:</span>
                  <span className="font-semibold text-right max-w-xs">{selectedOrder.deliveryAddress}</span>
                </div>
              )}
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-600">Current Status:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded ${getDeliveryStatusInfo(selectedOrder.deliveryStatus).color}`}>
                  {getDeliveryStatusInfo(selectedOrder.deliveryStatus).label}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select New Status
              </label>
              <div className="grid grid-cols-1 gap-2">
                {DELIVERY_STATUSES.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => handleUpdateDeliveryStatus(status.value)}
                    disabled={isLoading || selectedOrder.deliveryStatus === status.value}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      selectedOrder.deliveryStatus === status.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      {selectedOrder.deliveryStatus === status.value && (
                        <span className="text-primary-600 text-sm font-medium">Current</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="secondary"
                onClick={() => setIsDeliveryStatusModalOpen(false)}
                disabled={isLoading}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
