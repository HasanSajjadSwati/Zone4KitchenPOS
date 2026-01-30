import React, { useEffect, useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { ArrowDownTrayIcon, ChartBarIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  getItemSales,
  getDealSales,
  getCategorySales,
  exportToCSV,
  type DateRange,
  type ItemSales as ItemSalesType,
  type DealSales,
  type CategorySales,
} from '@/services/reportService';
import { useDialog } from '@/hooks/useDialog';
import { formatCurrency } from '@/utils/validation';

type TabType = 'items' | 'deals' | 'categories';

export const ItemSales: React.FC = () => {
  const dialog = useDialog();
  const [tab, setTab] = useState<TabType>('items');
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999)),
  });
  const [itemSales, setItemSales] = useState<ItemSalesType[]>([]);
  const [dealSales, setDealSales] = useState<DealSales[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const [items, deals, categories] = await Promise.all([
        getItemSales(dateRange),
        getDealSales(dateRange),
        getCategorySales(dateRange),
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

  const setThisMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setDateRange({
      startDate: new Date(firstDay.setHours(0, 0, 0, 0)),
      endDate: new Date(lastDay.setHours(23, 59, 59, 999)),
    });
  };

  const handleExport = () => {
    const filename = `${tab}-sales-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}.csv`;

    switch (tab) {
      case 'items': {
        const exportData = getFilteredItems().map(item => ({
          'Item Name': item.itemName,
          'Category': item.categoryName || 'N/A',
          'Quantity Sold': item.totalQuantity,
          'Total Sales': formatCurrency(item.totalSales),
          'Orders': item.orderCount,
          'Average Price': formatCurrency(item.averagePrice),
        }));
        exportToCSV(exportData, filename);
        break;
      }
      case 'deals': {
        const exportData = getFilteredDeals().map(deal => ({
          'Deal Name': deal.dealName,
          'Quantity Sold': deal.totalQuantity,
          'Total Sales': formatCurrency(deal.totalSales),
          'Orders': deal.orderCount,
          'Average Price': formatCurrency(deal.averagePrice),
        }));
        exportToCSV(exportData, filename);
        break;
      }
      case 'categories': {
        const exportData = getFilteredCategories().map(category => ({
          'Category Name': category.categoryName,
          'Quantity Sold': category.totalQuantity,
          'Total Sales': formatCurrency(category.totalSales),
          'Orders': category.orderCount,
          'Average Price': formatCurrency(category.averagePrice),
        }));
        exportToCSV(exportData, filename);
        break;
      }
    }
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
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
        <Button
          variant="secondary"
          onClick={handleExport}
          leftIcon={<ArrowDownTrayIcon className="w-5 h-5" />}
        >
          Export to CSV
        </Button>
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
