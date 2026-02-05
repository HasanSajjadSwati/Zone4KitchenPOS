import React, { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import {
  getSalesSummary,
  getDailySales,
  exportToCSV,
  type DateRange,
  type SalesSummary as SalesSummaryType,
  type DailySales,
} from '@/services/reportService';
import { useDialog } from '@/hooks/useDialog';
import { formatCurrency } from '@/utils/validation';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export const SalesSummary: React.FC = () => {
  const dialog = useDialog();
  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [summary, setSummary] = useState<SalesSummaryType | null>(null);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
          startDate: customStartDate ? startOfDay(new Date(customStartDate)) : startOfDay(now),
          endDate: customEndDate ? endOfDay(new Date(customEndDate)) : endOfDay(now),
        };
      default:
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
    }
  };

  useEffect(() => {
    loadReportData();
  }, [datePreset, customStartDate, customEndDate]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const range = getDateRange();
      // Use allSettled so one failure doesn't block the other
      const [summaryResult, dailyResult] = await Promise.allSettled([
        getSalesSummary(range),
        getDailySales(range),
      ]);

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
      } else {
        console.error('Failed to load summary:', summaryResult.reason);
        setSummary(null);
      }

      if (dailyResult.status === 'fulfilled') {
        setDailySales(dailyResult.value);
      } else {
        console.error('Failed to load daily sales:', dailyResult.reason);
        setDailySales([]);
      }

      if (summaryResult.status === 'rejected' && dailyResult.status === 'rejected') {
        await dialog.alert('Failed to load report data', 'Error');
      }
    } catch (error) {
      console.error('Failed to load report data:', error);
      await dialog.alert('Failed to load report data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportSummary = () => {
    if (!summary) return;

    const exportData = [
      {
        Metric: 'Total Sales',
        Value: formatCurrency(summary.totalSales),
      },
      {
        Metric: 'Total Orders',
        Value: summary.totalOrders,
      },
      {
        Metric: 'Average Order Value',
        Value: formatCurrency(summary.averageOrderValue),
      },
      {
        Metric: 'Total Items Sold',
        Value: summary.totalItems,
      },
      {
        Metric: 'Total Discounts',
        Value: formatCurrency(summary.totalDiscounts),
      },
      {
        Metric: 'Dine-In Sales',
        Value: formatCurrency(summary.dineInSales),
      },
      {
        Metric: 'Take Away Sales',
        Value: formatCurrency(summary.takeAwaySales),
      },
      {
        Metric: 'Delivery Sales',
        Value: formatCurrency(summary.deliverySales),
      },
      {
        Metric: 'Cash Payments',
        Value: formatCurrency(summary.cashSales),
      },
      {
        Metric: 'Card Payments',
        Value: formatCurrency(summary.cardSales),
      },
      {
        Metric: 'Online Payments',
        Value: formatCurrency(summary.onlineSales),
      },
      {
        Metric: 'Other Payments',
        Value: formatCurrency(summary.otherSales),
      },
    ];

    exportToCSV(exportData, `sales-summary-${datePreset}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportDaily = () => {
    if (dailySales.length === 0) return;

    const exportData = dailySales.map(day => ({
      Date: day.date,
      'Total Sales': day.totalSales,
      'Total Orders': day.totalOrders,
      'Average Order Value': day.averageOrderValue.toFixed(2),
    }));

    exportToCSV(exportData, `daily-sales-${datePreset}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Sales Summary Report</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            onClick={handleExportSummary}
            disabled={!summary}
            leftIcon={<ArrowDownTrayIcon className="w-5 h-5" />}
          >
            Export Summary
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportDaily}
            disabled={dailySales.length === 0}
            leftIcon={<ArrowDownTrayIcon className="w-5 h-5" />}
          >
            Export Daily
          </Button>
        </div>
      </div>

      {/* Date Range Selection */}
      <Card padding="md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {(['today', 'yesterday', 'this_week', 'this_month', 'custom'] as DateRangePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setDatePreset(preset)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                datePreset === preset
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {preset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-gray-500">{summary ? 'Refreshing report data...' : 'Loading report data...'}</p>
        )}
      </Card>

      {summary && (
        <>
          {/* Overall Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="md">
              <p className="text-sm text-gray-600 mb-1">Total Sales</p>
              <p className="text-2xl font-bold text-primary-600">{formatCurrency(summary.totalSales)}</p>
            </Card>
            <Card padding="md">
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalOrders}</p>
            </Card>
            <Card padding="md">
              <p className="text-sm text-gray-600 mb-1">Average Order Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.averageOrderValue)}</p>
            </Card>
            <Card padding="md">
              <p className="text-sm text-gray-600 mb-1">Total Items Sold</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalItems}</p>
            </Card>
          </div>

          {/* Daily Sales Breakdown - shown prominently after summary */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Sales Breakdown</h2>
            {dailySales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orders
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Sales
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Order Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dailySales.map((day) => {
                      const [year, month, dayNum] = day.date.split('-').map(Number);
                      const dateObj = new Date(year, month - 1, dayNum);
                      return (
                        <tr key={day.date} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {dateObj.toLocaleDateString('en-PK', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {day.totalOrders}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-primary-600">
                            {formatCurrency(day.totalSales)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(day.averageOrderValue)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr className="font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {dailySales.reduce((sum, day) => sum + day.totalOrders, 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-primary-600">
                        {formatCurrency(dailySales.reduce((sum, day) => sum + day.totalSales, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {formatCurrency(summary.averageOrderValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">
                {isLoading ? 'Loading daily sales data...' : 'No daily sales data for the selected period.'}
              </p>
            )}
          </Card>

          {/* Sales by Order Type */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales by Order Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Dine In</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(summary.dineInSales)}</p>
                <p className="text-sm text-gray-600 mt-1">{summary.dineInOrders} orders</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Take Away</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(summary.takeAwaySales)}</p>
                <p className="text-sm text-gray-600 mt-1">{summary.takeAwayOrders} orders</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Delivery</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(summary.deliverySales)}</p>
                <p className="text-sm text-gray-600 mt-1">{summary.deliveryOrders} orders</p>
              </div>
            </div>
          </Card>

          {/* Payment Methods */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Cash</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.cashSales)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Card</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.cardSales)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Online Transfer</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.onlineSales)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Other</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.otherSales)}</p>
              </div>
            </div>
          </Card>

          {/* Payment Status */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Paid Orders</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(summary.paidAmount)}</p>
                <p className="text-sm text-gray-600 mt-1">{summary.paidOrders} orders</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Unpaid Orders</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(summary.unpaidAmount)}</p>
                <p className="text-sm text-gray-600 mt-1">{summary.unpaidOrders} orders</p>
              </div>
            </div>
          </Card>

          {/* Discounts */}
          {summary.totalDiscounts > 0 && (
            <Card padding="md">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Discounts Applied</h2>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Total Discounts Given</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalDiscounts)}</p>
              </div>
            </Card>
          )}
        </>
      )}

      {!summary && !isLoading && (
        <Card padding="lg">
          <div className="text-center text-gray-500 py-12">
            <p>No sales data found for the selected date range.</p>
          </div>
        </Card>
      )}
    </div>
  );
};
