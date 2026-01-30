import React, { useEffect, useState } from 'react';
import {
  BuildingStorefrontIcon,
  PrinterIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { Button, Card, Input, Modal, Select } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getSettings, updateSettings, getAllUsers, getAuditLogs } from '@/services/settingsService';
import { exportMenuData, downloadMenuData, importMenuData } from '@/services/menuImportExportService';
import { seedZoneKitchenMenu } from '@/services/seedMenuService';
import { wipeAllData, wipeMenuData, wipeOrderData } from '@/services/dataWipeService';
import { createUser, updateUser, deleteUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { formatDateTime, phoneSchema } from '@/utils/validation';
import type { User, AuditLog } from '@/db/types';

const businessInfoSchema = z.object({
  restaurantName: z.string().min(1, 'Restaurant name is required'),
  restaurantAddress: z.string(),
  restaurantPhone: phoneSchema,
  taxRate: z.number().min(0).max(100),
  receiptFooter: z.string().nullable(),
});

const kotSettingsSchema = z.object({
  kotSplitByMajorCategory: z.boolean(),
  kotIncludeVariants: z.boolean(),
  kotIncludeDealBreakdown: z.boolean(),
});

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(4, 'Password must be at least 4 characters').optional(),
  fullName: z.string().min(1, 'Full name is required'),
  roleId: z.enum(['manager', 'cashier']),
  isActive: z.boolean(),
});

type BusinessInfoFormData = z.infer<typeof businessInfoSchema>;
type KOTSettingsFormData = z.infer<typeof kotSettingsSchema>;
type UserFormData = z.infer<typeof userSchema>;
type TabType = 'business' | 'kot' | 'users' | 'audit';

