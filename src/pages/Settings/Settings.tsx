import React, { useEffect, useState } from 'react';
import {
  BuildingStorefrontIcon,
  PrinterIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import { PermissionManagement } from './PermissionManagement';
import { Button, Card, Input, Modal, Select } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getSettings, updateSettings, getAllUsers, getAuditLogs, getAllRoles } from '@/services/settingsService';
import { createUser, updateUser, deleteUser, resetUserPassword } from '@/services/userService';
import { getMigrationPreview, migrateOrdersToPast } from '@/services/pastOrderService';
import type { MigrationPreview } from '@/services/pastOrderService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { formatDateTime, phoneSchema } from '@/utils/validation';
import type { User, AuditLog, Role } from '@/db/types';

const businessInfoSchema = z.object({
  restaurantName: z.string().min(1, 'Restaurant name is required'),
  restaurantAddress: z.string(),
  restaurantPhone: phoneSchema,
  taxRate: z.number().min(0).max(100),
  receiptFooter: z.string().nullable(),
  dayCountByRegister: z.boolean(),
});

const kotSettingsSchema = z.object({
  kotSplitByMajorCategory: z.boolean(),
  kotIncludeVariants: z.boolean(),
  kotIncludeDealBreakdown: z.boolean(),
  printAllIncludeKOT: z.boolean(),
  printAllIncludeCustomer: z.boolean(),
  printAllIncludeCounter: z.boolean(),
  printAllIncludeRider: z.boolean(),
});

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(4, 'Password must be at least 4 characters').optional(),
  fullName: z.string().min(1, 'Full name is required'),
  roleId: z.string().min(1, 'Role is required'),
  isActive: z.boolean(),
});

type BusinessInfoFormData = z.infer<typeof businessInfoSchema>;
type KOTSettingsFormData = z.infer<typeof kotSettingsSchema>;
type UserFormData = z.infer<typeof userSchema>;
type TabType = 'business' | 'kot' | 'users' | 'permissions' | 'audit' | 'data';

