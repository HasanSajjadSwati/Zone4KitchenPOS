import React, { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Button, Card, Badge } from '@/components/ui';
import { getEmployeeLoanSummaries, getOutstandingLoans } from '@/services/employeeService';
import { exportToCSV, exportToPDF } from '@/services/reportService';
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

  const getSummaryExportData = () =>
    loanSummaries.map((summary) => ({
      Employee: summary.employeeName,
      'Total Loans': summary.totalLoans,
      'Total Amount': summary.totalAmount,
      'Total Paid': summary.totalPaid,
      'Total Remaining': summary.totalRemaining,
      'Active Loans': summary.activeLoans,
    }));

  const getOutstandingExportData = () => {
    const loansToExport = selectedEmployeeId
      ? outstandingLoans.filter((loan) => loan.employeeId === selectedEmployeeId)
      : outstandingLoans;

    return loansToExport.map((loan) => {
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
  };

  const handleExportSummaryCSV = () => {
    const exportData = getSummaryExportData();
    exportToCSV(
      exportData,
      `employee-loan-summary-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleExportSummaryPDF = () => {
    const exportData = getSummaryExportData();
    exportToPDF(
      exportData,
      `employee-loan-summary-${new Date().toISOString().split('T')[0]}.pdf`,
      { title: 'Employee Loan Summary' }
    );
  };

  const handleExportOutstandingCSV = () => {
    const exportData = getOutstandingExportData();
    exportToCSV(
      exportData,
      `outstanding-loans-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleExportOutstandingPDF = () => {
    const exportData = getOutstandingExportData();
    exportToPDF(
      exportData,
      `outstanding-loans-${new Date().toISOString().split('T')[0]}.pdf`,
      { title: 'Outstanding Employee Loans', orientation: 'landscape' }
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Employee Loan Report</h1>
        <p className="text-sm text-gray-500 mt-1">View loan summaries and outstanding balances</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md" className="border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Outstanding</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalOutstanding)}</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-blue-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Loan Amount</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalLoanAmount)}</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-emerald-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalPaid)}</p>
        </Card>
      </div>

      {/* Employee Loan Summary */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Loan Summary by Employee</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportSummaryCSV}
              disabled={loanSummaries.length === 0}
              leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportSummaryPDF}
              disabled={loanSummaries.length === 0}
              leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
            >
              Export PDF
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : loanSummaries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No loan data found</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Total Loans</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Loan Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Remaining</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Active Loans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loanSummaries.map((summary) => (
                  <tr
                    key={summary.employeeId}
                    className={`cursor-pointer transition-colors ${
                      selectedEmployeeId === summary.employeeId
                        ? 'bg-primary-50/50'
                        : 'hover:bg-gray-50/50'
                    }`}
                    onClick={() =>
                      setSelectedEmployeeId(
                        selectedEmployeeId === summary.employeeId
                          ? null
                          : summary.employeeId
                      )
                    }
                  >
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-sm text-gray-900">
                      {summary.employeeName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {summary.totalLoans}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                      {formatCurrency(summary.totalAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-emerald-600 font-medium">
                      {formatCurrency(summary.totalPaid)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                      {formatCurrency(summary.totalRemaining)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
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
      </Card>

      {/* Outstanding Loans Detail */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Outstanding Loans
            {selectedEmployeeId && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                - {loanSummaries.find((s) => s.employeeId === selectedEmployeeId)?.employeeName}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {selectedEmployeeId && (
              <Button
                onClick={() => setSelectedEmployeeId(null)}
                variant="ghost"
                size="sm"
              >
                Show All
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportOutstandingCSV}
              disabled={filteredOutstandingLoans.length === 0}
              leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportOutstandingPDF}
              disabled={filteredOutstandingLoans.length === 0}
              leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
            >
              Export PDF
            </Button>
          </div>
        </div>

        {filteredOutstandingLoans.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {selectedEmployeeId
              ? 'No outstanding loans for this employee'
              : 'No outstanding loans'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Issue Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Loan Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Installments</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Remaining</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOutstandingLoans.map((loan) => {
                  const summary = loanSummaries.find((s) => s.employeeId === loan.employeeId);
                  const progress = (loan.paidInstallments / loan.totalInstallments) * 100;

                  return (
                    <tr key={loan.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-sm text-gray-900">
                        {summary?.employeeName || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(new Date(loan.issueDate))}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="text-gray-700">
                          {loan.paidInstallments}/{loan.totalInstallments}
                        </div>
                        <div className="w-24 bg-gray-100 rounded-full h-1.5 mt-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-red-600">
                        {formatCurrency(loan.remainingAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {loan.reason || 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
