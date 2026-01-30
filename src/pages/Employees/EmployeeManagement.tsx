import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input, Badge } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getAllEmployees,
  searchEmployees,
} from '@/services/employeeService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { phoneSchema } from '@/utils/validation';
import { formatCurrency, formatDate } from '@/utils/validation';
import type { Employee } from '@/db/types';

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: phoneSchema,
  cnic: z.string().regex(/^[0-9]{13}$/, 'CNIC must be exactly 13 digits').optional().or(z.literal('')),
  joiningDate: z.string().min(1, 'Joining date is required'),
  designation: z.string().min(1, 'Designation is required'),
  salary: z.number().min(0, 'Salary must be positive'),
  notes: z.string().optional(),
  isActive: z.boolean(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export const EmployeeManagement: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: '',
      phone: '',
      cnic: '',
      joiningDate: new Date().toISOString().split('T')[0],
      designation: '',
      salary: 0,
      notes: '',
      isActive: true,
    },
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchQuery, filterStatus]);

  const loadEmployees = async () => {
    const data = await getAllEmployees();
    setEmployees(data);
  };

  const filterEmployees = async () => {
    let filtered = employees;

    // Filter by status
    if (filterStatus === 'active') {
      filtered = filtered.filter((e) => e.isActive);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter((e) => !e.isActive);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const results = await searchEmployees(searchQuery);
      const resultIds = new Set(results.map((r) => r.id));
      filtered = filtered.filter((e) => resultIds.has(e.id));
    }

    setFilteredEmployees(filtered);
  };

  const openModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      form.reset({
        name: employee.name,
        phone: employee.phone,
        cnic: employee.cnic || '',
        joiningDate: new Date(employee.joiningDate).toISOString().split('T')[0],
        designation: employee.designation,
        salary: employee.salary,
        notes: employee.notes || '',
        isActive: employee.isActive,
      });
    } else {
      setEditingEmployee(null);
      form.reset({
        name: '',
        phone: '',
        cnic: '',
        joiningDate: new Date().toISOString().split('T')[0],
        designation: '',
        salary: 0,
        notes: '',
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const onSubmit = async (data: EmployeeFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      if (editingEmployee) {
        await updateEmployee(
          editingEmployee.id,
          {
            ...data,
            joiningDate: new Date(data.joiningDate),
          },
          currentUser.id
        );
        await dialog.alert('Employee updated successfully', 'Success');
      } else {
        await createEmployee(
          {
            ...data,
            joiningDate: new Date(data.joiningDate),
          },
          currentUser.id
        );
        await dialog.alert('Employee created successfully', 'Success');
      }

      setIsModalOpen(false);
      await loadEmployees();
    } catch (error) {
      await dialog.alert(
        error instanceof Error ? error.message : 'Failed to save employee',
        'Error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (employee: Employee) => {
    if (!currentUser) return;

    const confirmed = await dialog.confirm({
      title: 'Delete Employee',
      message: `Are you sure you want to delete ${employee.name}? This action cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await deleteEmployee(employee.id, currentUser.id);
      await dialog.alert('Employee deleted successfully', 'Success');
      await loadEmployees();
    } catch (error) {
      await dialog.alert(
        error instanceof Error ? error.message : 'Failed to delete employee',
        'Error'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Employee Management</h1>
          <p className="text-gray-600">Manage your restaurant employees</p>
        </div>
        <Button onClick={() => openModal()} leftIcon={<PlusIcon className="w-5 h-5" />}>
          Add Employee
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone, CNIC, or designation..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Employees</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Employees Table */}
      <Card>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">
            Employees ({filteredEmployees.length})
          </h2>

          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No employees found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      CNIC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Designation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Salary
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Joining Date
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
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">{employee.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {employee.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {employee.cnic || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {employee.designation}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {formatCurrency(employee.salary)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(new Date(employee.joiningDate))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={employee.isActive ? 'success' : 'default'}>
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openModal(employee)}
                            leftIcon={<PencilIcon className="w-4 h-4" />}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(employee)}
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
        title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
        size="lg"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              {...form.register('name')}
              error={form.formState.errors.name?.message}
            />

            <Input
              label="Phone Number (11 digits)"
              placeholder="03XXXXXXXXX"
              {...form.register('phone')}
              error={form.formState.errors.phone?.message}
            />

            <Input
              label="CNIC (13 digits, Optional)"
              placeholder="XXXXXXXXXXXXX"
              {...form.register('cnic')}
              error={form.formState.errors.cnic?.message}
            />

            <Input
              label="Designation"
              placeholder="e.g., Chef, Cashier, Server"
              {...form.register('designation')}
              error={form.formState.errors.designation?.message}
            />

            <Input
              label="Joining Date"
              type="date"
              {...form.register('joiningDate')}
              error={form.formState.errors.joiningDate?.message}
            />

            <Input
              label="Monthly Salary (Rs)"
              type="number"
              step="1"
              {...form.register('salary', { valueAsNumber: true })}
              error={form.formState.errors.salary?.message}
            />
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                {...form.register('isActive')}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">Active Employee</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              {...form.register('notes')}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes about the employee..."
            />
          </div>

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
              {editingEmployee ? 'Update Employee' : 'Create Employee'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
