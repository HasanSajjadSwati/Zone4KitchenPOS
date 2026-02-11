import React, { useState, useEffect } from 'react';
import { Card, Button, TimePicker } from '@/components/ui';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { getDailyExpenseReport, exportToCSV, exportToPDF, type DailyExpenseReport as DailyExpenseReportType, type DateRange } from '@/services/reportService';
import { formatCurrency } from '@/utils/validation';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export const DailyExpenseReport: React.FC = () => {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [reportData, setReportData] = useState<DailyExpenseReportType[]>([]);
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
      const data = await getDailyExpenseReport(range);
      setReportData(data);
    } catch (error) {
      console.error('Error loading expense report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getExportData = () =>
    reportData.map(day => ({
      Date: day.date,
      'Total Sales': day.totalSales,
      'Total Expenses': day.totalExpenses,
      'Net Profit': day.netProfit,
      'Expenses Detail': day.expensesByCategory.map(c => `${c.category}: ${c.amount}`).join('; '),
    }));

  const handleExportCSV = () => {
    const exportData = getExportData();
    exportToCSV(
      exportData,
      `daily-expense-report-${datePreset}-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleExportPDF = () => {
    const exportData = getExportData();
    exportToPDF(
      exportData,
      `daily-expense-report-${datePreset}-${new Date().toISOString().split('T')[0]}.pdf`,
      { title: 'Daily Expense Report', orientation: 'landscape' }
    );
  };

  const totalSales = reportData.reduce((sum, day) => sum + day.totalSales, 0);
  const totalExpenses = reportData.reduce((sum, day) => sum + day.totalExpenses, 0);
  const netProfit = totalSales - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Daily Expense Report</h1>
          <p className="text-gray-600">Sales - Expenses = Net Profit</p>
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
            <div className="text-sm text-gray-600">Total Sales</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSales)}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Total Expenses</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Net Profit</div>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(netProfit)}
            </div>
          </div>
        </Card>
      </div>

      {/* Daily Breakdown Table */}
      <Card>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Daily Breakdown</h2>
            <div className="flex items-center space-x-2">
              <Button onClick={handleExportCSV} disabled={reportData.length === 0}>
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={handleExportPDF} disabled={reportData.length === 0}>
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No data found for this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sales</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expenses</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expense Categories</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((day) => (
                    <tr key={day.date} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{day.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                        {formatCurrency(day.totalSales)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                        {formatCurrency(day.totalExpenses)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                        day.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(day.netProfit)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {day.expensesByCategory.length > 0 ? (
                          <div className="space-y-1">
                            {day.expensesByCategory.map((cat, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-medium">{cat.category}:</span>{' '}
                                <span className="text-gray-600">{formatCurrency(cat.amount)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">No expenses</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td className="px-6 py-4 text-sm">TOTAL</td>
                    <td className="px-6 py-4 text-sm text-right text-green-600">
                      {formatCurrency(totalSales)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-red-600">
                      {formatCurrency(totalExpenses)}
                    </td>
                    <td className={`px-6 py-4 text-sm text-right ${
                      netProfit >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(netProfit)}
                    </td>
                    <td className="px-6 py-4"></td>
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
