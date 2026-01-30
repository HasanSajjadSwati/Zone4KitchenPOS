import React, { useEffect, useState } from 'react';
import { PlusIcon, BanknotesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input, Select, Badge } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createEmployeeLoan,
  recordLoanPayment,
  cancelLoan,
  getAllLoans,
  getActiveEmployees,
} from '@/services/employeeService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { formatCurrency, formatDate } from '@/utils/validation';
import type { EmployeeLoan, Employee } from '@/db/types';

const loanSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  amount: z.number().min(1, 'Amount must be positive'),
  issueDate: z.string().min(1, 'Issue date is required'),
  totalInstallments: z.number().min(1, 'Must have at least 1 installment'),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const paymentSchema = z.object({
  paymentAmount: z.number().min(1, 'Payment amount must be positive'),
});

type LoanFormData = z.infer<typeof loanSchema>;
type PaymentFormData = z.infer<typeof paymentSchema>;

export const EmployeeLoanManagement: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();

  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeMap, setEmployeeMap] = useState<Map<string, Employee>>(new Map());
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paid' | 'cancelled'>('active');
  const [filteredLoans, setFilteredLoans] = useState<EmployeeLoan[]>([]);

  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<EmployeeLoan | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loanForm = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      employeeId: '',
      amount: 0,
      issueDate: new Date().toISOString().split('T')[0],
      totalInstallments: 1,
      reason: '',
      notes: '',
    },
  });

  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentAmount: 0,
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterLoans();
  }, [loans, filterStatus]);

  const loadData = async () => {
    const [loansData, employeesData] = await Promise.all([
      getAllLoans(),
      getActiveEmployees(),
    ]);

    setLoans(loansData);
    setEmployees(employeesData);

    const empMap = new Map<string, Employee>();
    employeesData.forEach((emp) => empMap.set(emp.id, emp));
    setEmployeeMap(empMap);
  };

  const filterLoans = () => {
    let filtered = loans;

    if (filterStatus !== 'all') {
      filtered = filtered.filter((loan) => loan.status === filterStatus);
    }

    setFilteredLoans(filtered);
  };

  const openLoanModal = () => {
    loanForm.reset({
      employeeId: '',
      amount: 0,
      issueDate: new Date().toISOString().split('T')[0],
      totalInstallments: 1,
      reason: '',
      notes: '',
    });
    setIsLoanModalOpen(true);
  };

  const openPaymentModal = (loan: EmployeeLoan) => {
    setSelectedLoan(loan);
    paymentForm.reset({
      paymentAmount: loan.installmentAmount,
    });
    setIsPaymentModalOpen(true);
  };

  const onSubmitLoan = async (data: LoanFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      await createEmployeeLoan(
        {
          employeeId: data.employeeId,
          amount: data.amount,
          issueDate: new Date(data.issueDate),
          totalInstallments: data.totalInstallments,
          reason: data.reason,
          notes: data.notes,
        },
        currentUser.id
      );

      await dialog.alert('Loan created successfully', 'Success');
      setIsLoanModalOpen(false);
      await loadData();
    } catch (error) {
      await dialog.alert(
        error instanceof Error ? error.message : 'Failed to create loan',
        'Error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitPayment = async (data: PaymentFormData) => {
    if (!currentUser || !selectedLoan) return;

    setIsLoading(true);
    try {
      await recordLoanPayment(selectedLoan.id, data.paymentAmount, currentUser.id);
      await dialog.alert('Payment recorded successfully', 'Success');
      setIsPaymentModalOpen(false);
      await loadData();
    } catch (error) {
      await dialog.alert(
        error instanceof Error ? error.message : 'Failed to record payment',
        'Error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelLoan = async (loan: EmployeeLoan) => {
    if (!currentUser) return;

    const confirmed = await dialog.confirm({
      title: 'Cancel Loan',
      message: 'Are you sure you want to cancel this loan? This action cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Cancel Loan',
      cancelLabel: 'Keep Loan',
    });

    if (!confirmed) return;

    try {
      await cancelLoan(loan.id, currentUser.id);
      await dialog.alert('Loan cancelled successfully', 'Success');
      await loadData();
    } catch (error) {
      await dialog.alert(
        error instanceof Error ? error.message : 'Failed to cancel loan',
        'Error'
      );
    }
  };

  const totalOutstanding = filteredLoans
    .filter((l) => l.status === 'active')
    .reduce((sum, l) => sum + l.remainingAmount, 0);

  const totalLoanAmount = filteredLoans.reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Employee Loan Management</h1>
          <p className="text-gray-600">Manage employee loans and track payments</p>
        </div>
        <Button onClick={openLoanModal} leftIcon={<PlusIcon className="w-5 h-5" />}>
          Issue New Loan
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Total Outstanding</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</div>
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
            <div className="text-sm text-gray-600">Active Loans</div>
            <div className="text-2xl font-bold">
              {filteredLoans.filter((l) => l.status === 'active').length}
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4">
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as 'all' | 'active' | 'paid' | 'cancelled')
            }
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Loans</option>
            <option value="active">Active Loans</option>
            <option value="paid">Paid Loans</option>
            <option value="cancelled">Cancelled Loans</option>
          </select>
        </div>
      </Card>

      {/* Loans Table */}
      <Card>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Loans ({filteredLoans.length})</h2>

          {filteredLoans.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No loans found</div>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Loan Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Installments
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLoans.map((loan) => {
                    const employee = employeeMap.get(loan.employeeId);
                    return (
                      <tr key={loan.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium">{employee?.name || 'Unknown'}</div>
                          {loan.reason && (
                            <div className="text-xs text-gray-500">{loan.reason}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(new Date(loan.issueDate))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {formatCurrency(loan.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div>
                            {loan.paidInstallments}/{loan.totalInstallments}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(loan.installmentAmount)}/month
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                          {formatCurrency(loan.remainingAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant={
                              loan.status === 'active'
                                ? 'warning'
                                : loan.status === 'paid'
                                ? 'success'
                                : 'default'
                            }
                          >
                            {loan.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex justify-end space-x-2">
                            {loan.status === 'active' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => openPaymentModal(loan)}
                                  leftIcon={<BanknotesIcon className="w-4 h-4" />}
                                >
                                  Record Payment
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => handleCancelLoan(loan)}
                                  leftIcon={<XMarkIcon className="w-4 h-4" />}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
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

      {/* Issue Loan Modal */}
      <Modal
        isOpen={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        title="Issue New Loan"
        size="lg"
      >
        <form onSubmit={loanForm.handleSubmit(onSubmitLoan)} className="space-y-4">
          <Select
            label="Employee"
            {...loanForm.register('employeeId')}
            error={loanForm.formState.errors.employeeId?.message}
          >
            <option value="">Select Employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} - {emp.designation}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Loan Amount (Rs)"
              type="number"
              step="1"
              {...loanForm.register('amount', { valueAsNumber: true })}
              error={loanForm.formState.errors.amount?.message}
            />

            <Input
              label="Total Installments"
              type="number"
              step="1"
              {...loanForm.register('totalInstallments', { valueAsNumber: true })}
              error={loanForm.formState.errors.totalInstallments?.message}
            />

            <Input
              label="Issue Date"
              type="date"
              {...loanForm.register('issueDate')}
              error={loanForm.formState.errors.issueDate?.message}
            />

            <Input
              label="Reason (Optional)"
              placeholder="e.g., Medical emergency, Education"
              {...loanForm.register('reason')}
              error={loanForm.formState.errors.reason?.message}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              {...loanForm.register('notes')}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes about this loan..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsLoanModalOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              Issue Loan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Loan Payment"
        size="md"
      >
        {selectedLoan && (
          <form onSubmit={paymentForm.handleSubmit(onSubmitPayment)} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Employee:</span>
                <span className="font-medium">
                  {employeeMap.get(selectedLoan.employeeId)?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Remaining Amount:</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(selectedLoan.remainingAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Installment Amount:</span>
                <span className="font-medium">
                  {formatCurrency(selectedLoan.installmentAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Progress:</span>
                <span>
                  {selectedLoan.paidInstallments}/{selectedLoan.totalInstallments} paid
                </span>
              </div>
            </div>

            <Input
              label="Payment Amount (Rs)"
              type="number"
              step="0.01"
              {...paymentForm.register('paymentAmount', { valueAsNumber: true })}
              error={paymentForm.formState.errors.paymentAmount?.message}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsPaymentModalOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isLoading}>
                Record Payment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
