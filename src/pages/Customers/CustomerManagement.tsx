import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  getAllCustomers,
  getCustomerOrderHistory,
} from '@/services/customerService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { phoneSchema, formatCurrency, formatDateTime } from '@/utils/validation';
import type { Customer, Order } from '@/db/types';

const customerSchema = z.object({
  phone: phoneSchema,
  name: z.string().min(1, 'Name is required'),
  address: z.string().nullable(),
  notes: z.string().nullable(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export const CustomerManagement: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      phone: '',
      name: '',
      address: null,
      notes: null,
    },
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      handleSearch();
    } else {
      loadCustomers();
    }
  }, [searchTerm]);

  const loadCustomers = async () => {
    const allCustomers = await getAllCustomers();
    setCustomers(allCustomers);
  };

  const handleSearch = async () => {
    if (!searchTerm) {
      await loadCustomers();
      return;
    }
    const results = await searchCustomers(searchTerm);
    setCustomers(results);
  };

  const onSubmit = async (data: CustomerFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, data, currentUser.id);
      } else {
        await createCustomer(data, currentUser.id);
      }
      await loadCustomers();
      closeModal();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save customer', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    reset({
      phone: customer.phone,
      name: customer.name,
      address: customer.address,
      notes: customer.notes,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;

    const confirmed = await dialog.confirm({
      title: 'Delete Customer',
      message: 'Are you sure you want to delete this customer?',
      variant: 'danger',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await deleteCustomer(id, currentUser.id);
      await loadCustomers();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to delete customer', 'Error');
    }
  };

  const handleViewHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    const history = await getCustomerOrderHistory(customer.id);
    setOrderHistory(history);
    setIsHistoryModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    reset({
      phone: '',
      name: '',
      address: null,
      notes: null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
        <Button
          onClick={() => setIsModalOpen(true)}
          leftIcon={<PlusIcon className="w-5 h-5" />}
        >
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <Card padding="md">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or address..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((customer) => (
          <Card key={customer.id} padding="md" hoverable>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-lg mb-1">
                  {customer.name}
                </h3>
                <p className="text-sm text-gray-600 mb-1">{customer.phone}</p>
                {customer.address && (
                  <p className="text-sm text-gray-500 line-clamp-2">{customer.address}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{customer.totalOrders}</span> orders
                {customer.lastOrderAt && (
                  <span className="block text-xs mt-1">
                    Last: {formatDateTime(customer.lastOrderAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleViewHistory(customer)}
                >
                  History
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(customer)}
                >
                  <PencilIcon className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(customer.id)}
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {customers.length === 0 && (
        <Card padding="lg">
          <div className="text-center text-gray-500 py-12">
            <p>
              {searchTerm
                ? 'No customers found matching your search'
                : 'No customers yet. Add your first customer.'}
            </p>
          </div>
        </Card>
      )}

      {/* Add/Edit Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Phone Number"
            placeholder="03001234567"
            maxLength={13}
            error={errors.phone?.message}
            helperText="11 digits, starts with 03"
            {...register('phone')}
          />

          <Input
            label="Customer Name"
            error={errors.name?.message}
            {...register('name')}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address (Optional)
            </label>
            <textarea
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Delivery address..."
              {...register('address')}
            />
            {errors.address && (
              <p className="mt-1 text-sm text-danger-600">{errors.address.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={2}
              placeholder="Any special notes..."
              {...register('notes')}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingCustomer ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Order History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Order History - ${selectedCustomer?.name}`}
        size="lg"
      >
        <div className="space-y-3">
          {orderHistory.map((order) => (
            <div
              key={order.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-gray-900">{order.orderNumber}</span>
                  <span className="text-sm text-gray-600 ml-3">
                    {formatDateTime(order.createdAt)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      order.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'open'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {order.status.toUpperCase()}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      order.isPaid
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {order.isPaid ? 'PAID' : 'UNPAID'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Type: {order.orderType.replace('_', ' ').toUpperCase()}
                </span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(order.total)}
                </span>
              </div>
              {order.notes && (
                <p className="text-sm text-gray-500 mt-2 italic">{order.notes}</p>
              )}
            </div>
          ))}

          {orderHistory.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p>No orders yet for this customer</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => setIsHistoryModalOpen(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
};
