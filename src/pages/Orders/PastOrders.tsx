import React, { useEffect, useState, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  PrinterIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import { Button, Card, Modal, Select, Input } from '@/components/ui';
import { getPastOrdersPaginated, getPastOrderItems } from '@/services/pastOrderService';
import { printCustomerReceipt } from '@/services/printService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { formatCurrency, formatDateTime } from '@/utils/validation';
import type { Order, OrderItem, MenuItem, Deal } from '@/db/types';
import { db } from '@/db';

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

export const PastOrders: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [menuItemNameById, setMenuItemNameById] = useState<Record<string, string>>({});
  const [dealNameById, setDealNameById] = useState<Record<string, string>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadOrders();
  }, [filterStatus, filterType, filterPayment, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterType, filterPayment, searchText, startDate, endDate]);

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
        console.warn('Failed to load item names:', error);
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
    const result = await getPastOrdersPaginated({
      status: filterStatus !== 'all' ? filterStatus as any : undefined,
      orderType: filterType !== 'all' ? filterType : undefined,
      isPaid: filterPayment === 'paid' ? true : filterPayment === 'unpaid' ? false : undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : undefined,
      search: searchText || undefined,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    });

    setOrders(result.orders);
    setTotalOrders(result.total);
  }, [filterStatus, filterType, filterPayment, searchText, startDate, endDate, currentPage, pageSize]);

  const handleViewDetails = async (order: Order) => {
    setSelectedOrder(order);
    const items = await getPastOrderItems(order.id);
    setSelectedOrderItems(items);
    setIsDetailsModalOpen(true);
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

  const handleSearch = () => {
    setCurrentPage(1);
    loadOrders();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ArchiveBoxIcon className="w-8 h-8 text-gray-600" />
          <h1 className="text-3xl font-bold text-gray-900">Past Orders</h1>
        </div>
        <div className="text-sm text-gray-500">
          {totalOrders} archived orders
        </div>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <Input
            label="Search"
            placeholder="Order #, name, phone..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />

          <Input
            label="From Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            label="To Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <Select
            label="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Status</option>
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
              onClick={handleSearch}
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            >
              Search
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
              <ArchiveBoxIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No past orders found matching your filters</p>
              <p className="text-sm mt-2">Orders are migrated here from Settings &gt; Data Management</p>
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
        title={`Past Order Details - ${selectedOrder?.orderNumber}`}
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
              {selectedOrder.completedAt && (
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="font-semibold">{formatDateTime(selectedOrder.completedAt)}</p>
                </div>
              )}
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
              {selectedOrder.cancellationReason && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Cancellation Reason</p>
                  <p className="font-semibold text-red-600">{selectedOrder.cancellationReason}</p>
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
    </div>
  );
};
