import React, { useEffect, useState } from 'react';
import { Button, Card, TimePicker } from '@/components/ui';
import { ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  getItemSales,
  getDealSales,
  getCategorySales,
  exportToCSV,
  exportToPDF,
  type DateRange,
  type ItemSales as ItemSalesType,
  type DealSales,
  type CategorySales,
} from '@/services/reportService';
import { useDialog } from '@/hooks/useDialog';
import { useDayRange } from '@/hooks/useDayRange';
import { formatCurrency } from '@/utils/validation';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

type TabType = 'items' | 'deals' | 'categories';
type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export const ItemSales: React.FC = () => {
  const dialog = useDialog();
  const { getTodayRange } = useDayRange();
  const [tab, setTab] = useState<TabType>('items');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [itemSales, setItemSales] = useState<ItemSalesType[]>([]);
  const [dealSales, setDealSales] = useState<DealSales[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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
      const [items, deals, categories] = await Promise.all([
        getItemSales(range),
        getDealSales(range),
        getCategorySales(range),
      ]);
      setItemSales(items);
      setDealSales(deals);
      setCategorySales(categories);
    } catch (error) {
      console.error('Failed to load report data:', error);
      await dialog.alert('Failed to load report data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const getExportPayload = () => {
    const base = `${tab}-sales-${datePreset}-${new Date().toISOString().split('T')[0]}`;

    switch (tab) {
      case 'items': {
        const data = getFilteredItems().map(item => ({
          'Item Name': item.itemName,
          'Category': item.categoryName || 'N/A',
          'Quantity Sold': item.totalQuantity,
          'Total Sales': formatCurrency(item.totalSales),
          'Orders': item.orderCount,
          'Average Price': formatCurrency(item.averagePrice),
        }));
        return { data, base, title: 'Menu Item Sales Report', orientation: 'landscape' as const };
      }
      case 'deals': {
        const data = getFilteredDeals().map(deal => ({
          'Deal Name': deal.dealName,
          'Quantity Sold': deal.totalQuantity,
          'Total Sales': formatCurrency(deal.totalSales),
          'Orders': deal.orderCount,
          'Average Price': formatCurrency(deal.averagePrice),
        }));
        return { data, base, title: 'Deal Sales Report', orientation: 'portrait' as const };
      }
      case 'categories': {
        const data = getFilteredCategories().map(category => ({
          'Category Name': category.categoryName,
          'Quantity Sold': category.totalQuantity,
          'Total Sales': formatCurrency(category.totalSales),
          'Orders': category.orderCount,
          'Average Price': formatCurrency(category.averagePrice),
        }));
        return { data, base, title: 'Category Sales Report', orientation: 'portrait' as const };
      }
    }
  };

  const handleExportCSV = () => {
    const payload = getExportPayload();
    if (!payload || payload.data.length === 0) return;
    exportToCSV(payload.data, `${payload.base}.csv`);
  };

  const handleExportPDF = () => {
    const payload = getExportPayload();
    if (!payload || payload.data.length === 0) return;
    exportToPDF(payload.data, `${payload.base}.pdf`, {
      title: payload.title,
      orientation: payload.orientation,
    });
  };

  const getFilteredItems = () => {
    if (!searchQuery) return itemSales;
    const query = searchQuery.toLowerCase();
    return itemSales.filter(item =>
      item.itemName.toLowerCase().includes(query) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(query))
    );
  };

  const getFilteredDeals = () => {
    if (!searchQuery) return dealSales;
    const query = searchQuery.toLowerCase();
    return dealSales.filter(deal => deal.dealName.toLowerCase().includes(query));
  };

  const getFilteredCategories = () => {
    if (!searchQuery) return categorySales;
    const query = searchQuery.toLowerCase();
    return categorySales.filter(category => category.categoryName.toLowerCase().includes(query));
  };

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'items', label: 'Menu Items', count: itemSales.length },
    { key: 'deals', label: 'Deals', count: dealSales.length },
    { key: 'categories', label: 'Categories', count: categorySales.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Item Sales Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">Track performance of menu items, deals, and categories</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPDF}
            leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
          >
            Export PDF
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

        {isLoading && <p className="text-sm text-gray-400 mt-3">Loading report data...</p>}
      </Card>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label} <span className="text-gray-400 ml-1">({t.count})</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder={`Search ${tab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Menu Items Tab */}
      {tab === 'items' && (
        <Card padding="md">
          {getFilteredItems().length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Item Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Qty Sold</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Avg Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getFilteredItems().map((item, index) => (
                    <tr key={item.itemId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-7 h-7 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mr-3">
                            <span className="font-semibold text-xs">{index + 1}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{item.itemName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.categoryName || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{item.totalQuantity}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(item.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{item.orderCount}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(item.averagePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">No menu items sold in this period.</div>
          )}
        </Card>
      )}

      {/* Deals Tab */}
      {tab === 'deals' && (
        <Card padding="md">
          {getFilteredDeals().length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Deal Name</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Qty Sold</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Avg Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getFilteredDeals().map((deal, index) => (
                    <tr key={deal.dealId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-7 h-7 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mr-3">
                            <span className="font-semibold text-xs">{index + 1}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{deal.dealName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{deal.totalQuantity}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(deal.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{deal.orderCount}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(deal.averagePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">No deals sold in this period.</div>
          )}
        </Card>
      )}

      {/* Categories Tab */}
      {tab === 'categories' && (
        <Card padding="md">
          {getFilteredCategories().length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Category Name</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Qty Sold</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Avg Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getFilteredCategories().map((category, index) => (
                    <tr key={category.categoryId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mr-3">
                            <span className="font-semibold text-xs">{index + 1}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{category.categoryName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{category.totalQuantity}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(category.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{category.orderCount}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(category.averagePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">No category sales in this period.</div>
          )}
        </Card>
      )}
    </div>
  );
};
