import React, { useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { MagnifyingGlassIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { searchCustomerReports, exportToCSV, exportToPDF, type CustomerDetailedReport as CustomerReport } from '@/services/reportService';
import { formatCurrency, formatDate } from '@/utils/validation';

export const CustomerDetailedReport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerReport[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerReport | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchCustomerReports(searchQuery);
      setSearchResults(results);

      if (results.length === 1) {
        setSelectedCustomer(results[0]);
      } else {
        setSelectedCustomer(null);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectCustomer = (customer: CustomerReport) => {
    setSelectedCustomer(customer);
  };

  const getExportData = () => {
    if (!selectedCustomer) return [];
    return selectedCustomer.orderHistory.map(order => ({
      'Order #': order.orderNumber,
      'Date': formatDate(new Date(order.orderDate)),
      'Order Type': order.orderType === 'dine_in' ? 'Dine In' : order.orderType === 'take_away' ? 'Take Away' : 'Delivery',
      'Total': order.total,
      'Payment Status': order.isPaid ? 'Paid' : 'Unpaid',
      'Status': order.status,
    }));
  };

  const handleExportCSV = () => {
    if (!selectedCustomer) return;
    const exportData = getExportData();
    exportToCSV(
      exportData,
      `customer-${selectedCustomer.customerName}-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleExportPDF = () => {
    if (!selectedCustomer) return;
    const exportData = getExportData();
    exportToPDF(
      exportData,
      `customer-${selectedCustomer.customerName}-${new Date().toISOString().split('T')[0]}.pdf`,
      { title: `Customer Report - ${selectedCustomer.customerName}`, orientation: 'landscape' }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Customer Report</h1>
        <p className="text-sm text-gray-500 mt-1">Search for customers and view their order history</p>
      </div>

      {/* Search Bar */}
      <Card padding="md">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search by customer name or phone number..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <Button onClick={handleSearch} isLoading={isSearching} size="sm">
            Search
          </Button>
        </div>
      </Card>

      {/* Search Results */}
      {searchResults.length > 1 && !selectedCustomer && (
        <Card padding="md">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Search Results ({searchResults.length})</h2>
          <div className="space-y-2">
            {searchResults.map((customer) => (
              <div
                key={customer.customerId}
                onClick={() => handleSelectCustomer(customer)}
                className="p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-gray-50/50 cursor-pointer transition-all"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">{customer.customerName}</div>
                    <div className="text-sm text-gray-500">{customer.customerPhone}</div>
                    {customer.customerAddress && (
                      <div className="text-xs text-gray-400 mt-1">{customer.customerAddress}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{customer.totalOrders} Orders</div>
                    <div className="text-sm text-gray-500">{formatCurrency(customer.totalAmount)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Customer Details */}
      {selectedCustomer && (
        <>
          {/* Customer Info */}
          <Card padding="md">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedCustomer.customerName}</h2>
                <div className="text-sm text-gray-500 mt-1">Phone: {selectedCustomer.customerPhone}</div>
                {selectedCustomer.customerAddress && (
                  <div className="text-sm text-gray-500">Address: {selectedCustomer.customerAddress}</div>
                )}
                {selectedCustomer.lastOrderDate && (
                  <div className="text-xs text-gray-400 mt-2">
                    Last Order: {formatDate(new Date(selectedCustomer.lastOrderDate))}
                  </div>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedCustomer(null);
                  setSearchResults([]);
                  setSearchQuery('');
                }}
              >
                Search Another
              </Button>
            </div>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card padding="md" className="border-l-4 border-l-blue-500">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{selectedCustomer.totalOrders}</p>
              <p className="text-xs text-gray-400 mt-1">
                {selectedCustomer.paidOrders} paid, {selectedCustomer.unpaidOrders} unpaid
              </p>
            </Card>
            <Card padding="md" className="border-l-4 border-l-emerald-500">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(selectedCustomer.totalAmount)}</p>
            </Card>
            <Card padding="md" className={`border-l-4 ${selectedCustomer.unpaidAmount > 0 ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding Balance</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(selectedCustomer.unpaidAmount)}
              </p>
            </Card>
          </div>

          {/* Payment Breakdown */}
          <Card padding="md">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Payment Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50/70 rounded-xl p-4 border border-emerald-100">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Paid Orders</p>
                <p className="font-semibold text-gray-900 mt-1">{selectedCustomer.paidOrders} orders</p>
                <p className="text-sm text-gray-500 mt-0.5">{formatCurrency(selectedCustomer.paidAmount)}</p>
              </div>
              <div className="bg-red-50/70 rounded-xl p-4 border border-red-100">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wider">Unpaid Orders</p>
                <p className="font-semibold text-gray-900 mt-1">{selectedCustomer.unpaidOrders} orders</p>
                <p className="text-sm text-gray-500 mt-0.5">{formatCurrency(selectedCustomer.unpaidAmount)}</p>
              </div>
            </div>
          </Card>

          {/* Order History */}
          <Card padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                Order History ({selectedCustomer.orderHistory.length})
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={selectedCustomer.orderHistory.length === 0}
                  leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
                >
                  Export CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={selectedCustomer.orderHistory.length === 0}
                  leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
                >
                  Export PDF
                </Button>
              </div>
            </div>

            {selectedCustomer.orderHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No orders found</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50/80">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Order #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Payment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedCustomer.orderHistory.map((order) => (
                      <tr key={order.orderId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(new Date(order.orderDate))}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {order.orderType === 'dine_in' ? 'Dine In' :
                           order.orderType === 'take_away' ? 'Take Away' :
                           'Delivery'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                          {formatCurrency(order.total)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant={order.isPaid ? 'success' : 'warning'}>
                            {order.isPaid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge
                            variant={
                              order.status === 'completed' ? 'success' :
                              order.status === 'cancelled' ? 'default' :
                              'warning'
                            }
                          >
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50/80 font-semibold">
                      <td colSpan={3} className="px-4 py-3 text-sm text-gray-900">Total</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {formatCurrency(selectedCustomer.totalAmount)}
                      </td>
                      <td colSpan={2} className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* No Results */}
      {searchResults.length === 0 && searchQuery && !isSearching && (
        <Card padding="lg">
          <div className="text-center py-12">
            <p className="text-gray-400">No customers found</p>
            <p className="text-sm text-gray-300 mt-1">Try searching with a different name or phone number</p>
          </div>
        </Card>
      )}
    </div>
  );
};
