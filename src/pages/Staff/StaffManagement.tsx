import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, UserIcon, TruckIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input, Badge } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createWaiter,
  updateWaiter,
  deleteWaiter,
  getAllWaiters,
  createRider,
  updateRider,
  deleteRider,
  getAllRiders,
  createTable,
  updateTable,
  deleteTable,
  getAllTables,
} from '@/services/staffService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { phoneSchema } from '@/utils/validation';
import type { Waiter, Rider, TableRecord } from '@/db/types';

const waiterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: phoneSchema,
  isActive: z.boolean(),
});

const riderSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: phoneSchema,
  isActive: z.boolean(),
});

const tableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required'),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  isActive: z.boolean(),
});

type WaiterFormData = z.infer<typeof waiterSchema>;
type RiderFormData = z.infer<typeof riderSchema>;
type TableFormData = z.infer<typeof tableSchema>;

type TabType = 'waiters' | 'riders' | 'tables';

export const StaffManagement: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<TabType>('waiters');

  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [tables, setTables] = useState<TableRecord[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const waiterForm = useForm<WaiterFormData>({
    resolver: zodResolver(waiterSchema),
    defaultValues: { name: '', phone: '', isActive: true },
  });

  const riderForm = useForm<RiderFormData>({
    resolver: zodResolver(riderSchema),
    defaultValues: { name: '', phone: '', isActive: true },
  });

  const tableForm = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: { tableNumber: '', capacity: 4, isActive: true },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [w, r, t] = await Promise.all([
      getAllWaiters(),
      getAllRiders(),
      getAllTables(),
    ]);
    setWaiters(w);
    setRiders(r);
    setTables(t);
  };

  const onSubmitWaiter = async (data: WaiterFormData) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      if (editingItem) {
        await updateWaiter(editingItem.id, data, currentUser.id);
      } else {
        await createWaiter(data, currentUser.id);
      }
      await loadData();
      closeModal();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save waiter', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitRider = async (data: RiderFormData) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      if (editingItem) {
        await updateRider(editingItem.id, data, currentUser.id);
      } else {
        await createRider(data, currentUser.id);
      }
      await loadData();
      closeModal();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save rider', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitTable = async (data: TableFormData) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      if (editingItem) {
        await updateTable(editingItem.id, data, currentUser.id);
      } else {
        await createTable(data, currentUser.id);
      }
      await loadData();
      closeModal();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save table', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (item: any, type: TabType) => {
    setEditingItem(item);
    if (type === 'waiters') {
      waiterForm.reset(item);
    } else if (type === 'riders') {
      riderForm.reset(item);
    } else {
      tableForm.reset(item);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, type: TabType) => {
    if (!currentUser) return;

    const confirmed = await dialog.confirm({
      title: `Delete ${type.slice(0, -1)}`,
      message: `Are you sure you want to delete this ${type.slice(0, -1)}?`,
      variant: 'danger',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      if (type === 'waiters') await deleteWaiter(id, currentUser.id);
      else if (type === 'riders') await deleteRider(id, currentUser.id);
      else await deleteTable(id, currentUser.id);
      await loadData();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to delete', 'Error');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    waiterForm.reset({ name: '', phone: '', isActive: true });
    riderForm.reset({ name: '', phone: '', isActive: true });
    tableForm.reset({ tableNumber: '', capacity: 4, isActive: true });
  };

  const getCurrentSubmit = () => {
    if (activeTab === 'waiters') return waiterForm.handleSubmit(onSubmitWaiter);
    if (activeTab === 'riders') return riderForm.handleSubmit(onSubmitRider);
    return tableForm.handleSubmit(onSubmitTable);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
        <Button
          onClick={() => setIsModalOpen(true)}
          leftIcon={<PlusIcon className="w-5 h-5" />}
        >
          Add {activeTab === 'waiters' ? 'Waiter' : activeTab === 'riders' ? 'Rider' : 'Table'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('waiters')}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition ${
            activeTab === 'waiters'
              ? 'bg-white text-primary-600 shadow'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span>Waiters ({waiters.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('riders')}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition ${
            activeTab === 'riders'
              ? 'bg-white text-primary-600 shadow'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TruckIcon className="w-5 h-5" />
          <span>Riders ({riders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('tables')}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition ${
            activeTab === 'tables'
              ? 'bg-white text-primary-600 shadow'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TableCellsIcon className="w-5 h-5" />
          <span>Tables ({tables.length})</span>
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeTab === 'waiters' &&
          waiters.map((waiter) => (
            <Card key={waiter.id} padding="md">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{waiter.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{waiter.phone}</p>
                </div>
                <Badge variant={waiter.isActive ? 'success' : 'default'}>
                  {waiter.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(waiter, 'waiters')}
                  leftIcon={<PencilIcon className="w-4 h-4" />}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(waiter.id, 'waiters')}
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}

        {activeTab === 'riders' &&
          riders.map((rider) => (
            <Card key={rider.id} padding="md">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{rider.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{rider.phone}</p>
                </div>
                <Badge variant={rider.isActive ? 'success' : 'default'}>
                  {rider.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(rider, 'riders')}
                  leftIcon={<PencilIcon className="w-4 h-4" />}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(rider.id, 'riders')}
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}

        {activeTab === 'tables' &&
          tables.map((table) => (
            <Card key={table.id} padding="md">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">
                    Table {table.tableNumber}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Capacity: {table.capacity} people
                  </p>
                </div>
                <Badge variant={table.isActive ? 'success' : 'default'}>
                  {table.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(table, 'tables')}
                  leftIcon={<PencilIcon className="w-4 h-4" />}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(table.id, 'tables')}
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={`${editingItem ? 'Edit' : 'Add'} ${
          activeTab === 'waiters' ? 'Waiter' : activeTab === 'riders' ? 'Rider' : 'Table'
        }`}
        size="md"
      >
        <form onSubmit={getCurrentSubmit()} className="space-y-4">
          {activeTab === 'waiters' && (
            <>
              <Input
                label="Waiter Name"
                error={waiterForm.formState.errors.name?.message}
                {...waiterForm.register('name')}
              />
              <Input
                label="Phone Number"
                placeholder="03001234567"
                error={waiterForm.formState.errors.phone?.message}
                helperText="11 digits, starts with 03"
                {...waiterForm.register('phone')}
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="waiterActive"
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                  {...waiterForm.register('isActive')}
                />
                <label htmlFor="waiterActive" className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
            </>
          )}

          {activeTab === 'riders' && (
            <>
              <Input
                label="Rider Name"
                error={riderForm.formState.errors.name?.message}
                {...riderForm.register('name')}
              />
              <Input
                label="Phone Number"
                placeholder="03001234567"
                error={riderForm.formState.errors.phone?.message}
                helperText="11 digits, starts with 03"
                {...riderForm.register('phone')}
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="riderActive"
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                  {...riderForm.register('isActive')}
                />
                <label htmlFor="riderActive" className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
            </>
          )}

          {activeTab === 'tables' && (
            <>
              <Input
                label="Table Number"
                placeholder="T1, A5, etc."
                error={tableForm.formState.errors.tableNumber?.message}
                {...tableForm.register('tableNumber')}
              />
              <Input
                label="Capacity"
                type="number"
                min="1"
                error={tableForm.formState.errors.capacity?.message}
                helperText="Maximum number of people"
                {...tableForm.register('capacity', { valueAsNumber: true })}
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="tableActive"
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                  {...tableForm.register('isActive')}
                />
                <label htmlFor="tableActive" className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
