import React, { useEffect, useState } from 'react';
import { Button, Card, TimePicker, RegisterSessionPicker } from '@/components/ui';
import { ArrowDownTrayIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  getCategorySalesDetailed,
  exportToCSV,
  exportToPDF,
  type DateRange,
  type MajorCategorySales,
} from '@/services/reportService';
import { getAllSessions } from '@/services/registerService';
import type { RegisterSession } from '@/db/types';
import { useDialog } from '@/hooks/useDialog';
import { useDayRange } from '@/hooks/useDayRange';
import { formatCurrency } from '@/utils/validation';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom' | 'register_session';

export const CategorySalesReport: React.FC = () => {
  const dialog = useDialog();
  const { getTodayRange } = useDayRange();
  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [categorySales, setCategorySales] = useState<MajorCategorySales[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Register session filter
  const [registerSessions, setRegisterSessions] = useState<RegisterSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const result = await getAllSessions(50, 0);
        setRegisterSessions(result.sessions);
      } catch (error) {
        console.error('Failed to load register sessions:', error);
      }
    };
    loadSessions();
  }, []);

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
      case 'register_session':
        return { startDate: new Date(0), endDate: new Date() };
      default:
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
    }
  };

  useEffect(() => {
    if (datePreset === 'register_session' && !selectedSessionId) {
      setCategorySales([]);
      return;
    }
    loadReportData();
  }, [datePreset, customStartDate, customStartTime, customEndDate, customEndTime, selectedSessionId]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const range = await getDateRange();
      const sessionId = datePreset === 'register_session' && selectedSessionId ? selectedSessionId : undefined;
      const data = await getCategorySalesDetailed(range, sessionId);
      setCategorySales(data);
    } catch (error) {
      console.error('Failed to load category sales:', error);
      await dialog.alert('Failed to load category sales data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCategories(new Set(categorySales.map((c) => c.categoryId)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // Grand totals
  const grandTotalSales = categorySales.reduce((sum, c) => sum + c.totalSales, 0);
  const grandTotalQuantity = categorySales.reduce((sum, c) => sum + c.totalQuantity, 0);
  const grandTotalOrders = categorySales.reduce((sum, c) => sum + c.orderCount, 0);

  const handleExportCSV = () => {
    if (categorySales.length === 0) return;
    const rows: Record<string, string | number>[] = [];
    for (const major of categorySales) {
      rows.push({
        'Category': major.categoryName,
        'Type': 'Major',
        'Qty Sold': major.totalQuantity,
        'Total Sales': formatCurrency(major.totalSales),
        'Orders': major.orderCount,
        'Avg Price': formatCurrency(major.averagePrice),
      });
      for (const sub of major.subCategories) {
        if (sub.totalSales > 0) {
          rows.push({
            'Category': `  ${sub.categoryName}`,
            'Type': 'Sub',
            'Qty Sold': sub.totalQuantity,
            'Total Sales': formatCurrency(sub.totalSales),
            'Orders': sub.orderCount,
            'Avg Price': formatCurrency(sub.averagePrice),
          });
        }
      }
    }
    exportToCSV(rows, `category-sales-${datePreset}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportPDF = () => {
    if (categorySales.length === 0) return;
    const rows: Record<string, unknown>[] = [];
    for (const major of categorySales) {
      rows.push({
        'Category': major.categoryName,
        'Type': 'Major',
        'Qty Sold': major.totalQuantity,
        'Total Sales': formatCurrency(major.totalSales),
        'Orders': major.orderCount,
        'Avg Price': formatCurrency(major.averagePrice),
      });
      for (const sub of major.subCategories) {
        if (sub.totalSales > 0) {
          rows.push({
            'Category': `  ${sub.categoryName}`,
            'Type': 'Sub',
            'Qty Sold': sub.totalQuantity,
            'Total Sales': formatCurrency(sub.totalSales),
            'Orders': sub.orderCount,
            'Avg Price': formatCurrency(sub.averagePrice),
          });
        }
      }
    }
    exportToPDF(rows, `category-sales-${datePreset}-${new Date().toISOString().split('T')[0]}.pdf`, {
      title: 'Category Sales Report',
      orientation: 'landscape',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Category Sales Report</h1>
          <p className="text-sm text-gray-500 mt-1">Detailed sales breakdown by major category and subcategories</p>
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
          {(['today', 'yesterday', 'this_week', 'this_month', 'custom', 'register_session'] as DateRangePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setDatePreset(preset);
                if (preset !== 'register_session') {
                  setSelectedSessionId('');
                }
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                datePreset === preset
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {preset === 'register_session' ? 'Register Session' : preset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        {datePreset === 'register_session' && (
          <RegisterSessionPicker
            sessions={registerSessions}
            selectedId={selectedSessionId}
            onSelect={setSelectedSessionId}
          />
        )}

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

      {/* Summary Cards */}
      {categorySales.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding="md">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(grandTotalSales)}</p>
            <p className="text-xs text-gray-400 mt-1">{categorySales.length} major categories</p>
          </Card>
          <Card padding="md">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Items Sold</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{grandTotalQuantity.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">across all categories</p>
          </Card>
          <Card padding="md">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{grandTotalOrders.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">containing category items</p>
          </Card>
        </div>
      )}

      {/* Expand/Collapse controls */}
      {categorySales.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Collapse All
          </button>
        </div>
      )}

      {/* Category Sales Table */}
      <Card padding="md">
        {categorySales.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Category Name</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Qty Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Orders</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Avg Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categorySales.map((major, index) => {
                  const isExpanded = expandedCategories.has(major.categoryId);
                  const hasSubCategories = major.subCategories.length > 0;
                  const salesPercent = grandTotalSales > 0 ? ((major.totalSales / grandTotalSales) * 100).toFixed(1) : '0.0';
                  const activeSubs = major.subCategories.filter(s => s.totalSales > 0 || s.totalQuantity > 0);

                  return (
                    <React.Fragment key={major.categoryId}>
                      {/* Major Category Row */}
                      <tr
                        className={`hover:bg-gray-50/50 transition-colors ${hasSubCategories ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-blue-50/30' : ''}`}
                        onClick={() => hasSubCategories && toggleCategory(major.categoryId)}
                      >
                        <td className="px-4 py-3">
                          {hasSubCategories ? (
                            isExpanded ? (
                              <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                            )
                          ) : (
                            <span className="w-4 h-4 block" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 w-7 h-7 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mr-3">
                              <span className="font-semibold text-xs">{index + 1}</span>
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-gray-900">{major.categoryName}</span>
                              {hasSubCategories && (
                                <span className="ml-2 text-xs text-gray-400">
                                  ({activeSubs.length} sub{activeSubs.length !== 1 ? 'categories' : 'category'})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-700">{major.totalQuantity}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                          {formatCurrency(major.totalSales)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-700">{major.orderCount}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(major.averagePrice)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-primary-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, Number(salesPercent))}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-600 w-12 text-right">{salesPercent}%</span>
                          </div>
                        </td>
                      </tr>

                      {/* Subcategory Rows */}
                      {isExpanded && activeSubs.map((sub) => {
                        const subPercent = major.totalSales > 0 ? ((sub.totalSales / major.totalSales) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={sub.categoryId} className="bg-gray-50/40 hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-2.5"></td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center pl-10">
                                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full mr-3" />
                                <span className="text-sm text-gray-700">{sub.categoryName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right text-gray-600">{sub.totalQuantity}</td>
                            <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-800">
                              {formatCurrency(sub.totalSales)}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right text-gray-600">{sub.orderCount}</td>
                            <td className="px-4 py-2.5 text-sm text-right text-gray-600">{formatCurrency(sub.averagePrice)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-xs text-gray-400">{subPercent}%</span>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Show empty subcategories message */}
                      {isExpanded && activeSubs.length === 0 && major.subCategories.length > 0 && (
                        <tr className="bg-gray-50/40">
                          <td className="px-4 py-2.5"></td>
                          <td colSpan={6} className="px-4 py-2.5 pl-14 text-sm text-gray-400 italic">
                            No subcategory sales in this period
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Grand Total Row */}
                <tr className="bg-gray-100/80 border-t-2 border-gray-300">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">Grand Total</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{grandTotalQuantity}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                    {formatCurrency(grandTotalSales)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{grandTotalOrders}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                    {formatCurrency(grandTotalQuantity > 0 ? grandTotalSales / grandTotalQuantity : 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-bold text-gray-700">100%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            {isLoading ? 'Loading...' : 'No category sales data in this period.'}
          </div>
        )}
      </Card>
    </div>
  );
};
