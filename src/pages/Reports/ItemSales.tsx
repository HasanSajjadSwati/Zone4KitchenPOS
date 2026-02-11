import React, { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
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
import { formatCurrency } from '@/utils/validation';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

type TabType = 'items' | 'deals' | 'categories';
type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export const ItemSales: React.FC = () => {
  const dialog = useDialog();
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
    loadReportData();
  }, [datePreset, customStartDate, customStartTime, customEndDate, customEndTime]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const range = getDateRange();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Item Sales Analysis</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            onClick={handleExportCSV}
            leftIcon={<ArrowDownTrayIcon className="w-5 h-5" />}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportPDF}
            leftIcon={<ArrowDownTrayIcon className="w-5 h-5" />}
          >
            Export PDF
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
              <label className="block text-sm font-medium mb-2">Start Time</label>
              <input
                type="time"
                value={customStartTime}
                onChange={(e) => setCustomStartTime(e.target.value)}
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
            <div>
              <label className="block text-sm font-medium mb-2">End Time</label>
              <input
                type="time"
                value={customEndTime}
                onChange={(e) => setCustomEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-gray-500">Loading report data...</p>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'items'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setTab('items')}
        >
          Menu Items ({itemSales.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'deals'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setTab('deals')}
        >
          Deals ({dealSales.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'categories'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setTab('categories')}
        >
          Categories ({categorySales.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder={`Search ${tab}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Menu Items Tab */}
      {tab === 'items' && (
        <Card padding="md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Menu Item Sales</h2>
          {getFilteredItems().length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty Sold
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Sales
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orders
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Price
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredItems().map((item, index) => (
                    <tr key={item.itemId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-primary-600 font-semibold text-sm">
                              {index + 1}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">{item.itemName}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.categoryName || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {item.totalQuantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-primary-600">
                        {formatCurrency(item.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {item.orderCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {formatCurrency(item.averagePrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <p>No menu items sold in this period.</p>
            </div>
          )}
        </Card>
      )}

      {/* Deals Tab */}
      {tab === 'deals' && (
        <Card padding="md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Deal Sales</h2>
          {getFilteredDeals().length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deal Name
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty Sold
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Sales
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orders
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Price
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredDeals().map((deal, index) => (
                    <tr key={deal.dealId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-green-600 font-semibold text-sm">
                              {index + 1}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">{deal.dealName}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {deal.totalQuantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                        {formatCurrency(deal.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {deal.orderCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {formatCurrency(deal.averagePrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <p>No deals sold in this period.</p>
            </div>
          )}
        </Card>
      )}

      {/* Categories Tab */}
      {tab === 'categories' && (
        <Card padding="md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Category Sales</h2>
          {getFilteredCategories().length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category Name
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty Sold
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Sales
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orders
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Price
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredCategories().map((category, index) => (
                    <tr key={category.categoryId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blue-600 font-semibold text-sm">
                              {index + 1}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">{category.categoryName}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {category.totalQuantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                        {formatCurrency(category.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {category.orderCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {formatCurrency(category.averagePrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <p>No category sales in this period.</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
