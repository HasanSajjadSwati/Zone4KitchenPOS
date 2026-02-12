import React, { useState, useEffect } from 'react';
import { Card, Button, TimePicker } from '@/components/ui';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { getCancelledOrders, exportToCSV, exportToPDF, type CancelledOrder, type DateRange } from '@/services/reportService';
import { formatCurrency, formatDateTime } from '@/utils/validation';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export const CancelledOrdersReport: React.FC = () => {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [cancelledOrders, setCancelledOrders] = useState<CancelledOrder[]>([]);
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
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { startDate: startOfDay(yesterday), endDate: endOfDay(yesterday) };
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

  useEffect(() => {
    loadData();
  }, [datePreset, customStartDate, customStartTime, customEndDate, customEndTime]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const range = getDateRange();
      const orders = await getCancelledOrders(range);
      setCancelledOrders(orders);
    } catch (error) {
      console.error('Error loading cancelled orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getExportData = () =>
    cancelledOrders.map(order => ({
      'Order #': order.orderNumber,
      'Date': formatDateTime(order.orderDate),
      'Type': order.orderType.replace('_', ' ').toUpperCase(),
      'Reason': order.cancellationReason || 'No reason provided',
      'Cancelled By': order.cancelledByName,
      'Amount': order.total,
    }));

  const handleExportCSV = () => {
    const exportData = getExportData();
    exportToCSV(
      exportData,
      `cancelled-orders-${datePreset}-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleExportPDF = () => {
    const exportData = getExportData();
    exportToPDF(
      exportData,
      `cancelled-orders-${datePreset}-${new Date().toISOString().split('T')[0]}.pdf`,
      { title: 'Cancelled Orders Report', orientation: 'landscape' }
    );
  };

  const totalAmount = cancelledOrders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Cancelled Orders</h1>
        <p className="text-sm text-gray-500 mt-1">View and analyze cancelled orders</p>
      </div>

      {/* Date Range Selector */}
      <Card padding="md">
        <div className="space-y-4">
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
                {preset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <TimePicker label="Start Time" value={customStartTime} onChange={setCustomStartTime} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <TimePicker label="End Time" value={customEndTime} onChange={setCustomEndTime} />
            </div>
          )}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md" className="border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cancelled Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{cancelledOrders.length}</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-amber-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalAmount)}</p>
        </Card>
      </div>

      {/* Cancelled Orders Table */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Cancelled Orders</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={cancelledOrders.length === 0} leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}>
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportPDF} disabled={cancelledOrders.length === 0} leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}>
              Export PDF
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : cancelledOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No cancelled orders found</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Cancelled By</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cancelledOrders.map((order) => (
                  <tr key={order.orderId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(order.orderDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 ring-1 ring-gray-500/20">
                        {order.orderType.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {order.cancellationReason || 'No reason provided'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {order.cancelledByName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      {formatCurrency(order.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
