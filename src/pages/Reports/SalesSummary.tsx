import React, { useEffect, useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { ArrowDownTrayIcon, ChartBarIcon } from '@heroicons/react/24/outline';
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

export const SalesSummary: React.FC = () => {
  const dialog = useDialog();
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999)),
  });
  const [summary, setSummary] = useState<SalesSummaryType | null>(null);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const summaryData = await getSalesSummary(dateRange);
      setSummary(summaryData);

      const dailyData = await getDailySales(dateRange);
      setDailySales(dailyData);
    } catch (error) {
      console.error('Failed to load report data:', error);
      await dialog.alert('Failed to load report data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const date = new Date(value);
    if (type === 'start') {
      date.setHours(0, 0, 0, 0);
      setDateRange({ ...dateRange, startDate: date });
    } else {
      date.setHours(23, 59, 59, 999);
      setDateRange({ ...dateRange, endDate: date });
    }
  };

  const setToday = () => {
    const today = new Date();
    setDateRange({
      startDate: new Date(today.setHours(0, 0, 0, 0)),
      endDate: new Date(today.setHours(23, 59, 59, 999)),
    });
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setDateRange({
      startDate: new Date(yesterday.setHours(0, 0, 0, 0)),
      endDate: new Date(yesterday.setHours(23, 59, 59, 999)),
    });
  };

  const setThisWeek = () => {
    const today = new Date();
    const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
    const lastDay = new Date();
    setDateRange({
      startDate: new Date(firstDay.setHours(0, 0, 0, 0)),
      endDate: new Date(lastDay.setHours(23, 59, 59, 999)),
    });
  };

  const setThisMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setDateRange({
      startDate: new Date(firstDay.setHours(0, 0, 0, 0)),
      endDate: new Date(lastDay.setHours(23, 59, 59, 999)),
    });
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

    exportToCSV(exportData, `sales-summary-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}.csv`);
  };

  const handleExportDaily = () => {
    if (dailySales.length === 0) return;

    const exportData = dailySales.map(day => ({
      Date: day.date,
      'Total Sales': day.totalSales,
      'Total Orders': day.totalOrders,
      'Average Order Value': day.averageOrderValue.toFixed(2),
    }));

    exportToCSV(exportData, `daily-sales-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}.csv`);
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Input
            label="Start Date"
            type="date"
            value={formatDate(dateRange.startDate)}
            onChange={(e) => handleDateChange('start', e.target.value)}
          />
          <Input
            label="End Date"
            type="date"
            value={formatDate(dateRange.endDate)}
            onChange={(e) => handleDateChange('end', e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" variant="secondary" onClick={setToday}>
            Today
          </Button>
          <Button size="sm" variant="secondary" onClick={setYesterday}>
            Yesterday
          </Button>
          <Button size="sm" variant="secondary" onClick={setThisWeek}>
            This Week
          </Button>
          <Button size="sm" variant="secondary" onClick={setThisMonth}>
            This Month
          </Button>
        </div>

        <Button
          onClick={loadReportData}
          isLoading={isLoading}
          leftIcon={<ChartBarIcon className="w-5 h-5" />}
        >
          Generate Report
        </Button>
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

          {/* Daily Sales Breakdown */}
          {dailySales.length > 0 && (
            <Card padding="md">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Sales Breakdown</h2>
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
                    {dailySales.map((day) => (
                      <tr key={day.date} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(day.date).toLocaleDateString('en-PK', {
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
                    ))}
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
            </Card>
          )}
        </>
      )}

      {!summary && !isLoading && (
        <Card padding="lg">
          <div className="text-center text-gray-500 py-12">
            <ChartBarIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>Select a date range and click "Generate Report" to view sales summary.</p>
          </div>
        </Card>
      )}
    </div>
  );
};
