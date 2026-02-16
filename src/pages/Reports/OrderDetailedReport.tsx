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
import { useDayRange } from '@/hooks/useDayRange';
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
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20';
    case 'open':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
    case 'cancelled':
      return 'bg-gray-50 text-gray-600 ring-1 ring-gray-500/20';
    default:
      return 'bg-gray-50 text-gray-600 ring-1 ring-gray-500/20';
  }
};

export const OrderDetailedReport: React.FC = () => {
  const { getTodayRange } = useDayRange();
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

  const getDateRange = async (): Promise<DateRange> => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return await getTodayRange();
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
      const range = await getDateRange();
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Order Detailed Report</h1>
        <p className="text-sm text-gray-500 mt-1">Detailed order-level reporting with payment and item breakdown</p>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="space-y-4">
          {/* Date range pills */}
          <div className="flex flex-wrap items-center gap-2">
            {(['today', 'yesterday', 'this_week', 'this_month', 'custom'] as DateRangePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  datePreset === preset
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {preset.replace('_', ' ').charAt(0).toUpperCase() + preset.replace('_', ' ').slice(1)}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-gray-100">
              <Input
                label="Start Date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <TimePicker label="Start Time" value={customStartTime} onChange={setCustomStartTime} />
              <Input
                label="End Date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
              <TimePicker label="End Time" value={customEndTime} onChange={setCustomEndTime} />
            </div>
          )}

          {/* Filters row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
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

          {/* Search row */}
          <div className="flex items-end gap-2 pt-3 border-t border-gray-100">
            <div className="flex-1 max-w-sm">
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
            </div>
            <Button variant="secondary" size="sm" onClick={handleSearch} leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}>
              Search
            </Button>
            {appliedSearchQuery && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setAppliedSearchQuery(''); }}>
                Clear
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Tip: Keep Status as Completed to match Sales Summary and register sales totals.
          </p>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card padding="md" className="border-l-4 border-l-gray-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalOrders}</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-blue-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totalSales)}</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-emerald-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Amount</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totalPaidAmount)}</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unpaid Amount</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totalUnpaidAmount)}</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-emerald-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.paidOrders}</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-red-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unpaid Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.unpaidOrders}</p>
        </Card>
      </div>

      {/* Order Details Table */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Order Details</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={reportData.length === 0} leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}>
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportPDF} disabled={reportData.length === 0} leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}>
              Export PDF
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : reportData.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No orders found for selected filters</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Subtotal</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Discount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Delivery</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData.map((row) => (
                  <tr key={row.orderId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{row.orderNumber}</div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${row.isPaid ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-red-50 text-red-700 ring-1 ring-red-600/20'}`}>
                        {row.isPaid ? 'Paid' : 'Unpaid'} | {row.paymentMethods}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDateTime(row.orderDate)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{ORDER_TYPE_LABELS[row.orderType]}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(row.status)}`}>
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                      {row.cancellationReason && (
                        <div className="text-xs text-gray-400 mt-1 max-w-48 truncate">{row.cancellationReason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{row.customerName || 'Walk-in'}</div>
                      <div className="text-xs text-gray-400">{row.customerPhone || 'No phone'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-700">{row.itemCount} item(s)</div>
                      <div className="text-xs text-gray-400 max-w-64 truncate">{row.itemSummary}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(row.subtotal)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(row.discountAmount)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(row.deliveryCharge)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/80 font-semibold">
                  <td colSpan={9} className="px-4 py-3 text-sm text-gray-900">Total</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(summary.totalSales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
