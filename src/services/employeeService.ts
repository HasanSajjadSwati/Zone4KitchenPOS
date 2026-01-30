import { db } from '@/db';
import type { Employee, EmployeeLoan } from '@/db/types';
import { logAudit } from '@/utils/audit';
import { createId } from '@/utils/uuid';

// Employee CRUD Operations

interface CreateEmployeeParams {
  name: string;
  phone: string;
  cnic?: string;
  joiningDate: Date;
  designation: string;
  salary: number;
  notes?: string;
  isActive?: boolean;
}

export async function createEmployee(data: CreateEmployeeParams, userId: string): Promise<Employee> {
  const employee: Employee = {
    id: createId(),
    name: data.name,
    phone: data.phone,
    cnic: data.cnic || null,
    joiningDate: data.joiningDate,
    designation: data.designation,
    salary: data.salary,
    isActive: data.isActive !== undefined ? data.isActive : true,
    notes: data.notes || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.employees.add(employee);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'employees',
    recordId: employee.id,
    description: `Created employee: ${employee.name}`,
    after: employee,
  });

  return employee;
}

interface UpdateEmployeeParams {
  name?: string;
  phone?: string;
  cnic?: string;
  joiningDate?: Date;
  designation?: string;
  salary?: number;
  notes?: string;
  isActive?: boolean;
}

export async function updateEmployee(
  id: string,
  data: UpdateEmployeeParams,
  userId: string
): Promise<void> {
  const employee = await db.employees.get(id);
  if (!employee) throw new Error('Employee not found');

  const updates: Partial<Employee> = {
    ...data,
    updatedAt: new Date(),
  };

  await db.employees.update(id, updates);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'employees',
    recordId: id,
    description: `Updated employee: ${employee.name}`,
    before: employee,
    after: { ...employee, ...updates },
  });
}

export async function deleteEmployee(id: string, userId: string): Promise<void> {
  const employee = await db.employees.get(id);
  if (!employee) throw new Error('Employee not found');

  // Check if employee has any loans
  const loans = await db.employeeLoans.where('employeeId').equals(id).toArray();
  const activeLoans = loans.filter((l: EmployeeLoan) => l.status === 'active');

  if (activeLoans.length > 0) {
    throw new Error('Cannot delete employee with active loans. Please settle or cancel loans first.');
  }

  await db.employees.delete(id);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'employees',
    recordId: id,
    description: `Deleted employee: ${employee.name}`,
    before: employee,
  });
}

export async function getAllEmployees(): Promise<Employee[]> {
  return await db.employees.orderBy('name').toArray();
}

export async function getActiveEmployees(): Promise<Employee[]> {
  return await db.employees.where('isActive').equals(true).sortBy('name');
}

export async function searchEmployees(query: string): Promise<Employee[]> {
  const allEmployees = await db.employees.toArray();
  const lowerQuery = query.toLowerCase();

  return allEmployees.filter(
    (employee: Employee) =>
      employee.name.toLowerCase().includes(lowerQuery) ||
      employee.phone.includes(query) ||
      (employee.cnic && employee.cnic.includes(query)) ||
      employee.designation.toLowerCase().includes(lowerQuery)
  );
}

export async function getEmployeeById(id: string): Promise<Employee | undefined> {
  return await db.employees.get(id);
}

// Employee Loan Operations

interface CreateEmployeeLoanParams {
  employeeId: string;
  amount: number;
  issueDate: Date;
  reason?: string;
  totalInstallments: number;
  notes?: string;
}

export async function createEmployeeLoan(
  data: CreateEmployeeLoanParams,
  userId: string
): Promise<EmployeeLoan> {
  const employee = await db.employees.get(data.employeeId);
  if (!employee) throw new Error('Employee not found');

  const installmentAmount = data.amount / data.totalInstallments;

  const loan: EmployeeLoan = {
    id: createId(),
    employeeId: data.employeeId,
    amount: data.amount,
    issueDate: data.issueDate,
    reason: data.reason || null,
    totalInstallments: data.totalInstallments,
    installmentAmount,
    paidInstallments: 0,
    remainingAmount: data.amount,
    status: 'active',
    issuedBy: userId,
    notes: data.notes || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.employeeLoans.add(loan);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'employeeLoans',
    recordId: loan.id,
    description: `Created loan of Rs ${data.amount} for ${employee.name}`,
    after: loan,
  });

  return loan;
}

