import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button, Card, Input, Select, TimePicker } from '@/components/ui';
import {
  exportToCSV,
  exportToPDF,
  getOrderDetailedReport,
  type DateRange,
  type OrderDetailedReportItem,
} from '@/services/reportService';
import { formatCurrency, formatDateTime } from '@/utils/validation';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';
type StatusFilter = 'all' | 'open' | 'completed' | 'cancelled';
type TypeFilter = 'all' | 'dine_in' | 'take_away' | 'delivery';
type PaymentFilter = 'all' | 'paid' | 'unpaid';

const ORDER_TYPE_LABELS: Record<'dine_in' | 'take_away' | 'delivery', string> = {
  dine_in: 'Dine In',
  take_away: 'Take Away',
  delivery: 'Delivery',
};

const statusBadgeClass = (status: StatusFilter | OrderDetailedReportItem['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'open':
      return 'bg-yellow-100 text-yellow-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const OrderDetailedReport: React.FC = () => {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('completed');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [reportData, setReportData] = useState<OrderDetailedReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const combineDateTime = (
    dateValue: string,
    timeValue: string,
    fallback: Date,
    boundary: 'start' | 'end'
  ): Date => {
    if (!dateValue) return fallback;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return fallback;

    const [hoursRaw, minutesRaw] = (timeValue || '00:00').split(':');
    const hours = Number.parseInt(hoursRaw || '0', 10);
    const minutes = Number.parseInt(minutesRaw || '0', 10);
    date.setHours(
      Number.isFinite(hours) ? hours : 0,
      Number.isFinite(minutes) ? minutes : 0,
      boundary === 'start' ? 0 : 59,
      boundary === 'start' ? 0 : 999
    );
    return date;
  };

  const getDateRange = (): DateRange => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case 'yesterday': {
        const yesterday = subDays(now, 1);
        return { startDate: startOfDay(yesterday), endDate: endOfDay(yesterday) };
      }
      case 'this_week':
        return { startDate: startOfWeek(now, { weekStartsOn: 1 }), endDate: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'this_month':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case 'custom':
        return {
          startDate: combineDateTime(customStartDate, customStartTime, startOfDay(now), 'start'),
          endDate: combineDateTime(customEndDate, customEndTime, endOfDay(now), 'end'),
        };
      default:
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const range = getDateRange();
      const rows = await getOrderDetailedReport(range, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        orderType: typeFilter === 'all' ? undefined : typeFilter,
        paymentStatus: paymentFilter === 'all' ? undefined : paymentFilter,
        query: appliedSearchQuery || undefined,
      });
      setReportData(rows);
    } catch (error) {
      console.error('Error loading order detailed report:', error);
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [datePreset, customStartDate, customStartTime, customEndDate, customEndTime, statusFilter, typeFilter, paymentFilter, appliedSearchQuery]);

  const handleSearch = () => {
    setAppliedSearchQuery(searchQuery.trim());
  };

  const summary = useMemo(() => {
    const totalOrders = reportData.length;
    const totalSales = reportData.reduce((sum, row) => sum + row.total, 0);
    const totalPaidAmount = reportData.reduce((sum, row) => sum + row.paidAmount, 0);
    const totalUnpaidAmount = reportData.reduce(
      (sum, row) => sum + Math.max(0, row.total - row.paidAmount),
      0
    );
    const paidOrders = reportData.filter((row) => row.isPaid).length;
    const unpaidOrders = totalOrders - paidOrders;

    return {
      totalOrders,
      totalSales,
      totalPaidAmount,
      totalUnpaidAmount,
      paidOrders,
      unpaidOrders,
    };
  }, [reportData]);

  const getExportRows = () =>
    reportData.map((row) => ({
      'Order #': row.orderNumber,
      Date: formatDateTime(row.orderDate),
      Type: ORDER_TYPE_LABELS[row.orderType],
      Status: row.status,
      'Payment Status': row.isPaid ? 'Paid' : 'Unpaid',
      'Payment Methods': row.paymentMethods,
      Customer: row.customerName || 'Walk-in',
      Phone: row.customerPhone || 'N/A',
      Items: row.itemCount,
      'Item Summary': row.itemSummary,
      Subtotal: row.subtotal,
      Discount: row.discountAmount,
      Delivery: row.deliveryCharge,
      Total: row.total,
      'Paid Amount': row.paidAmount,
      Notes: row.notes || '',
      'Cancellation Reason': row.cancellationReason || '',
    }));

  const handleExportCSV = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;
    exportToCSV(
      rows,
      `order-detailed-report-${datePreset}-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleExportPDF = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;
    exportToPDF(
      rows,
      `order-detailed-report-${datePreset}-${new Date().toISOString().split('T')[0]}.pdf`,
      { title: 'Order Detailed Report', orientation: 'landscape' }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Order Detailed Report</h1>
        <p className="text-gray-600">Detailed order-level reporting with payment and item breakdown</p>
      </div>

      <Card>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium mb-2">Date Range</label>
              <div className="flex flex-wrap gap-2">
                {(['today', 'yesterday', 'this_week', 'this_month', 'custom'] as DateRangePreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setDatePreset(preset)}
                    className={`px-3 py-1 rounded text-sm ${
                      datePreset === preset
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {preset.replace('_', ' ').charAt(0).toUpperCase() + preset.replace('_', ' ').slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>

            <Select
              label="Order Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">All</option>
              <option value="dine_in">Dine In</option>
              <option value="take_away">Take Away</option>
              <option value="delivery">Delivery</option>
            </Select>

            <Select
              label="Payment"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </Select>
          </div>

          {datePreset === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Input
                label="Start Date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <TimePicker
                label="Start Time"
                value={customStartTime}
                onChange={setCustomStartTime}
              />
              <Input
                label="End Date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
              <TimePicker
                label="End Time"
                value={customEndTime}
                onChange={setCustomEndTime}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <Input
              label="Search"
              placeholder="Order #, customer, phone, items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <div className="md:col-span-2 flex items-end gap-2">
              <Button variant="secondary" onClick={handleSearch} leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}>
                Apply Search
              </Button>
              <Button variant="secondary" onClick={() => { setSearchQuery(''); setAppliedSearchQuery(''); }}>
                Clear Search
              </Button>
              <Button variant="secondary" onClick={loadData}>
                Refresh
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Tip: Keep Status as Completed to match Sales Summary and register sales totals.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><div className="p-4"><div className="text-sm text-gray-600">Orders</div><div className="text-2xl font-bold">{summary.totalOrders}</div></div></Card>
        <Card><div className="p-4"><div className="text-sm text-gray-600">Total Sales</div><div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalSales)}</div></div></Card>
        <Card><div className="p-4"><div className="text-sm text-gray-600">Paid Amount</div><div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaidAmount)}</div></div></Card>
        <Card><div className="p-4"><div className="text-sm text-gray-600">Unpaid Amount</div><div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalUnpaidAmount)}</div></div></Card>
        <Card><div className="p-4"><div className="text-sm text-gray-600">Paid Orders</div><div className="text-2xl font-bold">{summary.paidOrders}</div></div></Card>
        <Card><div className="p-4"><div className="text-sm text-gray-600">Unpaid Orders</div><div className="text-2xl font-bold">{summary.unpaidOrders}</div></div></Card>
      </div>

      <Card>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Order Details</h2>
            <div className="flex items-center gap-2">
              <Button onClick={handleExportCSV} disabled={reportData.length === 0} leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}>
                Export CSV
              </Button>
              <Button onClick={handleExportPDF} disabled={reportData.length === 0} leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}>
                Export PDF
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No orders found for selected filters</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Delivery</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((row) => (
                    <tr key={row.orderId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{row.orderNumber}</div>
                        <div className={`inline-flex px-2 py-0.5 rounded text-xs mt-1 ${row.isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {row.isPaid ? 'Paid' : 'Unpaid'} | {row.paymentMethods}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(row.orderDate)}</td>
                      <td className="px-4 py-3 text-sm">{ORDER_TYPE_LABELS[row.orderType]}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(row.status)}`}>
                          {row.status.toUpperCase()}
                        </span>
                        {row.cancellationReason && (
                          <div className="text-xs text-gray-500 mt-1 max-w-48 truncate">
                            {row.cancellationReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{row.customerName || 'Walk-in'}</div>
                        <div className="text-xs text-gray-500">{row.customerPhone || 'No phone'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{row.itemCount} item(s)</div>
                        <div className="text-xs text-gray-500 max-w-64 truncate">{row.itemSummary}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.subtotal)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(row.discountAmount)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.deliveryCharge)}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td colSpan={9} className="px-4 py-3 text-sm">TOTAL</td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600">{formatCurrency(summary.totalSales)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
