import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  employees: {
    get: vi.fn(),
    delete: vi.fn(),
    toArray: vi.fn(),
    toArrayWithDeleted: vi.fn(),
  },
  employeeLoans: {
    toArray: vi.fn(),
    where: vi.fn(),
  },
}));

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@/utils/audit', () => ({ logAudit: vi.fn() }));

import { deleteEmployee, getEmployeeLoanSummaries } from './employeeService';

beforeEach(() => vi.clearAllMocks());

describe('deleteEmployee', () => {
  it('leaves the loan rule to the server: an employee with paid-off loans is sent for deletion', async () => {
    dbMock.employees.get.mockResolvedValue({ id: 'e1', name: 'Ali' });
    dbMock.employeeLoans.where.mockReturnValue({
      equals: () => ({ toArray: async () => [{ id: 'l1', employeeId: 'e1', status: 'paid' }] }),
    });
    dbMock.employees.delete.mockResolvedValue(undefined);

    await deleteEmployee('e1', 'u1');

    expect(dbMock.employees.delete).toHaveBeenCalledWith('e1');
  });
});

describe('getEmployeeLoanSummaries', () => {
  it('keeps the loan history of an employee who is in the Recycle Bin', async () => {
    dbMock.employees.toArray.mockResolvedValue([]);
    dbMock.employees.toArrayWithDeleted.mockResolvedValue([{ id: 'e1', name: 'Ali', deletedAt: '2026-11-01' }]);
    dbMock.employeeLoans.toArray.mockResolvedValue([
      { id: 'l1', employeeId: 'e1', amount: 1000, remainingAmount: 0, status: 'paid' },
    ]);

    const summaries = await getEmployeeLoanSummaries();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ employeeId: 'e1', employeeName: 'Ali', totalAmount: 1000 });
  });
});
