import React, { useEffect, useState } from 'react';
import { CheckIcon, XMarkIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Button, Card } from '@/components/ui';
import { getAllRoles, updateRolePermissions } from '@/services/settingsService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import type { Role, Permission } from '@/db/types';

// Define all available resources and their display names
const AVAILABLE_RESOURCES = [
  { id: 'orders', name: 'Orders', description: 'Create, view, edit, and delete orders' },
  { id: 'menu', name: 'Menu Management', description: 'Manage categories, items, variants, and deals' },
  { id: 'reports', name: 'Reports', description: 'View and export reports' },
  { id: 'users', name: 'Users', description: 'Manage system users' },
  { id: 'settings', name: 'Settings', description: 'Manage system settings' },
  { id: 'register', name: 'Register', description: 'Open/close register sessions' },
  { id: 'staff', name: 'Staff', description: 'Manage waiters, riders, and tables' },
  { id: 'audit', name: 'Audit Logs', description: 'View audit logs' },
  { id: 'discounts', name: 'Discounts', description: 'Apply discounts to orders' },
  { id: 'employees', name: 'Employees', description: 'Manage employee records' },
  { id: 'employee_loans', name: 'Employee Loans', description: 'Manage employee loans' },
  { id: 'expenses', name: 'Expenses', description: 'Manage business expenses' },
];

// Define all available actions and their display names
const AVAILABLE_ACTIONS: { id: 'create' | 'read' | 'update' | 'delete' | 'export'; name: string; description: string }[] = [
  { id: 'create', name: 'Create', description: 'Add new records' },
  { id: 'read', name: 'View', description: 'View records' },
  { id: 'update', name: 'Edit', description: 'Edit existing records' },
  { id: 'delete', name: 'Delete', description: 'Remove records' },
  { id: 'export', name: 'Export', description: 'Export data' },
];

// Define which actions are typically available for each resource
const RESOURCE_ACTIONS: Record<string, ('create' | 'read' | 'update' | 'delete' | 'export')[]> = {
  orders: ['create', 'read', 'update', 'delete'],
  menu: ['create', 'read', 'update', 'delete'],
  reports: ['read', 'export'],
  users: ['create', 'read', 'update', 'delete'],
  settings: ['read', 'update', 'delete'],
  register: ['create', 'read', 'update'],
  staff: ['create', 'read', 'update', 'delete'],
  audit: ['read'],
  discounts: ['create', 'read', 'update', 'delete'],
  employees: ['create', 'read', 'update', 'delete'],
  employee_loans: ['create', 'read', 'update', 'delete'],
  expenses: ['create', 'read', 'update', 'delete'],
};

