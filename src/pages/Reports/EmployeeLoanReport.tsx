import React, { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Button, Card, Badge } from '@/components/ui';
import { getEmployeeLoanSummaries, getOutstandingLoans } from '@/services/employeeService';
import { exportToCSV } from '@/services/reportService';
import { formatCurrency, formatDate } from '@/utils/validation';
import type { EmployeeLoanSummary } from '@/services/employeeService';
import type { EmployeeLoan } from '@/db/types';

export const EmployeeLoanReport: React.FC = () => {
  const [loanSummaries, setLoanSummaries] = useState<EmployeeLoanSummary[]>([]);
  const [outstandingLoans, setOutstandingLoans] = useState<EmployeeLoan[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [summaries, outstanding] = await Promise.all([
        getEmployeeLoanSummaries(),
        getOutstandingLoans(),
      ]);
      setLoanSummaries(summaries);
      setOutstandingLoans(outstanding);
    } catch (error) {
      console.error('Error loading loan data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportSummary = () => {
    const exportData = loanSummaries.map((summary) => ({
      Employee: summary.employeeName,
      'Total Loans': summary.totalLoans,
      'Total Amount': summary.totalAmount,
      'Total Paid': summary.totalPaid,
      'Total Remaining': summary.totalRemaining,
      'Active Loans': summary.activeLoans,
    }));

    exportToCSV(
      exportData,
      `employee-loan-summary-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleExportOutstanding = () => {
    const exportData = outstandingLoans.map((loan) => {
      const summary = loanSummaries.find((s) => s.employeeId === loan.employeeId);
      return {
        Employee: summary?.employeeName || 'Unknown',
        'Issue Date': formatDate(new Date(loan.issueDate)),
        'Loan Amount': loan.amount,
        'Installments Paid': `${loan.paidInstallments}/${loan.totalInstallments}`,
        'Remaining Amount': loan.remainingAmount,
        Reason: loan.reason || 'N/A',
      };
    });

    exportToCSV(
      exportData,
      `outstanding-loans-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const totalOutstanding = loanSummaries.reduce((sum, s) => sum + s.totalRemaining, 0);
  const totalLoanAmount = loanSummaries.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPaid = loanSummaries.reduce((sum, s) => sum + s.totalPaid, 0);

  const filteredOutstandingLoans = selectedEmployeeId
    ? outstandingLoans.filter((loan) => loan.employeeId === selectedEmployeeId)
    : outstandingLoans;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Employee Loan Report</h1>
          <p className="text-gray-600">View loan summaries and outstanding balances</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Total Outstanding</div>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalOutstanding)}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Total Loan Amount</div>
            <div className="text-2xl font-bold">{formatCurrency(totalLoanAmount)}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Total Paid</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalPaid)}
            </div>
          </div>
        </Card>
      </div>

      {/* Employee Loan Summary */}
      <Card>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Loan Summary by Employee</h2>
            <Button
              onClick={handleExportSummary}
              disabled={loanSummaries.length === 0}
              leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
              size="sm"
            >
              Export CSV
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          ) : loanSummaries.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No loan data found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Total Loans
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Loan Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Paid
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Active Loans
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loanSummaries.map((summary) => (
                    <tr
                      key={summary.employeeId}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        setSelectedEmployeeId(
                          selectedEmployeeId === summary.employeeId
                            ? null
                            : summary.employeeId
                        )
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {summary.employeeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {summary.totalLoans}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {formatCurrency(summary.totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                        {formatCurrency(summary.totalPaid)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                        {formatCurrency(summary.totalRemaining)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {summary.activeLoans > 0 ? (
                          <Badge variant="warning">{summary.activeLoans} Active</Badge>
                        ) : (
                          <Badge variant="success">All Paid</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Outstanding Loans Detail */}
      <Card>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              Outstanding Loans{' '}
              {selectedEmployeeId && (
                <span className="text-sm text-gray-600">
                  - {loanSummaries.find((s) => s.employeeId === selectedEmployeeId)?.employeeName}
                </span>
              )}
            </h2>
            <div className="flex space-x-2">
              {selectedEmployeeId && (
                <Button
                  onClick={() => setSelectedEmployeeId(null)}
                  variant="secondary"
                  size="sm"
                >
                  Show All
                </Button>
              )}
              <Button
                onClick={handleExportOutstanding}
                disabled={filteredOutstandingLoans.length === 0}
                leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
                size="sm"
              >
                Export CSV
              </Button>
            </div>
          </div>

          {filteredOutstandingLoans.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              {selectedEmployeeId
                ? 'No outstanding loans for this employee'
                : 'No outstanding loans'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Issue Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Loan Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Installments
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOutstandingLoans.map((loan) => {
                    const summary = loanSummaries.find((s) => s.employeeId === loan.employeeId);
                    const progress = (loan.paidInstallments / loan.totalInstallments) * 100;

                    return (
                      <tr key={loan.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {summary?.employeeName || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(new Date(loan.issueDate))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {formatCurrency(loan.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div>
                            {loan.paidInstallments}/{loan.totalInstallments}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                          {formatCurrency(loan.remainingAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {loan.reason || 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
