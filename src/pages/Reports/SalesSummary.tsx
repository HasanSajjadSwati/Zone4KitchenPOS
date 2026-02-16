import React, { useEffect, useState } from 'react';
import { Button, Card, TimePicker } from '@/components/ui';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import {
  getSalesSummary,
  getDailySales,
  exportToCSV,
  exportToPDF,
  type DateRange,
  type SalesSummary as SalesSummaryType,
  type DailySales,
} from '@/services/reportService';
import { useDialog } from '@/hooks/useDialog';
import { useDayRange } from '@/hooks/useDayRange';
import { formatCurrency } from '@/utils/validation';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export const SalesSummary: React.FC = () => {
  const dialog = useDialog();
  const { getTodayRange } = useDayRange();
  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [summary, setSummary] = useState<SalesSummaryType | null>(null);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
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
    loadReportData();
  }, [datePreset, customStartDate, customStartTime, customEndDate, customEndTime]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const range = await getDateRange();
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

  const getSummaryExportData = () => {
    if (!summary) return [];
    return [
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
  };

  const getDailyExportData = () => {
    if (dailySales.length === 0) return [];
    return dailySales.map(day => ({
      Date: day.date,
      'Total Sales': day.totalSales,
      'Total Orders': day.totalOrders,
      'Average Order Value': day.averageOrderValue.toFixed(2),
    }));
  };

  const handleExportSummaryCSV = () => {
    const exportData = getSummaryExportData();
    if (exportData.length === 0) return;
    exportToCSV(exportData, `sales-summary-${datePreset}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportSummaryPDF = () => {
    const exportData = getSummaryExportData();
    if (exportData.length === 0) return;
    exportToPDF(
      exportData,
      `sales-summary-${datePreset}-${new Date().toISOString().split('T')[0]}.pdf`,
      { title: 'Sales Summary Report' }
    );
  };

  const handleExportDailyCSV = () => {
    const exportData = getDailyExportData();
    if (exportData.length === 0) return;
    exportToCSV(exportData, `daily-sales-${datePreset}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportDailyPDF = () => {
    const exportData = getDailyExportData();
    if (exportData.length === 0) return;
    exportToPDF(
      exportData,
      `daily-sales-${datePreset}-${new Date().toISOString().split('T')[0]}.pdf`,
      { title: 'Daily Sales Report' }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sales Summary</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of sales performance and revenue breakdown</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportSummaryCSV}
            disabled={!summary}
            leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
          >
            Summary CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportSummaryPDF}
            disabled={!summary}
            leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
          >
            Summary PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportDailyCSV}
            disabled={dailySales.length === 0}
            leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
          >
            Daily CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportDailyPDF}
            disabled={dailySales.length === 0}
            leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
          >
            Daily PDF
          </Button>
        </div>
      </div>

      {/* Date Range Selection */}
      <Card padding="md">
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <TimePicker
              label="Start Time"
              value={customStartTime}
              onChange={setCustomStartTime}
            />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <TimePicker
              label="End Time"
              value={customEndTime}
              onChange={setCustomEndTime}
            />
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-gray-400 mt-3">{summary ? 'Refreshing...' : 'Loading report data...'}</p>
        )}
      </Card>

      {summary && (
        <>
          {/* Overall Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="md" className="border-l-4 border-l-primary-500">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totalSales)}</p>
            </Card>
            <Card padding="md" className="border-l-4 border-l-blue-500">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalOrders}</p>
            </Card>
            <Card padding="md" className="border-l-4 border-l-emerald-500">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.averageOrderValue)}</p>
            </Card>
            <Card padding="md" className="border-l-4 border-l-violet-500">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Items Sold</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalItems}</p>
            </Card>
          </div>

          {/* Sales by Order Type */}
          <Card padding="md">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Sales by Order Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50/70 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Dine In</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(summary.dineInSales)}</p>
                <p className="text-sm text-gray-500 mt-1">{summary.dineInOrders} orders</p>
              </div>
              <div className="bg-emerald-50/70 rounded-xl p-4 border border-emerald-100">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Take Away</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(summary.takeAwaySales)}</p>
                <p className="text-sm text-gray-500 mt-1">{summary.takeAwayOrders} orders</p>
              </div>
              <div className="bg-violet-50/70 rounded-xl p-4 border border-violet-100">
                <p className="text-xs font-medium text-violet-600 uppercase tracking-wider">Delivery</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(summary.deliverySales)}</p>
                <p className="text-sm text-gray-500 mt-1">{summary.deliveryOrders} orders</p>
              </div>
            </div>
          </Card>

          {/* Payment Methods */}
          <Card padding="md">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Payment Methods</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cash</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(summary.cashSales)}</p>
              </div>
              <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Card</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(summary.cardSales)}</p>
              </div>
              <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Online Transfer</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(summary.onlineSales)}</p>
              </div>
              <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Other</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(summary.otherSales)}</p>
              </div>
            </div>
          </Card>

          {/* Payment Status */}
          <Card padding="md">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Payment Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-50/70 rounded-xl p-4 border border-emerald-100">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Paid Orders</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(summary.paidAmount)}</p>
                <p className="text-sm text-gray-500 mt-1">{summary.paidOrders} orders</p>
              </div>
              <div className="bg-red-50/70 rounded-xl p-4 border border-red-100">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wider">Unpaid Orders</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(summary.unpaidAmount)}</p>
                <p className="text-sm text-gray-500 mt-1">{summary.unpaidOrders} orders</p>
              </div>
            </div>
          </Card>

          {/* Daily Sales Breakdown */}
          <Card padding="md">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Daily Sales Breakdown</h2>
            {dailySales.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50/80">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Orders</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total Sales</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Avg Order Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailySales.map((day) => {
                      const [year, month, dayNum] = day.date.split('-').map(Number);
                      const dateObj = new Date(year, month - 1, dayNum);
                      return (
                        <tr key={day.date} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {dateObj.toLocaleDateString('en-PK', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{day.totalOrders}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(day.totalSales)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {formatCurrency(day.averageOrderValue)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50/80 font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {dailySales.reduce((sum, day) => sum + day.totalOrders, 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
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
              <div className="text-center py-12 text-gray-400">
                {isLoading ? 'Loading daily sales data...' : 'No daily sales data for the selected period.'}
              </div>
            )}
          </Card>

          {/* Discounts */}
          {summary.totalDiscounts > 0 && (
            <Card padding="md">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Discounts Applied</h2>
              <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-100">
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Total Discounts Given</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totalDiscounts)}</p>
              </div>
            </Card>
          )}
        </>
      )}

      {!summary && !isLoading && (
        <Card padding="lg">
          <div className="text-center py-12">
            <p className="text-gray-400">No sales data found for the selected date range.</p>
          </div>
        </Card>
      )}
    </div>
  );
};