export const PermissionManagement: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentRole = useAuthStore((state) => state.currentRole);
  const dialog = useDialog();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isAdmin = currentRole?.name === 'Admin';

  const loadRoles = async () => {
    const allRoles = await getAllRoles();
    setRoles(allRoles);
    // Select first non-admin role by default, or first role
    if (!selectedRole && allRoles.length > 0) {
      const defaultRole = allRoles.find((r: Role) => r.name !== 'Admin') || allRoles[0];
      setSelectedRole(defaultRole);
      setPermissions(defaultRole.permissions);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleRoleSelect = (role: Role) => {
    if (hasChanges) {
      dialog.confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Discard them?',
        variant: 'warning',
        confirmLabel: 'Discard',
        cancelLabel: 'Cancel',
      }).then((confirmed) => {
        if (confirmed) {
          setSelectedRole(role);
          setPermissions(role.permissions);
          setHasChanges(false);
        }
      });
    } else {
      setSelectedRole(role);
      setPermissions(role.permissions);
    }
  };

  const hasPermission = (resource: string, action: 'create' | 'read' | 'update' | 'delete' | 'export'): boolean => {
    const perm = permissions.find(p => p.resource === resource);
    return perm?.actions.includes(action) ?? false;
  };

  const togglePermission = (resource: string, action: 'create' | 'read' | 'update' | 'delete' | 'export') => {
    if (selectedRole?.name === 'Admin') {
      dialog.alert('Admin permissions cannot be modified. Admin always has full access.', 'Admin Protected');
      return;
    }

    setHasChanges(true);
    setPermissions(prev => {
      const existing = prev.find(p => p.resource === resource);
      
      if (existing) {
        // Update existing permission
        const newActions = existing.actions.includes(action)
          ? existing.actions.filter(a => a !== action)
          : [...existing.actions, action];
        
        if (newActions.length === 0) {
          // Remove the permission entirely if no actions
          return prev.filter(p => p.resource !== resource);
        }
        
        return prev.map(p => 
          p.resource === resource 
            ? { ...p, actions: newActions }
            : p
        );
      } else {
        // Add new permission
        return [...prev, { resource, actions: [action] }];
      }
    });
  };

  const toggleAllActionsForResource = (resource: string) => {
    if (selectedRole?.name === 'Admin') {
      dialog.alert('Admin permissions cannot be modified. Admin always has full access.', 'Admin Protected');
      return;
    }

    const availableActions = RESOURCE_ACTIONS[resource] || [];
    const currentPerm = permissions.find(p => p.resource === resource);
    const hasAllActions = availableActions.every(action => currentPerm?.actions.includes(action));

    setHasChanges(true);
    setPermissions(prev => {
      if (hasAllActions) {
        // Remove all actions for this resource
        return prev.filter(p => p.resource !== resource);
      } else {
        // Grant all available actions for this resource
        const withoutResource = prev.filter(p => p.resource !== resource);
        return [...withoutResource, { resource, actions: availableActions }];
      }
    });
  };

  const handleSave = async () => {
    if (!selectedRole || !currentUser) return;

    if (selectedRole.name === 'Admin') {
      await dialog.alert('Admin permissions cannot be modified.', 'Error');
      return;
    }

    setIsLoading(true);
    try {
      await updateRolePermissions(selectedRole.id, permissions, currentUser.id);
      await dialog.alert(`Permissions for ${selectedRole.name} updated successfully!`, 'Success');
      setHasChanges(false);
      await loadRoles();
      // Re-select the role to refresh
      const updatedRole = (await getAllRoles()).find((r: Role) => r.id === selectedRole.id);
      if (updatedRole) {
        setSelectedRole(updatedRole);
        setPermissions(updatedRole.permissions);
      }
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to update permissions', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (selectedRole) {
      setPermissions(selectedRole.permissions);
      setHasChanges(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card padding="lg">
        <div className="text-center py-8">
          <ShieldCheckIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
          <p className="text-gray-500 mt-2">Only administrators can manage permissions.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Selection */}
      <Card padding="lg">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Role to Manage</h2>
        <div className="flex flex-wrap gap-3">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleSelect(role)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedRole?.id === role.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${role.name === 'Admin' ? 'border-2 border-yellow-500' : ''}`}
            >
              {role.name}
              {role.name === 'Admin' && (
                <span className="ml-2 text-xs opacity-75">(Protected)</span>
              )}
            </button>
          ))}
        </div>
      </Card>

      {/* Permission Matrix */}
      {selectedRole && (
        <Card padding="lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Permissions for {selectedRole.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedRole.name === 'Admin' 
                  ? 'Admin has full access to all features and cannot be modified.'
                  : 'Toggle permissions to control what this role can do.'}
              </p>
            </div>
            {hasChanges && (
              <span className="text-sm text-orange-600 font-medium">
                Unsaved changes
              </span>
            )}
          </div>

          {selectedRole.name === 'Admin' && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> Admin role has full permissions and cannot be modified. 
                This ensures at least one role always has complete system access.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Resource
                  </th>
                  {AVAILABLE_ACTIONS.map((action) => (
                    <th key={action.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <div className="flex flex-col items-center">
                        <span>{action.name}</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    All
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {AVAILABLE_RESOURCES.map((resource) => {
                  const availableActions = RESOURCE_ACTIONS[resource.id] || [];
                  const hasAllActions = availableActions.every(action => hasPermission(resource.id, action));
                  const hasSomeActions = availableActions.some(action => hasPermission(resource.id, action));

                  return (
                    <tr key={resource.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {resource.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {resource.description}
                          </div>
                        </div>
                      </td>
                      {AVAILABLE_ACTIONS.map((action) => {
                        const isAvailable = availableActions.includes(action.id);
                        const isEnabled = hasPermission(resource.id, action.id);
                        const isAdminRole = selectedRole.name === 'Admin';

                        return (
                          <td key={action.id} className="px-4 py-4 text-center">
                            {isAvailable ? (
                              <button
                                onClick={() => togglePermission(resource.id, action.id)}
                                disabled={isAdminRole}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                  isEnabled
                                    ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                                } ${isAdminRole ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                                title={isEnabled ? 'Click to remove' : 'Click to grant'}
                              >
                                {isEnabled ? (
                                  <CheckIcon className="w-5 h-5" />
                                ) : (
                                  <XMarkIcon className="w-5 h-5" />
                                )}
                              </button>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => toggleAllActionsForResource(resource.id)}
                          disabled={selectedRole.name === 'Admin'}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            hasAllActions
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : hasSomeActions
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          } ${selectedRole.name === 'Admin' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                          title={hasAllActions ? 'Remove all' : 'Grant all'}
                        >
                          {hasAllActions ? 'Full' : hasSomeActions ? 'Partial' : 'None'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="secondary"
              onClick={handleReset}
              disabled={!hasChanges || isLoading}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!hasChanges || isLoading || selectedRole.name === 'Admin'}
              isLoading={isLoading}
            >
              Save Permissions
            </Button>
          </div>
        </Card>
      )}

      {/* Permission Legend */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Permission Actions Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AVAILABLE_ACTIONS.map((action) => (
            <div key={action.id} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                action.id === 'create' ? 'bg-blue-100 text-blue-600' :
                action.id === 'read' ? 'bg-green-100 text-green-600' :
                action.id === 'update' ? 'bg-yellow-100 text-yellow-600' :
                action.id === 'delete' ? 'bg-red-100 text-red-600' :
                'bg-purple-100 text-purple-600'
              }`}>
                <span className="text-xs font-bold uppercase">{action.id[0]}</span>
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{action.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{action.description}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
