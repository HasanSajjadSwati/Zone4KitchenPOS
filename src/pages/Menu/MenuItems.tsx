import React, { useEffect, useState, useRef } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input, Select, Badge, CategoryFilter } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getAllMenuItemsUnfiltered,
  getAllCategories,
  getAllVariants,
  getMenuItemVariants,
  setMenuItemVariants,
  getVariantOptions,
  createVariant,
  createVariantOption,
} from '@/services/menuService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { formatCurrency } from '@/utils/validation';
import type { MenuItem, Category, Variant } from '@/db/types';

const menuItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  price: z.number().min(0, 'Price must be positive'),
  description: z.string().nullable(),
  isActive: z.boolean(),
  isDealOnly: z.boolean(),
  hasVariants: z.boolean(),
});

type MenuItemFormData = z.infer<typeof menuItemSchema>;

// Helper component to select which variant options are available
const VariantOptionsSelector: React.FC<{
  variant: Variant;
  availableOptionIds: string[];
  onToggleOption: (optionId: string) => void;
}> = ({ variant, availableOptionIds, onToggleOption }) => {
  const [options, setOptions] = useState<any[]>([]);

  useEffect(() => {
    const loadOptions = async () => {
      const opts = await getVariantOptions(variant.id);
      setOptions(opts.filter(o => o.isActive));
    };
    loadOptions();
  }, [variant.id]);

  if (options.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic mt-1">
        No options available for this variant
      </div>
    );
  }

  const allSelected = availableOptionIds.length === 0;

  return (
    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
        Available Options {allSelected && <span className="text-gray-500 dark:text-gray-400">(All selected)</span>}
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {allSelected ? 'Select specific options to limit choices, or leave all selected for all options' : 'Only checked options will be available to customers'}
      </p>
      <div className="space-y-1">
        {options.map((option) => {
          const isChecked = allSelected || availableOptionIds.includes(option.id);
          return (
            <label
              key={option.id}
              className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleOption(option.id)}
                className="w-3 h-3 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-gray-700 dark:text-gray-200">{option.name}</span>
              {option.priceModifier !== 0 && (
                <span className="text-gray-500 dark:text-gray-400">
                  ({option.priceModifier > 0 ? '+' : ''}{formatCurrency(option.priceModifier)})
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
};

export const MenuItems: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedVariants, setSelectedVariants] = useState<{ variantId: string; isRequired: boolean; selectionMode: 'single' | 'multiple' | 'all'; availableOptionIds: string[] }[]>([]);
  const [variantSearchQuery, setVariantSearchQuery] = useState('');
  const [isVariantDropdownOpen, setIsVariantDropdownOpen] = useState(false);
  const variantSearchRef = useRef<HTMLDivElement>(null);
  const [isNewVariantModalOpen, setIsNewVariantModalOpen] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantType, setNewVariantType] = useState<'size' | 'flavour' | 'custom'>('custom');
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [newVariantOptions, setNewVariantOptions] = useState<{ name: string; priceModifier: number }[]>([]);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MenuItemFormData>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      price: 0,
      description: null,
      isActive: true,
      isDealOnly: false,
      hasVariants: false,
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (variantSearchRef.current && !variantSearchRef.current.contains(event.target as Node)) {
        setIsVariantDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    const [allItems, allCategories, allVariants] = await Promise.all([
      getAllMenuItemsUnfiltered(),
      getAllCategories(),
      getAllVariants(),
    ]);
    setItems(allItems);
    // Show all active categories (both major and sub) for item assignment
    setCategories(allCategories.filter((cat) => cat.isActive));
    setVariants(allVariants);
  };

  const onSubmit = async (data: MenuItemFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      let itemId: string;
      if (editingItem) {
        await updateMenuItem(editingItem.id, data, currentUser.id);
        itemId = editingItem.id;
      } else {
        const newItem = await createMenuItem(data, currentUser.id);
        itemId = newItem.id;
      }

      // Always sync variant assignments so removed variants are cleared
      if (data.hasVariants) {
        await setMenuItemVariants(itemId, selectedVariants, currentUser.id);
      } else {
        await setMenuItemVariants(itemId, [], currentUser.id);
      }

      await loadData();
      closeModal();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save menu item', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (item: MenuItem) => {
    setEditingItem(item);
    reset({
      name: item.name,
      categoryId: item.categoryId,
      price: item.price,
      description: item.description,
      isActive: item.isActive,
      isDealOnly: item.isDealOnly,
      hasVariants: item.hasVariants,
    });

    // Load existing variant assignments
    if (item.hasVariants) {
      const itemVariants = await getMenuItemVariants(item.id);
      setSelectedVariants(
        itemVariants.map((iv) => ({
          variantId: iv.variantId,
          isRequired: iv.isRequired,
          selectionMode: iv.selectionMode || 'single', // Default to 'single' for backward compatibility
          availableOptionIds: iv.availableOptionIds || [] // Empty array means all options available
        }))
      );
    } else {
      setSelectedVariants([]);
    }

    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;

    const confirmed = await dialog.confirm({
      title: 'Delete Menu Item',
      message: 'Are you sure you want to delete this menu item?',
      variant: 'danger',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await deleteMenuItem(id, currentUser.id);
      await loadData();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to delete menu item', 'Error');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setSelectedVariants([]);
    setVariantSearchQuery('');
    setIsVariantDropdownOpen(false);
    reset({
      name: '',
      categoryId: '',
      price: 0,
      description: null,
      isActive: true,
      isDealOnly: false,
      hasVariants: false,
    });
  };

  const handleCreateNewVariant = async () => {
    if (!currentUser || !newVariantName.trim()) return;

    setIsCreatingVariant(true);
    try {
      const newVariant = await createVariant(
        {
          name: newVariantName.trim(),
          type: newVariantType,
          sortOrder: variants.length,
          isActive: true,
        },
        currentUser.id
      );

      // Create variant options if any were added
      for (let i = 0; i < newVariantOptions.length; i++) {
        const opt = newVariantOptions[i];
        await createVariantOption(
          {
            variantId: newVariant.id,
            name: opt.name,
            priceModifier: opt.priceModifier,
            sortOrder: i,
            isActive: true,
          },
          currentUser.id
        );
      }

      // Reload variants and auto-select the new one
      const vars = await getAllVariants();
      setVariants(vars);
      setSelectedVariants((prev) => [
        ...prev,
        { variantId: newVariant.id, isRequired: false, selectionMode: 'single', availableOptionIds: [] },
      ]);
      setIsNewVariantModalOpen(false);
      setNewVariantName('');
      setNewVariantType('custom');
      setNewVariantOptions([]);
      setNewOptionName('');
      setNewOptionPrice(0);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to create variant', 'Error');
    } finally {
      setIsCreatingVariant(false);
    }
  };

  const handleAddNewOption = () => {
    if (!newOptionName.trim()) return;
    setNewVariantOptions([...newVariantOptions, { name: newOptionName.trim(), priceModifier: newOptionPrice }]);
    setNewOptionName('');
    setNewOptionPrice(0);
  };

  const handleRemoveNewOption = (index: number) => {
    setNewVariantOptions(newVariantOptions.filter((_, i) => i !== index));
  };

  const toggleVariantSelection = (variantId: string) => {
    setSelectedVariants((prev) => {
      const exists = prev.find((v) => v.variantId === variantId);
      if (exists) {
        return prev.filter((v) => v.variantId !== variantId);
      }
      return [...prev, { variantId, isRequired: false, selectionMode: 'single', availableOptionIds: [] }];
    });
  };

  const toggleVariantRequired = (variantId: string) => {
    setSelectedVariants((prev) =>
      prev.map((v) =>
        v.variantId === variantId ? { ...v, isRequired: !v.isRequired } : v
      )
    );
  };

  const updateVariantSelectionMode = (variantId: string, selectionMode: 'single' | 'multiple' | 'all') => {
    setSelectedVariants((prev) =>
      prev.map((v) =>
        v.variantId === variantId ? { ...v, selectionMode } : v
      )
    );
  };

  const toggleVariantOption = (variantId: string, optionId: string) => {
    setSelectedVariants((prev) =>
      prev.map((v) => {
        if (v.variantId === variantId) {
          const availableOptionIds = v.availableOptionIds || [];
          if (availableOptionIds.includes(optionId)) {
            // Remove option
            return { ...v, availableOptionIds: availableOptionIds.filter(id => id !== optionId) };
          } else {
            // Add option
            return { ...v, availableOptionIds: [...availableOptionIds, optionId] };
          }
        }
        return v;
      })
    );
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((cat) => cat.id === categoryId)?.name || 'Unknown';
  };

  const selectedCategoryId = watch('categoryId');

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesCategory = true;

    if (filterCategory !== 'all') {
      const selectedCategory = categories.find((cat) => cat.id === filterCategory);
      if (selectedCategory?.type === 'major') {
        const subIds = categories
          .filter((cat) => cat.parentId === selectedCategory.id)
          .map((cat) => cat.id);
        const validIds = new Set([selectedCategory.id, ...subIds]);
        matchesCategory = validIds.has(item.categoryId);
      } else {
        matchesCategory = item.categoryId === filterCategory;
      }
    }

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && item.isActive) ||
      (filterStatus === 'inactive' && !item.isActive);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Menu Items</h1>
        <Button
          onClick={() => setIsModalOpen(true)}
          leftIcon={<PlusIcon className="w-5 h-5" />}
        >
          Add Menu Item
        </Button>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Search"
            placeholder="Search menu items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
            <CategoryFilter
              categories={categories}
              value={filterCategory === 'all' ? '' : filterCategory}
              onChange={(value) => setFilterCategory(value || 'all')}
            />
          <Select
            label="Filter by Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Items</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </Select>
        </div>
      </Card>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} padding="none" hoverable>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {getCategoryName(item.categoryId)}
                  </p>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <Badge variant={item.isActive ? 'success' : 'default'} size="sm">
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {item.hasVariants && (
                    <Badge variant="primary" size="sm">
                      Has Variants
                    </Badge>
                  )}
                  {item.isDealOnly && (
                    <Badge variant="warning" size="sm">
                      Deal Only
                    </Badge>
                  )}
                </div>
              </div>

              {item.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {item.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span className="text-xl font-bold text-primary-600">
                  {formatCurrency(item.price)}
                </span>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(item)}
                    leftIcon={<PencilIcon className="w-4 h-4" />}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(item.id)}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <Card padding="lg">
          <div className="text-center text-gray-500">
            <p>No menu items found. Click "Add Menu Item" to create one.</p>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
        size="lg"
        preventBackdropClose={isNewVariantModalOpen}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Item Name"
            error={errors.name?.message}
            {...register('name')}
          />

          <input type="hidden" {...register('categoryId')} />
          <CategoryFilter
            categories={categories}
            value={selectedCategoryId || ''}
            onChange={(value) => {
              setValue('categoryId', value, { shouldValidate: true, shouldDirty: true });
            }}
            label="Category"
            placeholder="Select category"
          />
          {errors.categoryId && (
            <p className="mt-1 text-sm text-danger-600">{errors.categoryId.message}</p>
          )}

          <Input
            label="Price (Rs)"
            type="number"
            step="0.01"
            error={errors.price?.message}
            {...register('price', { valueAsNumber: true })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              {...register('description')}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-danger-600">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                {...register('isActive')}
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDealOnly"
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                {...register('isDealOnly')}
              />
              <label htmlFor="isDealOnly" className="text-sm font-medium text-gray-700">
                Deal Only (Hide from regular menu)
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hasVariants"
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                {...register('hasVariants')}
              />
              <label htmlFor="hasVariants" className="text-sm font-medium text-gray-700">
                Has Variants (Size, Flavor, etc.)
              </label>
            </div>
          </div>

          {/* Variant Selection - shown when hasVariants is checked */}
          {watch('hasVariants') && (
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Select Variants for this Item
                </label>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedVariants.length} selected
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose which variants apply to this item. Mark as required if customer must select an option.
              </p>

              {/* Search and Add Variant */}
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={variantSearchRef}>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={variantSearchQuery}
                      onChange={(e) => {
                        setVariantSearchQuery(e.target.value);
                        setIsVariantDropdownOpen(true);
                      }}
                      onFocus={() => setIsVariantDropdownOpen(true)}
                      placeholder="Search variants to add..."
                      className="block w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                    />
                  </div>
                  {isVariantDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {variants
                        .filter((v) => v.isActive)
                        .filter((v) => {
                          const query = variantSearchQuery.toLowerCase();
                          return (
                            v.name.toLowerCase().includes(query) &&
                            !selectedVariants.find((sv) => sv.variantId === v.id)
                          );
                        })
                        .map((variant, index, arr) => (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => {
                              toggleVariantSelection(variant.id);
                              setVariantSearchQuery('');
                              setIsVariantDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex items-center justify-between ${
                              index !== arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                            }`}
                          >
                            <span className="font-medium text-gray-900 dark:text-gray-100">{variant.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                              {variant.type}
                            </span>
                          </button>
                        ))}
                      {variants
                        .filter((v) => v.isActive)
                        .filter((v) => {
                          const query = variantSearchQuery.toLowerCase();
                          return (
                            v.name.toLowerCase().includes(query) &&
                            !selectedVariants.find((sv) => sv.variantId === v.id)
                          );
                        }).length === 0 && (
                        <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center text-sm">
                          {variantSearchQuery ? 'No variants found' : 'All variants already added'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsNewVariantModalOpen(true)}
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                >
                  New
                </Button>
              </div>

              {/* Selected Variants List */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {selectedVariants.map((sv) => {
                  const variant = variants.find((v) => v.id === sv.variantId);
                  if (!variant) return null;
                  return (
                    <div
                      key={variant.id}
                      className="border rounded-lg p-3 space-y-2 border-primary-500 bg-primary-50 dark:bg-primary-900/40 dark:border-primary-400"
                    >
                      {/* Variant header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{variant.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300 capitalize">
                            {variant.type}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleVariantSelection(variant.id)}
                          className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Selection Mode and Required options */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`required-${variant.id}`}
                              checked={sv.isRequired}
                              onChange={() => toggleVariantRequired(variant.id)}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <label htmlFor={`required-${variant.id}`} className="text-sm text-gray-600 dark:text-gray-300">
                              Required
                            </label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Mode:</label>
                            <select
                              value={sv.selectionMode}
                              onChange={(e) => updateVariantSelectionMode(
                                variant.id,
                                e.target.value as 'single' | 'multiple' | 'all'
                              )}
                              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            >
                              <option value="single">Select One</option>
                              <option value="multiple">Select Multiple</option>
                              <option value="all">Select All</option>
                            </select>
                          </div>
                        </div>

                        {/* Variant Options Selection */}
                        <VariantOptionsSelector
                          variant={variant}
                          availableOptionIds={sv.availableOptionIds || []}
                          onToggleOption={(optionId) => toggleVariantOption(variant.id, optionId)}
                        />
                      </div>
                    </div>
                  );
                })}

                {selectedVariants.length === 0 && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    No variants added. Search above to add variants.
                  </div>
                )}
              </div>
            </div>
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

      {/* Create New Variant Modal */}
      <Modal
        isOpen={isNewVariantModalOpen}
        onClose={() => {
          setIsNewVariantModalOpen(false);
          setNewVariantName('');
          setNewVariantType('custom');
          setNewVariantOptions([]);
          setNewOptionName('');
          setNewOptionPrice(0);
        }}
        title="Create New Variant"
        size="md"
        zIndex="z-[60]"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Variant Name
            </label>
            <input
              type="text"
              value={newVariantName}
              onChange={(e) => setNewVariantName(e.target.value)}
              placeholder="e.g., Size, Flavor, Crust Type"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <Select
            label="Variant Type"
            value={newVariantType}
            onChange={(e) => setNewVariantType(e.target.value as 'size' | 'flavour' | 'custom')}
          >
            <option value="size">Size</option>
            <option value="flavour">Flavour</option>
            <option value="custom">Custom</option>
          </Select>

          {/* Variant Options Section */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Variant Options (Optional)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Add options for this variant (e.g., Small, Medium, Large for Size)
            </p>

            {/* Add Option Form */}
            <div className="grid grid-cols-12 gap-2 mb-3">
              <div className="col-span-5">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Option Name</label>
                <input
                  type="text"
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  placeholder="e.g., Large"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="col-span-4">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price Modifier (Rs)</label>
                <input
                  type="number"
                  value={newOptionPrice}
                  onChange={(e) => setNewOptionPrice(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="col-span-3 flex items-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddNewOption}
                  disabled={!newOptionName.trim()}
                  className="w-full"
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Options List */}
            {newVariantOptions.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {newVariantOptions.map((opt, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{opt.name}</span>
                      {opt.priceModifier !== 0 && (
                        <span className={`text-sm ${opt.priceModifier > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {opt.priceModifier > 0 ? '+' : ''}{formatCurrency(opt.priceModifier)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveNewOption(index)}
                      className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {newVariantOptions.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center py-2">
                No options added yet. You can add them now or later.
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsNewVariantModalOpen(false);
                setNewVariantName('');
                setNewVariantType('custom');
                setNewVariantOptions([]);
                setNewOptionName('');
                setNewOptionPrice(0);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewVariant}
              isLoading={isCreatingVariant}
              disabled={!newVariantName.trim()}
            >
              Create & Add
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