export const Settings: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentRole = useAuthStore((state) => state.currentRole);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<TabType>('business');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [migrationDays, setMigrationDays] = useState(7);
  const [migrationPreview, setMigrationPreview] = useState<MigrationPreview | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const businessForm = useForm<BusinessInfoFormData>({
    resolver: zodResolver(businessInfoSchema),
  });

  const kotForm = useForm<KOTSettingsFormData>({
    resolver: zodResolver(kotSettingsSchema),
  });

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      isActive: true,
      roleId: '',
    },
  });

  const loadData = async () => {
    const currentSettings = await getSettings();
    if (currentSettings) {
      // Update forms
      businessForm.reset({
        restaurantName: currentSettings.restaurantName,
        restaurantAddress: currentSettings.restaurantAddress,
        restaurantPhone: currentSettings.restaurantPhone,
        taxRate: currentSettings.taxRate,
        receiptFooter: currentSettings.receiptFooter,
        dayCountByRegister: !!currentSettings.dayCountByRegister,
      });

      kotForm.reset({
        kotSplitByMajorCategory: currentSettings.kotSplitByMajorCategory,
        kotIncludeVariants: currentSettings.kotIncludeVariants,
        kotIncludeDealBreakdown: currentSettings.kotIncludeDealBreakdown,
        printAllIncludeKOT: currentSettings.printAllIncludeKOT ?? true,
        printAllIncludeCustomer: currentSettings.printAllIncludeCustomer ?? true,
        printAllIncludeCounter: currentSettings.printAllIncludeCounter ?? false,
        printAllIncludeRider: currentSettings.printAllIncludeRider ?? false,
      });
    }

    if (activeTab === 'users' && canViewUsers) {
      const [allUsers, allRoles] = await Promise.all([getAllUsers(), getAllRoles()]);
      setUsers(allUsers);
      setRoles(allRoles);
    }

    if (activeTab === 'audit' && currentUser && canViewAudit) {
      const logs = await getAuditLogs(currentUser.id, 50);
      setAuditLogs(logs);
    }
  };

  const onSubmitBusinessInfo = async (data: BusinessInfoFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      await updateSettings(data, currentUser.id);
      await dialog.alert('Business information updated successfully', 'Success');
      await loadData();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to update settings', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitKOTSettings = async (data: KOTSettingsFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      await updateSettings(data, currentUser.id);
      await dialog.alert('KOT settings updated successfully', 'Success');
      await loadData();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to update settings', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultRoleId = () => {
    const cashierRole = roles.find((role) => role.name.toLowerCase() === 'cashier');
    return cashierRole?.id || roles[0]?.id || '';
  };

  const isAdmin = currentRole?.name === 'Admin';
  const canViewUsers = hasPermission('users', 'read');
  const canManageUsers =
    hasPermission('users', 'create') ||
    hasPermission('users', 'update') ||
    hasPermission('users', 'delete');
  const canViewAudit = hasPermission('audit', 'read');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'users' && !canViewUsers) {
      setActiveTab('business');
    }
    if (activeTab === 'audit' && !canViewAudit) {
      setActiveTab('business');
    }
  }, [activeTab, canViewUsers, canViewAudit]);

  const getRoleLabel = (roleId: string) => {
    return roles.find((role) => role.id === roleId)?.name || roleId;
  };

  const adminRoleId = roles.find((role) => role.name.toLowerCase() === 'admin')?.id;
  const isUserAdmin = (user: User) => !!adminRoleId && user.roleId === adminRoleId;

  const handleOpenUserModal = (user?: User) => {
    if (!canManageUsers) {
      void dialog.alert('You do not have permission to manage users.', 'Access denied');
      return;
    }
    if (user) {
      setEditingUser(user);
      userForm.reset({
        username: user.username,
        fullName: user.fullName,
        roleId: user.roleId,
        isActive: user.isActive,
        password: undefined, // Don't show password
      });
    } else {
      setEditingUser(null);
      userForm.reset({
        username: '',
        fullName: '',
        roleId: getDefaultRoleId(),
        isActive: true,
        password: '',
      });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (data: UserFormData) => {
    if (!currentUser) return;
    if (!canManageUsers) {
      await dialog.alert('You do not have permission to manage users.', 'Access denied');
      return;
    }

    setIsLoading(true);
    try {
      if (editingUser) {
        if (data.password && !isAdmin) {
          await dialog.alert('Only admins can reset passwords. Password will not be changed.', 'Error');
          data.password = undefined;
        }

        // Update existing user
        await updateUser({
          id: editingUser.id,
          fullName: data.fullName,
          roleId: data.roleId,
          isActive: data.isActive,
          updatedBy: currentUser.id,
        });

        if (data.password) {
          await resetUserPassword(editingUser.id, data.password, currentUser.id);
        }
        await dialog.alert('User updated successfully', 'Success');
      } else {
        // Create new user
        if (!data.password) {
          await dialog.alert('Password is required for new users', 'Error');
          return;
        }
        await createUser({
          username: data.username,
          password: data.password,
          fullName: data.fullName,
          roleId: data.roleId,
          isActive: data.isActive,
          createdBy: currentUser.id,
        });
        await dialog.alert('User created successfully', 'Success');
      }

      setIsUserModalOpen(false);
      setEditingUser(null);
      userForm.reset();
      await loadData();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save user', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!currentUser) return;
    if (!canManageUsers) {
      await dialog.alert('You do not have permission to manage users.', 'Access denied');
      return;
    }
    if (users.find((user) => user.id === userId && isUserAdmin(user))) {
      await dialog.alert('Admin users cannot be deleted.', 'Access denied');
      return;
    }

    const confirmDelete = await dialog.confirm({
      title: 'Delete User',
      message: `Are you sure you want to delete user "${username}"?\n\nThis action cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      await deleteUser(userId, currentUser.id);
      await dialog.alert('User deleted successfully', 'Success');
      await loadData();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to delete user', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'business' as TabType, name: 'Business Info', icon: BuildingStorefrontIcon },
    { id: 'kot' as TabType, name: 'KOT/Printing', icon: PrinterIcon },
    ...(canViewUsers ? [{ id: 'users' as TabType, name: 'Users', icon: UserGroupIcon }] : []),
    ...(isAdmin ? [{ id: 'permissions' as TabType, name: 'Permissions', icon: ShieldCheckIcon }] : []),
    ...(isAdmin ? [{ id: 'data' as TabType, name: 'Data Management', icon: ArchiveBoxIcon }] : []),
    ...(canViewAudit ? [{ id: 'audit' as TabType, name: 'Audit Logs', icon: ClipboardDocumentListIcon }] : []),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'business' && (
          <Card padding="lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Business Information</h2>
            <form onSubmit={businessForm.handleSubmit(onSubmitBusinessInfo)} className="space-y-4">
              <Input
                label="Restaurant Name"
                error={businessForm.formState.errors.restaurantName?.message}
                {...businessForm.register('restaurantName')}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restaurant Address
                </label>
                <textarea
                  className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  {...businessForm.register('restaurantAddress')}
                />
              </div>

              <Input
                label="Restaurant Phone"
                type="tel"
                placeholder="03001234567"
                error={businessForm.formState.errors.restaurantPhone?.message}
                {...businessForm.register('restaurantPhone')}
              />

              <Input
                label="Tax Rate (%)"
                type="number"
                step="0.01"
                error={businessForm.formState.errors.taxRate?.message}
                {...businessForm.register('taxRate', { valueAsNumber: true })}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt Footer
                </label>
                <textarea
                  className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="Thank you for your visit!"
                  {...businessForm.register('receiptFooter')}
                />
              </div>

              {/* Day Count Mode */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Day Counting Mode</h3>
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="dayCountByRegister"
                    className="w-4 h-4 mt-0.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    {...businessForm.register('dayCountByRegister')}
                  />
                  <label htmlFor="dayCountByRegister" className="text-sm text-gray-700">
                    <span className="font-medium">Day = Register Session</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      When enabled, "Today" in reports, dashboard, and order list will be based on the
                      current register session (open → close) instead of calendar day (12 AM → 12 AM).
                    </p>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" isLoading={isLoading}>
                  Save Business Info
                </Button>
              </div>
            </form>
          </Card>
        )}

        {activeTab === 'kot' && (
          <Card padding="lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">KOT & Printing Settings</h2>
            <form onSubmit={kotForm.handleSubmit(onSubmitKOTSettings)} className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="kotSplitByMajorCategory"
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    {...kotForm.register('kotSplitByMajorCategory')}
                  />
                  <label htmlFor="kotSplitByMajorCategory" className="text-sm font-medium text-gray-700">
                    Split KOT by Major Category (separate KOTs for different kitchen sections)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="kotIncludeVariants"
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    {...kotForm.register('kotIncludeVariants')}
                  />
                  <label htmlFor="kotIncludeVariants" className="text-sm font-medium text-gray-700">
                    Include variants on KOT (Size, Flavor, etc.)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="kotIncludeDealBreakdown"
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    {...kotForm.register('kotIncludeDealBreakdown')}
                  />
                  <label htmlFor="kotIncludeDealBreakdown" className="text-sm font-medium text-gray-700">
                    Show deal breakdown on KOT (individual items in combo deals)
                  </label>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-800 mb-2">Print All Receipts Includes</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="printAllIncludeKOT"
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        {...kotForm.register('printAllIncludeKOT')}
                      />
                      <label htmlFor="printAllIncludeKOT" className="text-sm font-medium text-gray-700">
                        KOT
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="printAllIncludeCustomer"
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        {...kotForm.register('printAllIncludeCustomer')}
                      />
                      <label htmlFor="printAllIncludeCustomer" className="text-sm font-medium text-gray-700">
                        Customer Copy
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="printAllIncludeCounter"
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        {...kotForm.register('printAllIncludeCounter')}
                      />
                      <label htmlFor="printAllIncludeCounter" className="text-sm font-medium text-gray-700">
                        Counter Copy
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="printAllIncludeRider"
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        {...kotForm.register('printAllIncludeRider')}
                      />
                      <label htmlFor="printAllIncludeRider" className="text-sm font-medium text-gray-700">
                        Rider Copy (delivery only)
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" isLoading={isLoading}>
                  Save KOT Settings
                </Button>
              </div>
            </form>
          </Card>
        )}

        {activeTab === 'users' && canViewUsers && (
          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">System Users</h2>
              <Button onClick={() => handleOpenUserModal()} variant="primary" disabled={!canManageUsers}>
                Create User
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.fullName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {getRoleLabel(user.roleId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button
                          onClick={() => handleOpenUserModal(user)}
                          variant="secondary"
                          size="sm"
                          disabled={!canManageUsers}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          variant="danger"
                          size="sm"
                          disabled={!canManageUsers || user.id === currentUser?.id || isUserAdmin(user)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'permissions' && isAdmin && (
          <PermissionManagement />
        )}

        {activeTab === 'data' && isAdmin && (
          <Card padding="lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Migrate Orders to Past Orders</h2>
            <p className="text-sm text-gray-600 mb-6">
              Move completed and cancelled orders to the Past Orders archive. This improves performance
              by keeping the active orders table lean. Only completed/cancelled orders will be migrated.
              Open orders are never affected.
            </p>

            <div className="space-y-6">
              <div className="flex items-end gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Migrate orders older than (days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={migrationDays}
                    onChange={(e) => setMigrationDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Orders created more than {migrationDays} day{migrationDays !== 1 ? 's' : ''} ago will be migrated
                  </p>
                </div>
                <Button
                  className="mb-5"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const preview = await getMigrationPreview(migrationDays);
                      setMigrationPreview(preview);
                    } catch (error) {
                      await dialog.alert(
                        error instanceof Error ? error.message : 'Failed to get migration preview',
                        'Error'
                      );
                    }
                  }}
                >
                  Preview
                </Button>
              </div>

              {migrationPreview && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-gray-800">Migration Preview</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Orders to Migrate</p>
                      <p className="text-2xl font-bold text-primary-600">{migrationPreview.ordersToMigrate}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Active Orders (current)</p>
                      <p className="text-2xl font-bold text-gray-900">{migrationPreview.currentActiveOrders}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Past Orders (archived)</p>
                      <p className="text-2xl font-bold text-gray-900">{migrationPreview.currentPastOrders}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Cutoff Date</p>
                      <p className="font-semibold">{formatDateTime(migrationPreview.cutoffDate)}</p>
                    </div>
                  </div>

                  {migrationPreview.ordersToMigrate > 0 && (
                    <div className="pt-3 border-t border-gray-200">
                      <Button
                        variant="primary"
                        isLoading={isMigrating}
                        onClick={async () => {
                          const confirmed = await dialog.confirm({
                            title: 'Confirm Migration',
                            message: `Are you sure you want to migrate ${migrationPreview.ordersToMigrate} orders to Past Orders?\n\nThis will move them out of the active orders table. They will still be accessible from the Past Orders section.`,
                            variant: 'warning',
                            confirmLabel: 'Migrate Orders',
                            cancelLabel: 'Cancel',
                          });

                          if (!confirmed) return;

                          setIsMigrating(true);
                          try {
                            const result = await migrateOrdersToPast(migrationDays);
                            await dialog.alert(
                              `Successfully migrated ${result.migratedCount} orders to Past Orders.${
                                result.errors && result.errors.length > 0
                                  ? `\n\n${result.errors.length} errors occurred.`
                                  : ''
                              }`,
                              'Migration Complete'
                            );
                            // Refresh preview
                            const preview = await getMigrationPreview(migrationDays);
                            setMigrationPreview(preview);
                          } catch (error) {
                            await dialog.alert(
                              error instanceof Error ? error.message : 'Migration failed',
                              'Error'
                            );
                          } finally {
                            setIsMigrating(false);
                          }
                        }}
                      >
                        Migrate {migrationPreview.ordersToMigrate} Orders
                      </Button>
                    </div>
                  )}

                  {migrationPreview.ordersToMigrate === 0 && (
                    <p className="text-sm text-green-600 font-medium">
                      No orders to migrate for the selected time period.
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'audit' && canViewAudit && (
          <Card padding="lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Audit Logs</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Table
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.userId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.action === 'create'
                              ? 'bg-green-100 text-green-800'
                              : log.action === 'update'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {log.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.tableName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {log.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* User Create/Edit Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setEditingUser(null);
          userForm.reset();
        }}
        title={editingUser ? 'Edit User' : 'Create User'}
        size="md"
      >
        <form onSubmit={userForm.handleSubmit(handleSaveUser)} className="space-y-4">
          <Input
            label="Username"
            error={userForm.formState.errors.username?.message}
            disabled={!!editingUser}
            {...userForm.register('username')}
          />

          <Input
            label={editingUser ? 'Reset Password (leave blank to keep current)' : 'Password'}
            type="password"
            error={userForm.formState.errors.password?.message}
            helperText={editingUser ? (isAdmin ? 'Admins can reset passwords.' : 'Only admins can reset passwords.') : undefined}
            disabled={!!editingUser && !isAdmin}
            {...userForm.register('password')}
          />

          <Input
            label="Full Name"
            error={userForm.formState.errors.fullName?.message}
            {...userForm.register('fullName')}
          />

          <Select
            label="Role"
            error={userForm.formState.errors.roleId?.message}
            {...userForm.register('roleId')}
          >
            <option value="" disabled>
              Select role
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="userIsActive"
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              {...userForm.register('isActive')}
            />
            <label htmlFor="userIsActive" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsUserModalOpen(false);
                setEditingUser(null);
                userForm.reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};