export async function recordLoanPayment(
  loanId: string,
  paymentAmount: number,
  userId: string
): Promise<void> {
  const loan = await db.employeeLoans.get(loanId);
  if (!loan) throw new Error('Loan not found');

  if (loan.status !== 'active') {
    throw new Error('Cannot record payment for inactive loan');
  }

  const newRemainingAmount = Math.max(0, loan.remainingAmount - paymentAmount);
  const installmentsPaid = Math.floor((loan.amount - newRemainingAmount) / loan.installmentAmount);
  const newStatus = newRemainingAmount === 0 ? 'paid' : 'active';

  await db.employeeLoans.update(loanId, {
    paidInstallments: installmentsPaid,
    remainingAmount: newRemainingAmount,
    status: newStatus,
    updatedAt: new Date(),
  });

  const employee = await db.employees.get(loan.employeeId);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'employeeLoans',
    recordId: loanId,
    description: `Recorded payment of Rs ${paymentAmount} for ${employee?.name || 'employee'} (${installmentsPaid}/${loan.totalInstallments} installments)`,
    before: loan,
  });
}

export async function cancelLoan(loanId: string, userId: string): Promise<void> {
  const loan = await db.employeeLoans.get(loanId);
  if (!loan) throw new Error('Loan not found');

  await db.employeeLoans.update(loanId, {
    status: 'cancelled',
    updatedAt: new Date(),
  });

  const employee = await db.employees.get(loan.employeeId);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'employeeLoans',
    recordId: loanId,
    description: `Cancelled loan for ${employee?.name || 'employee'}`,
    before: loan,
  });
}

export async function getEmployeeLoans(employeeId: string): Promise<EmployeeLoan[]> {
  return await db.employeeLoans.where('employeeId').equals(employeeId).reverse().sortBy('issueDate');
}

export async function getAllLoans(): Promise<EmployeeLoan[]> {
  return await db.employeeLoans.reverse().sortBy('issueDate');
}

export async function getOutstandingLoans(): Promise<EmployeeLoan[]> {
  return await db.employeeLoans.where('status').equals('active').reverse().sortBy('issueDate');
}

export async function getLoanById(id: string): Promise<EmployeeLoan | undefined> {
  return await db.employeeLoans.get(id);
}

// Report helper functions
export interface EmployeeLoanSummary {
  employeeId: string;
  employeeName: string;
  totalLoans: number;
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
  activeLoans: number;
}

export async function getEmployeeLoanSummaries(): Promise<EmployeeLoanSummary[]> {
  const employees = (await db.employees.toArray()) as Employee[];
  const loans = (await db.employeeLoans.toArray()) as EmployeeLoan[];

  const summaries: EmployeeLoanSummary[] = [];

  for (const employee of employees) {
    const employeeLoans = loans.filter((l: EmployeeLoan) => l.employeeId === employee.id);

    if (employeeLoans.length === 0) continue;

    const totalAmount = employeeLoans.reduce((sum: number, l: EmployeeLoan) => sum + l.amount, 0);
    const totalRemaining = employeeLoans.reduce((sum: number, l: EmployeeLoan) => sum + l.remainingAmount, 0);
    const totalPaid = totalAmount - totalRemaining;
    const activeLoans = employeeLoans.filter((l: EmployeeLoan) => l.status === 'active').length;

    summaries.push({
      employeeId: employee.id,
      employeeName: employee.name,
      totalLoans: employeeLoans.length,
      totalAmount,
      totalPaid,
      totalRemaining,
      activeLoans,
    });
  }

  return summaries.sort((a, b) => b.totalRemaining - a.totalRemaining);
}
