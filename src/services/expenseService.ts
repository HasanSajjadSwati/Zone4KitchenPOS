import { db } from '@/db';
import type { Expense } from '@/db/types';
import { logAudit } from '@/utils/audit';
import { createId } from '@/utils/uuid';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface CreateExpenseParams {
  date: Date;
  category: string;
  amount: number;
  description: string;
  receiptNumber?: string;
  paidTo?: string;
  paymentMethod: 'cash' | 'card' | 'online' | 'other';
  registerSessionId?: string;
}

export async function createExpense(data: CreateExpenseParams, userId: string): Promise<Expense> {
  const expense: Expense = {
    id: createId(),
    date: data.date,
    category: data.category,
    amount: data.amount,
    description: data.description,
    receiptNumber: data.receiptNumber || null,
    paidTo: data.paidTo || null,
    paymentMethod: data.paymentMethod,
    registerSessionId: data.registerSessionId || null,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.expenses.add(expense);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'expenses',
    recordId: expense.id,
    description: `Created expense: ${expense.description} - ${expense.amount}`,
    after: expense,
  });

  return expense;
}

interface UpdateExpenseParams {
  date?: Date;
  category?: string;
  amount?: number;
  description?: string;
  receiptNumber?: string;
  paidTo?: string;
  paymentMethod?: 'cash' | 'card' | 'online' | 'other';
  registerSessionId?: string;
}

export async function updateExpense(
  id: string,
  data: UpdateExpenseParams,
  userId: string
): Promise<void> {
  const expense = await db.expenses.get(id);
  if (!expense) throw new Error('Expense not found');

  const updates: Partial<Expense> = {
    ...data,
    updatedAt: new Date(),
  };

  await db.expenses.update(id, updates);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'expenses',
    recordId: id,
    description: `Updated expense: ${expense.description}`,
    before: expense,
    after: { ...expense, ...updates },
  });
}

export async function deleteExpense(id: string, userId: string): Promise<void> {
  const expense = await db.expenses.get(id);
  if (!expense) throw new Error('Expense not found');

  await db.expenses.delete(id);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'expenses',
    recordId: id,
    description: `Deleted expense: ${expense.description} - ${expense.amount}`,
    before: expense,
  });
}

export async function getExpensesByDateRange(range: DateRange): Promise<Expense[]> {
  const allExpenses = await db.expenses.toArray();

  return allExpenses
    .filter((expense: Expense) => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= range.startDate && expenseDate <= range.endDate;
    })
    .sort((a: Expense, b: Expense) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getExpensesByCategory(
  category: string,
  range: DateRange
): Promise<Expense[]> {
  const allExpenses = await getExpensesByDateRange(range);
  return allExpenses.filter((expense: Expense) => expense.category === category);
}

export async function getAllExpenses(): Promise<Expense[]> {
  return await db.expenses.reverse().sortBy('date');
}

export async function searchExpenses(query: string): Promise<Expense[]> {
  const allExpenses = await db.expenses.toArray();
  const lowerQuery = query.toLowerCase();

  return allExpenses.filter(
    (expense: Expense) =>
      expense.description.toLowerCase().includes(lowerQuery) ||
      expense.category.toLowerCase().includes(lowerQuery) ||
      expense.paidTo?.toLowerCase().includes(lowerQuery) ||
      expense.receiptNumber?.toLowerCase().includes(lowerQuery)
  );
}

export interface ExpenseSummary {
  totalExpenses: number;
  expenseCount: number;
  byCategory: { category: string; amount: number; count: number }[];
  byPaymentMethod: { method: string; amount: number; count: number }[];
}

export async function getExpenseSummary(range: DateRange): Promise<ExpenseSummary> {
  const expenses = await getExpensesByDateRange(range);

  const totalExpenses = expenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
  const expenseCount = expenses.length;

  // Group by category
  const categoryMap = new Map<string, { amount: number; count: number }>();
  expenses.forEach((expense: Expense) => {
    const existing = categoryMap.get(expense.category) || { amount: 0, count: 0 };
    categoryMap.set(expense.category, {
      amount: existing.amount + expense.amount,
      count: existing.count + 1,
    });
  });

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Group by payment method
  const methodMap = new Map<string, { amount: number; count: number }>();
  expenses.forEach((expense: Expense) => {
    const existing = methodMap.get(expense.paymentMethod) || { amount: 0, count: 0 };
    methodMap.set(expense.paymentMethod, {
      amount: existing.amount + expense.amount,
      count: existing.count + 1,
    });
  });

  const byPaymentMethod = Array.from(methodMap.entries()).map(([method, data]) => ({
    method,
    amount: data.amount,
    count: data.count,
  }));

  return {
    totalExpenses,
    expenseCount,
    byCategory,
    byPaymentMethod,
  };
}

export async function getExpenseCategories(): Promise<string[]> {
  const settings = await db.settings.get('default');
  return settings?.expenseCategories || [
    'Utilities',
    'Supplies',
    'Salaries',
    'Rent',
    'Maintenance',
    'Marketing',
    'Other',
  ];
}
