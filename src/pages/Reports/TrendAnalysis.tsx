import React, { useEffect, useState, useMemo } from 'react';
import { Card, TimePicker, RegisterSessionPicker } from '@/components/ui';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getItemTrendData,
  type DateRange,
  type ItemTrendPoint,
} from '@/services/reportService';
import { getAllSessions } from '@/services/registerService';
import type { RegisterSession } from '@/db/types';
import { useDialog } from '@/hooks/useDialog';
import { useDayRange } from '@/hooks/useDayRange';
import { formatCurrency } from '@/utils/validation';
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  subDays,
} from 'date-fns';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all_time' | 'custom' | 'register_session';
type MetricType = 'quantity' | 'revenue';

const CHART_COLORS = [
  '#2563EB',
  '#10B981',
  '#8B5CF6',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
];

const formatAxisDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
};

const formatAxisValue = (value: number, metric: MetricType): string => {
  if (metric === 'revenue') {
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return String(Math.round(value));
  }
  return String(value);
};

export const TrendAnalysis: React.FC = () => {
  const dialog = useDialog();
  const { getTodayRange } = useDayRange();

  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('23:59');
  const [registerSessions, setRegisterSessions] = useState<RegisterSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const [trendData, setTrendData] = useState<ItemTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [metric, setMetric] = useState<MetricType>('quantity');
  const [topN, setTopN] = useState<number>(5);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getAllSessions(50, 0)
      .then((r) => setRegisterSessions(r.sessions))
      .catch((e) => console.error('Failed to load sessions:', e));
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
      case 'yesterday': {
        const yesterday = subDays(now, 1);
        return { startDate: startOfDay(yesterday), endDate: endOfDay(yesterday) };
      }
      case 'this_week':
        return { startDate: startOfWeek(now, { weekStartsOn: 1 }), endDate: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'this_month':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case 'all_time':
        return { startDate: new Date(0), endDate: now };
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const range = await getDateRange();
      const sessionId =
        datePreset === 'register_session' && selectedSessionId ? selectedSessionId : undefined;
      const data = await getItemTrendData(range, sessionId);
      setTrendData(data);
    } catch (error) {
      console.error('Failed to load trend data:', error);
      await dialog.alert('Failed to load trend data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (datePreset === 'register_session' && !selectedSessionId) {
      setTrendData([]);
      return;
    }
    loadData();
  }, [datePreset, customStartDate, customStartTime, customEndDate, customEndTime, selectedSessionId]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return trendData;
    const q = searchQuery.toLowerCase();
    return trendData.filter(
      (item) =>
        item.itemName.toLowerCase().includes(q) ||
        (item.categoryName || '').toLowerCase().includes(q)
    );
  }, [trendData, searchQuery]);

  const displayData = useMemo(() => filteredData.slice(0, topN), [filteredData, topN]);

  const allDates = useMemo(() => {
    const dates = new Set<string>();
    for (const item of displayData) {
      for (const d of item.dailyData) dates.add(d.date);
    }
    return Array.from(dates).sort();
  }, [displayData]);

  const isMultiDate = allDates.length > 1;

  // Line chart data: one row per date, one key per item (item_0, item_1, ...)
  const lineChartData = useMemo(() => {
    return allDates.map((date) => {
      const point: Record<string, string | number> = { date: formatAxisDate(date) };
      displayData.forEach((item, i) => {
        const dayData = item.dailyData.find((d) => d.date === date);
        point[`item_${i}`] = dayData
          ? metric === 'quantity'
            ? dayData.quantity
            : dayData.sales
          : 0;
      });
      return point;
    });
  }, [displayData, allDates, metric]);

  // Bar chart data for single-date view
  const barChartData = useMemo(() => {
    return displayData.map((item) => ({
      name: item.itemName.length > 16 ? `${item.itemName.slice(0, 16)}…` : item.itemName,
      fullName: item.itemName,
      value: metric === 'quantity' ? item.totalQuantity : item.totalSales,
    }));
  }, [displayData, metric]);

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm">
        <p className="font-medium text-gray-900">{d.fullName}</p>
        <p className="text-gray-600">
          {metric === 'revenue' ? formatCurrency(d.value) : `${d.value} units`}
        </p>
      </div>
    );
  };

  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm min-w-[160px]">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="truncate max-w-[140px]">{entry.name}</span>
            <span className="ml-auto font-medium text-gray-900">
              {metric === 'revenue' ? formatCurrency(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Item Trend Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">Track how item sales change over time</p>
      </div>

      {/* Date Range Selection */}
      <Card padding="md">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              'today',
              'yesterday',
              'this_week',
              'this_month',
              'all_time',
              'custom',
              'register_session',
            ] as DateRangePreset[]
          ).map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setDatePreset(preset);
                if (preset !== 'register_session') setSelectedSessionId('');
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                datePreset === preset
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {preset === 'register_session'
                ? 'Register Session'
                : preset.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
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

        {isLoading && <p className="text-sm text-gray-400 mt-3">Loading trend data...</p>}
      </Card>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['quantity', 'revenue'] as MetricType[]).map((m) => (
            <button
              key={m}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                metric === m
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setMetric(m)}
            >
              {m === 'quantity' ? 'Quantity Sold' : 'Revenue'}
            </button>
          ))}
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1">
          {[5, 10].map((n) => (
            <button
              key={n}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                topN === n
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setTopN(n)}
            >
              Top {n}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Search items or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chart */}
      <Card padding="md">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {metric === 'quantity' ? 'Quantity Sold' : 'Revenue'} Over Time
          {isMultiDate && (
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({allDates.length} days)
            </span>
          )}
        </h2>

        {displayData.length > 0 ? (
          <ResponsiveContainer width="100%" height={380}>
            {isMultiDate ? (
              <LineChart data={lineChartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v) => formatAxisValue(v, metric)}
                  tick={{ fontSize: 11 }}
                  width={metric === 'revenue' ? 56 : 36}
                />
                <Tooltip content={<CustomLineTooltip />} />
                <Legend />
                {displayData.map((item, i) => (
                  <Line
                    key={`item_${i}`}
                    type="monotone"
                    dataKey={`item_${i}`}
                    name={item.itemName}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart
                data={barChartData}
                margin={{ top: 8, right: 24, left: 8, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => formatAxisValue(v, metric)}
                  tick={{ fontSize: 11 }}
                  width={metric === 'revenue' ? 56 : 36}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barChartData.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400">
            {isLoading ? 'Loading…' : 'No item sales data for the selected period.'}
          </div>
        )}
      </Card>

      {/* Summary Table */}
      {displayData.length > 0 && (
        <Card padding="md">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Item Summary</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                    {isMultiDate ? 'Avg / Day' : 'Avg Price'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayData.map((item, index) => {
                  const activeDays = item.dailyData.length || 1;
                  return (
                    <tr key={item.itemId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.itemName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.categoryName || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{item.totalQuantity}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(item.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">
                        {isMultiDate
                          ? metric === 'quantity'
                            ? `${(item.totalQuantity / activeDays).toFixed(1)} units`
                            : formatCurrency(item.totalSales / activeDays)
                          : item.totalQuantity > 0
                          ? formatCurrency(item.totalSales / item.totalQuantity)
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
