import React, { useState, useEffect } from 'react';
import { Card, Button, TimePicker } from '@/components/ui';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { getDiscountedOrders, exportToCSV, exportToPDF, type DiscountReportItem, type DateRange } from '@/services/reportService';
import { formatCurrency, formatDate } from '@/utils/validation';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';
type DiscountTypeFilter = 'all' | 'percentage' | 'fixed';

export const DiscountReport: React.FC = () => {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [reportData, setReportData] = useState<DiscountReportItem[]>([]);
  const [filteredData, setFilteredData] = useState<DiscountReportItem[]>([]);
  const [discountTypeFilter, setDiscountTypeFilter] = useState<DiscountTypeFilter>('all');
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

  useEffect(() => {
    filterData();
  }, [reportData, discountTypeFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const range = getDateRange();
      const data = await getDiscountedOrders(range);
      setReportData(data);
    } catch (error) {
      console.error('Error loading discount report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterData = () => {
    let filtered = reportData;

    if (discountTypeFilter !== 'all') {
      filtered = filtered.filter(item => item.discountType === discountTypeFilter);
    }

    setFilteredData(filtered);
  };

  const getExportData = () =>
    filteredData.map(item => ({
      'Order #': item.orderNumber,
      'Date': formatDate(new Date(item.orderDate)),
      'Discount Type': item.discountType === 'percentage' ? 'Percentage' : 'Fixed',
      'Discount Value': item.discountType === 'percentage' ? `${item.discountValue}%` : formatCurrency(item.discountValue),
      'Discount Amount': item.discountAmount,
      'Reference': item.discountReference || 'N/A',
      'Subtotal': item.subtotal,
      'Order Total': item.orderTotal,
    }));

  const handleExportCSV = () => {
    const exportData = getExportData();
    exportToCSV(
      exportData,
      `discount-report-${datePreset}-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleExportPDF = () => {
    const exportData = getExportData();
    exportToPDF(
      exportData,
      `discount-report-${datePreset}-${new Date().toISOString().split('T')[0]}.pdf`,
      { title: 'Discount Report', orientation: 'landscape' }
    );
  };

  const totalDiscountAmount = filteredData.reduce((sum, item) => sum + item.discountAmount, 0);
  const totalDiscountedOrders = filteredData.length;
  const averageDiscount = totalDiscountedOrders > 0 ? totalDiscountAmount / totalDiscountedOrders : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Discount Report</h1>
        <p className="text-sm text-gray-500 mt-1">Track discounted orders and discount performance</p>
      </div>

      {/* Date Range & Filter */}
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

          {/* Discount type filter */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs font-medium text-gray-500">Type:</span>
            {(['all', 'percentage', 'fixed'] as DiscountTypeFilter[]).map((type) => (
              <button
                key={type}
                onClick={() => setDiscountTypeFilter(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  discountTypeFilter === type
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'all' ? 'All' : type === 'percentage' ? 'Percentage' : 'Fixed'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md" className="border-l-4 border-l-amber-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Discount Amount</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalDiscountAmount)}</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-blue-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Discounted Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalDiscountedOrders}</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-violet-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Average Discount</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(averageDiscount)}</p>
        </Card>
      </div>

      {/* Discount Details Table */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Discount Details</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={filteredData.length === 0} leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}>
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportPDF} disabled={filteredData.length === 0} leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}>
              Export PDF
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No discounted orders found for this period</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Discount Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Reference</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Subtotal</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((item) => (
                  <tr key={item.orderId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.orderNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(new Date(item.orderDate))}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.discountType === 'percentage'
                          ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/20'
                          : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
                      }`}>
                        {item.discountType === 'percentage' ? 'Percentage' : 'Fixed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                      {item.discountType === 'percentage'
                        ? `${item.discountValue}%`
                        : formatCurrency(item.discountValue)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-amber-600">
                      {formatCurrency(item.discountAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.discountReference || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500">
                      {formatCurrency(item.subtotal)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                      {formatCurrency(item.orderTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/80 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-sm text-gray-900">Total</td>
                  <td className="px-4 py-3 text-sm text-right text-amber-600">
                    {formatCurrency(totalDiscountAmount)}
                  </td>
                  <td colSpan={3} className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
