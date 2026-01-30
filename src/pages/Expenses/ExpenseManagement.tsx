import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input, Select } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import {
  createExpense,
  updateExpense,
  deleteExpense,
  getAllExpenses,
  getExpenseCategories,
  searchExpenses,
  type DateRange,
} from '@/services/expenseService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { formatCurrency, formatDate } from '@/utils/validation';
import type { Expense } from '@/db/types';

const expenseSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  category: z.string().min(1, 'Category is required'),
  amount: z.number().min(0.01, 'Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  receiptNumber: z.string().optional(),
  paidTo: z.string().optional(),
  paymentMethod: z.enum(['cash', 'card', 'online', 'other']),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

export const ExpenseManagement: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'this_month'>('this_month');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      category: '',
      amount: 0,
      description: '',
      receiptNumber: '',
      paidTo: '',
      paymentMethod: 'cash',
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterExpenses();
  }, [expenses, searchQuery, filterCategory, dateRange]);

  const loadData = async () => {
    const [expenseData, categoryData] = await Promise.all([
      getAllExpenses(),
      getExpenseCategories(),
    ]);
    setExpenses(expenseData);
    setCategories(categoryData);
  };

  const getDateRangeFilter = (): DateRange | null => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case 'this_month':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      default:
        return null;
    }
  };

  const filterExpenses = async () => {
    let filtered = expenses;

    // Filter by date range
    const range = getDateRangeFilter();
    if (range) {
      filtered = filtered.filter((expense) => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= range.startDate && expenseDate <= range.endDate;
      });
    }

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter((expense) => expense.category === filterCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const results = await searchExpenses(searchQuery);
      const resultIds = new Set(results.map((r) => r.id));
      filtered = filtered.filter((expense) => resultIds.has(expense.id));
    }

    setFilteredExpenses(filtered);
  };

  const openModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      form.reset({
        date: new Date(expense.date).toISOString().split('T')[0],
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        receiptNumber: expense.receiptNumber || '',
        paidTo: expense.paidTo || '',
        paymentMethod: expense.paymentMethod,
      });
    } else {
      setEditingExpense(null);
      form.reset({
        date: new Date().toISOString().split('T')[0],
        category: '',
        amount: 0,
        description: '',
        receiptNumber: '',
        paidTo: '',
        paymentMethod: 'cash',
      });
    }
    setIsModalOpen(true);
  };

  const onSubmit = async (data: ExpenseFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      if (editingExpense) {
        await updateExpense(
          editingExpense.id,
          {
            ...data,
            date: new Date(data.date),
          },
          currentUser.id
        );
        await dialog.alert('Expense updated successfully', 'Success');
      } else {
        await createExpense(
          {
            ...data,
            date: new Date(data.date),
          },
          currentUser.id
        );
        await dialog.alert('Expense created successfully', 'Success');
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      await dialog.alert(
        error instanceof Error ? error.message : 'Failed to save expense',
        'Error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (!currentUser) return;

    const confirmed = await dialog.confirm({
      title: 'Delete Expense',
      message: `Are you sure you want to delete this expense of ${formatCurrency(expense.amount)}?`,
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await deleteExpense(expense.id, currentUser.id);
      await dialog.alert('Expense deleted successfully', 'Success');
      await loadData();
    } catch (error) {
      await dialog.alert(
        error instanceof Error ? error.message : 'Failed to delete expense',
        'Error'
      );
    }
  };

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Expense Management</h1>
          <p className="text-gray-600">Track and manage daily expenses</p>
        </div>
        <Button onClick={() => openModal()} leftIcon={<PlusIcon className="w-5 h-5" />}>
          Add Expense
        </Button>
      </div>

      {/* Summary Card */}
      <Card>
        <div className="p-4">
          <div className="text-sm text-gray-600">Total Expenses ({dateRange.replace('_', ' ')})</div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
          <div className="text-sm text-gray-500 mt-1">{filteredExpenses.length} transactions</div>
        </div>
      </Card>

      {/* Filters */}
      <Card>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by description, category, receipt..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as 'all' | 'today' | 'this_month')}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="this_month">This Month</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Expenses ({filteredExpenses.length})</h2>

          {filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No expenses found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Paid To
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(new Date(expense.date))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 rounded text-xs bg-gray-100">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium">{expense.description}</div>
                        {expense.receiptNumber && (
                          <div className="text-xs text-gray-500">
                            Receipt: {expense.receiptNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {expense.paymentMethod.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {expense.paidTo || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openModal(expense)}
                            leftIcon={<PencilIcon className="w-4 h-4" />}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(expense)}
                            leftIcon={<TrashIcon className="w-4 h-4" />}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? 'Edit Expense' : 'Add New Expense'}
        size="lg"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              {...form.register('date')}
              error={form.formState.errors.date?.message}
            />

            <Select
              label="Category"
              {...form.register('category')}
              error={form.formState.errors.category?.message}
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>

            <Input
              label="Amount (Rs)"
              type="number"
              step="0.01"
              {...form.register('amount', { valueAsNumber: true })}
              error={form.formState.errors.amount?.message}
            />

            <Select
              label="Payment Method"
              {...form.register('paymentMethod')}
              error={form.formState.errors.paymentMethod?.message}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </Select>

            <Input
              label="Paid To (Optional)"
              placeholder="Vendor name"
              {...form.register('paidTo')}
              error={form.formState.errors.paidTo?.message}
            />

            <Input
              label="Receipt Number (Optional)"
              placeholder="e.g., INV-12345"
              {...form.register('receiptNumber')}
              error={form.formState.errors.receiptNumber?.message}
            />
          </div>

          <Input
            label="Description"
            placeholder="Brief description of the expense"
            {...form.register('description')}
            error={form.formState.errors.description?.message}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              {editingExpense ? 'Update Expense' : 'Create Expense'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
