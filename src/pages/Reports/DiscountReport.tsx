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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Discount Report</h1>
          <p className="text-gray-600">Track discounted orders and discount performance</p>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
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

            {datePreset === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <TimePicker
                    label="Start Time"
                    value={customStartTime}
                    onChange={setCustomStartTime}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <TimePicker
                    label="End Time"
                    value={customEndTime}
                    onChange={setCustomEndTime}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Total Discount Amount</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalDiscountAmount)}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Discounted Orders</div>
            <div className="text-2xl font-bold">{totalDiscountedOrders}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Average Discount</div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(averageDiscount)}</div>
          </div>
        </Card>
      </div>

      {/* Discount Type Filter */}
      <Card>
        <div className="p-4">
          <label className="block text-sm font-medium mb-2">Filter by Discount Type</label>
          <select
            value={discountTypeFilter}
            onChange={(e) => setDiscountTypeFilter(e.target.value as DiscountTypeFilter)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Discounts</option>
            <option value="percentage">Percentage Discounts</option>
            <option value="fixed">Fixed Discounts</option>
          </select>
        </div>
      </Card>

      {/* Discount Details Table */}
      <Card>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Discount Details</h2>
            <div className="flex items-center space-x-2">
              <Button onClick={handleExportCSV} disabled={filteredData.length === 0}>
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={handleExportPDF} disabled={filteredData.length === 0}>
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No discounted orders found for this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((item) => (
                    <tr key={item.orderId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.orderNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(new Date(item.orderDate))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.discountType === 'percentage'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {item.discountType === 'percentage' ? 'Percentage' : 'Fixed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {item.discountType === 'percentage'
                          ? `${item.discountValue}%`
                          : formatCurrency(item.discountValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-orange-600">
                        {formatCurrency(item.discountAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {item.discountReference || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold">
                        {formatCurrency(item.orderTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-sm">TOTAL</td>
                    <td className="px-6 py-4 text-sm text-right text-orange-600">
                      {formatCurrency(totalDiscountAmount)}
                    </td>
                    <td colSpan={3} className="px-6 py-4"></td>
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