export const Settings: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<TabType>('business');
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMenuFile, setSelectedMenuFile] = useState<File | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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
      roleId: 'cashier',
    },
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

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
      });

      kotForm.reset({
        kotSplitByMajorCategory: currentSettings.kotSplitByMajorCategory,
        kotIncludeVariants: currentSettings.kotIncludeVariants,
        kotIncludeDealBreakdown: currentSettings.kotIncludeDealBreakdown,
      });
    }

    if (activeTab === 'users') {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    }

    if (activeTab === 'audit') {
      const logs = await getAuditLogs(50);
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

  const handleExportMenu = async () => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      const menuData = await exportMenuData(currentUser.id);
      downloadMenuData(menuData);
      await dialog.alert('Menu data exported successfully!', 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to export menu data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMenuFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedMenuFile(file);
    }
  };

  const handleImportMenu = async () => {
    if (!currentUser || !selectedMenuFile) return;

    const confirmImport = await dialog.confirm({
      title: 'Warning',
      message: 'WARNING: Importing menu data will replace ALL menu items, categories, variants, and deals. This action cannot be undone.\n\nDo you want to proceed?',
      variant: 'danger',
      confirmLabel: 'Yes, Import',
      cancelLabel: 'Cancel',
    });

    if (!confirmImport) return;

    setIsLoading(true);
    try {
      const fileContent = await selectedMenuFile.text();
      const menuData = JSON.parse(fileContent);

      await importMenuData(menuData, currentUser.id, { replaceExisting: true });
      await dialog.alert('Menu data imported successfully! The page will now reload.', 'Success');
      setSelectedMenuFile(null);

      // Reload the page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to import menu data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWipeAllData = async () => {
    if (!currentUser) return;

    const confirmStep1 = await dialog.confirm({
      title: '🚨 CRITICAL WARNING',
      message: 'This will DELETE ALL DATA from the system including:\n- All orders and payments\n- All menu items and categories\n- All customers\n- All staff members\n- All register sessions\n\nOnly settings and users will be preserved.\n\nAre you ABSOLUTELY SURE you want to proceed?',
      variant: 'danger',
      confirmLabel: 'Yes, Continue',
      cancelLabel: 'Cancel',
    });

    if (!confirmStep1) return;

    const typeConfirm = await dialog.prompt({
      title: 'FINAL CONFIRMATION',
      message: 'Type "DELETE" to confirm data wipe.\n\nThis action CANNOT be undone!',
      placeholder: 'Type DELETE here',
      confirmLabel: 'Wipe Data',
      cancelLabel: 'Cancel',
    });

    if (typeConfirm !== 'DELETE') {
      await dialog.alert('Data wipe cancelled.', 'Cancelled');
      return;
    }

    setIsLoading(true);
    try {
      await wipeAllData(currentUser.id, true);
      await dialog.alert('All data has been wiped. The page will now reload.', 'Complete');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to wipe data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWipeMenuData = async () => {
    if (!currentUser) return;

    const confirm1 = await dialog.confirm({
      title: 'Warning',
      message: 'This will delete ALL menu items, categories, variants, and deals.\n\nThis action cannot be undone. Proceed?',
      variant: 'danger',
      confirmLabel: 'Yes, Wipe',
      cancelLabel: 'Cancel',
    });

    if (!confirm1) return;

    setIsLoading(true);
    try {
      await wipeMenuData(currentUser.id);
      await dialog.alert('Menu data has been wiped. The page will now reload.', 'Complete');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to wipe menu data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWipeOrderData = async () => {
    if (!currentUser) return;

    const confirm1 = await dialog.confirm({
      title: 'Warning',
      message: 'This will delete ALL orders, payments, and KOT records.\n\nThis action cannot be undone. Proceed?',
      variant: 'danger',
      confirmLabel: 'Yes, Wipe',
      cancelLabel: 'Cancel',
    });

    if (!confirm1) return;

    setIsLoading(true);
    try {
      await wipeOrderData(currentUser.id);
      await dialog.alert('Order data has been wiped. The page will now reload.', 'Complete');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to wipe order data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedMenu = async () => {
    if (!currentUser) return;

    const confirmSeed = await dialog.confirm({
      title: 'Seed Zone Kitchen Menu',
      message: 'This will REPLACE all existing menu data (categories, items, variants, deals) with the Zone Kitchen menu.\n\nThis action cannot be undone. Proceed?',
      variant: 'danger',
      confirmLabel: 'Yes, Seed Menu',
      cancelLabel: 'Cancel',
    });

    if (!confirmSeed) return;

    setIsLoading(true);
    try {
      const result = await seedZoneKitchenMenu(currentUser.id);
      await dialog.alert(
        `Menu seeded successfully!\n\n- Categories: ${result.categories}\n- Menu Items: ${result.menuItems}\n- Variants: ${result.variants}\n- Variant Options: ${result.variantOptions}\n- Deals: ${result.deals}\n\nThe page will now reload.`,
        'Success'
      );
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to seed menu', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      userForm.reset({
        username: user.username,
        fullName: user.fullName,
        roleId: user.roleId as 'manager' | 'cashier',
        isActive: user.isActive,
        password: undefined, // Don't show password
      });
    } else {
      setEditingUser(null);
      userForm.reset({
        username: '',
        fullName: '',
        roleId: 'cashier',
        isActive: true,
        password: '',
      });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (data: UserFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      if (editingUser) {
        // Update existing user
        await updateUser({
          id: editingUser.id,
          fullName: data.fullName,
          roleId: data.roleId,
          isActive: data.isActive,
          password: data.password || undefined,
          updatedBy: currentUser.id,
        });
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
    { id: 'users' as TabType, name: 'Users', icon: UserGroupIcon },
    { id: 'audit' as TabType, name: 'Audit Logs', icon: ClipboardDocumentListIcon },
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
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" isLoading={isLoading}>
                  Save KOT Settings
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Seed Menu Section - Separate from tabs */}
        <Card padding="lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Data Management</h2>

          {/* Seed Menu Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Seed Menu Data</h3>
            <p className="text-sm text-gray-600 mb-4">
              Load the complete Zone Kitchen menu (categories, items, variants, deals) into the system. This will replace all existing menu data.
            </p>
            <Button
              onClick={handleSeedMenu}
              variant="danger"
              isLoading={isLoading}
            >
              Seed Zone Kitchen Menu
            </Button>
          </div>

          {/* Menu Import/Export Section */}
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Menu Import/Export</h3>
            <p className="text-sm text-gray-600 mb-4">
              Export or import menu data separately (categories, items, variants, and deals only).
            </p>

              {/* Export Menu */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Export Menu Data</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Download all menu items, categories, variants, and deals as a JSON file.
                </p>
                <Button
                  onClick={handleExportMenu}
                  variant="primary"
                  isLoading={isLoading}
                >
                  Export Menu Data
                </Button>
              </div>

              {/* Import Menu */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Import Menu Data</h4>
                <p className="text-sm text-red-600 font-semibold mb-2">
                  ⚠️ WARNING: This will replace all menu items, categories, variants, and deals!
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  Select a menu export file (.json) to import.
                </p>
                <div className="space-y-4">
                  <div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleMenuFileSelect}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary-50 file:text-primary-700
                        hover:file:bg-primary-100"
                    />
                  </div>
                  {selectedMenuFile && (
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-700">
                        Selected: {selectedMenuFile.name}
                      </span>
                      <Button
                        onClick={handleImportMenu}
                        variant="danger"
                        isLoading={isLoading}
                      >
                        Import Menu Data
                      </Button>
                    </div>
                  )}
                </div>
              </div>
          </div>

          {/* Data Wipe Section */}
          <div className="mt-8 border-t-2 border-red-300 pt-6 bg-red-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-red-900 mb-4">⚠️ Danger Zone - Data Wipe</h3>
            <p className="text-sm text-red-700 font-semibold mb-4">
              These actions are PERMANENT and CANNOT be undone.
            </p>

            <div className="space-y-4">
              {/* Wipe Menu Data */}
              <div className="bg-white p-4 rounded border border-red-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Wipe Menu Data</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Delete all menu items, categories, variants, and deals.
                </p>
                <Button
                  onClick={handleWipeMenuData}
                  variant="danger"
                  size="sm"
                  isLoading={isLoading}
                >
                  Wipe Menu Data
                </Button>
              </div>

              {/* Wipe Order Data */}
              <div className="bg-white p-4 rounded border border-red-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Wipe Order Data</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Delete all orders, payments, and KOT records.
                </p>
                <Button
                  onClick={handleWipeOrderData}
                  variant="danger"
                  size="sm"
                  isLoading={isLoading}
                >
                  Wipe Order Data
                </Button>
              </div>

              {/* Wipe ALL Data */}
              <div className="bg-white p-4 rounded border-2 border-red-500">
                <h4 className="text-sm font-semibold text-red-900 mb-2">🚨 Wipe ALL Data</h4>
                <p className="text-sm text-red-700 font-semibold mb-2">
                  CRITICAL: This will delete EVERYTHING except settings and users!
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  All orders, menu items, customers, staff, and register data will be permanently deleted.
                </p>
                <Button
                  onClick={handleWipeAllData}
                  variant="danger"
                  isLoading={isLoading}
                >
                  Wipe ALL Data
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {activeTab === 'users' && (
          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">System Users</h2>
              <Button onClick={() => handleOpenUserModal()} variant="primary">
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
                        {user.roleId}
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
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          variant="danger"
                          size="sm"
                          disabled={user.id === currentUser?.id}
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

        {activeTab === 'audit' && (
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
            label={editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
            type="password"
            error={userForm.formState.errors.password?.message}
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
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
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
