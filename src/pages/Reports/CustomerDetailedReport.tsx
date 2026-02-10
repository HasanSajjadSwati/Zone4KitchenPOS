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

      // Auto-select if only one result
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Customer Detailed Report</h1>
          <p className="text-gray-600">Search for customers and view their order history</p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <div className="p-4">
          <label className="block text-sm font-medium mb-2">Search Customer</label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search by customer name or phone number..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button onClick={handleSearch} isLoading={isSearching}>
              Search
            </Button>
          </div>
        </div>
      </Card>

      {/* Search Results */}
      {searchResults.length > 1 && !selectedCustomer && (
        <Card>
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Search Results ({searchResults.length})</h2>
            <div className="space-y-2">
              {searchResults.map((customer) => (
                <div
                  key={customer.customerId}
                  onClick={() => handleSelectCustomer(customer)}
                  className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{customer.customerName}</div>
                      <div className="text-sm text-gray-600">{customer.customerPhone}</div>
                      {customer.customerAddress && (
                        <div className="text-xs text-gray-500 mt-1">{customer.customerAddress}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{customer.totalOrders} Orders</div>
                      <div className="text-sm text-gray-600">{formatCurrency(customer.totalAmount)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Customer Details */}
      {selectedCustomer && (
        <>
          {/* Customer Info */}
          <Card>
            <div className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedCustomer.customerName}</h2>
                  <div className="text-sm text-gray-600 mt-1">Phone: {selectedCustomer.customerPhone}</div>
                  {selectedCustomer.customerAddress && (
                    <div className="text-sm text-gray-600">Address: {selectedCustomer.customerAddress}</div>
                  )}
                  {selectedCustomer.lastOrderDate && (
                    <div className="text-sm text-gray-500 mt-2">
                      Last Order: {formatDate(new Date(selectedCustomer.lastOrderDate))}
                    </div>
                  )}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setSearchResults([]);
                    setSearchQuery('');
                  }}
                >
                  Search Another
                </Button>
              </div>
            </div>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Total Orders</div>
                <div className="text-2xl font-bold">{selectedCustomer.totalOrders}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {selectedCustomer.paidOrders} paid, {selectedCustomer.unpaidOrders} unpaid
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Total Amount</div>
                <div className="text-2xl font-bold">{formatCurrency(selectedCustomer.totalAmount)}</div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Outstanding Balance</div>
                <div className={`text-2xl font-bold ${
                  selectedCustomer.unpaidAmount > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(selectedCustomer.unpaidAmount)}
                </div>
              </div>
            </Card>
          </div>

          {/* Payment Breakdown */}
          <Card>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-3">Payment Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Paid Orders</div>
                  <div className="font-medium">{selectedCustomer.paidOrders} orders</div>
                  <div className="text-sm text-green-600">{formatCurrency(selectedCustomer.paidAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Unpaid Orders</div>
                  <div className="font-medium">{selectedCustomer.unpaidOrders} orders</div>
                  <div className="text-sm text-red-600">{formatCurrency(selectedCustomer.unpaidAmount)}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Order History */}
          <Card>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  Order History ({selectedCustomer.orderHistory.length})
                </h2>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handleExportCSV}
                    disabled={selectedCustomer.orderHistory.length === 0}
                    leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
                    size="sm"
                  >
                    Export CSV
                  </Button>
                  <Button
                    onClick={handleExportPDF}
                    disabled={selectedCustomer.orderHistory.length === 0}
                    leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
                    size="sm"
                  >
                    Export PDF
                  </Button>
                </div>
              </div>

              {selectedCustomer.orderHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-600">No orders found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Order #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Type
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Payment
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedCustomer.orderHistory.map((order) => (
                        <tr key={order.orderId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {order.orderNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(new Date(order.orderDate))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {order.orderType === 'dine_in' ? 'Dine In' :
                             order.orderType === 'take_away' ? 'Take Away' :
                             'Delivery'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                            {formatCurrency(order.total)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={order.isPaid ? 'success' : 'warning'}>
                              {order.isPaid ? 'Paid' : 'Unpaid'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
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
                    <tfoot className="bg-gray-50 font-bold">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-sm">TOTAL</td>
                        <td className="px-6 py-4 text-sm text-right">
                          {formatCurrency(selectedCustomer.totalAmount)}
                        </td>
                        <td colSpan={2} className="px-6 py-4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* No Results */}
      {searchResults.length === 0 && searchQuery && !isSearching && (
        <Card>
          <div className="p-8 text-center text-gray-600">
            <div className="mb-2">No customers found</div>
            <div className="text-sm">Try searching with a different name or phone number</div>
          </div>
        </Card>
      )}
    </div>
  );
};
