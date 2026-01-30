import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input, Select, Badge } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getMajorCategories,
} from '@/services/menuService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import type { Category } from '@/db/types';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['major', 'sub']),
  parentId: z.string().nullable(),
  sortOrder: z.number().min(0),
  isActive: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export const Categories: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const [categories, setCategories] = useState<Category[]>([]);
  const [majorCategories, setMajorCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: 'major',
      parentId: null,
      sortOrder: 0,
      isActive: true,
    },
  });

  const categoryType = watch('type');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const allCats = await getAllCategories();
    const majorCats = await getMajorCategories();
    setCategories(allCats);
    setMajorCategories(majorCats);
  };

  const onSubmit = async (data: CategoryFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, data, currentUser.id);
      } else {
        await createCategory(data, currentUser.id);
      }
      await loadCategories();
      closeModal();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save category', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    reset({
      name: category.name,
      type: category.type,
      parentId: category.parentId,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;

    const confirmed = await dialog.confirm({
      title: 'Delete Category',
      message: 'Are you sure you want to delete this category?',
      variant: 'danger',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await deleteCategory(id, currentUser.id);
      await loadCategories();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to delete category', 'Error');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    reset({
      name: '',
      type: 'major',
      parentId: null,
      sortOrder: 0,
      isActive: true,
    });
  };

  const filteredMajorCategories = majorCategories.filter((cat) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return cat.isActive;
    if (filterStatus === 'inactive') return !cat.isActive;
    return true;
  });

  const groupedCategories = filteredMajorCategories.map((major) => ({
    major,
    subs: categories.filter((cat) => {
      const isChild = cat.parentId === major.id;
      if (!isChild) return false;
      if (filterStatus === 'all') return true;
      if (filterStatus === 'active') return cat.isActive;
      if (filterStatus === 'inactive') return !cat.isActive;
      return true;
    }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
        <Button
          onClick={() => setIsModalOpen(true)}
          leftIcon={<PlusIcon className="w-5 h-5" />}
        >
          Add Category
        </Button>
      </div>

      {/* Filter */}
      <Card padding="md">
        <div className="max-w-xs">
          <Select
            label="Filter by Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Categories</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </Select>
        </div>
      </Card>

      <div className="space-y-4">
        {groupedCategories.map(({ major, subs }) => (
          <Card key={major.id} padding="none">
            {/* Major Category */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-gray-900">{major.name}</h3>
                <Badge variant={major.isActive ? 'success' : 'default'}>
                  {major.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-sm text-gray-500">Sort: {major.sortOrder}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(major)}
                  leftIcon={<PencilIcon className="w-4 h-4" />}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(major.id)}
                  leftIcon={<TrashIcon className="w-4 h-4" />}
                >
                  Delete
                </Button>
              </div>
            </div>

            {/* Sub Categories */}
            {subs.length > 0 && (
              <div className="p-4">
                <div className="space-y-2">
                  {subs.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-gray-600">└─</span>
                        <span className="font-medium text-gray-900">{sub.name}</span>
                        <Badge variant={sub.isActive ? 'success' : 'default'} size="sm">
                          {sub.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <span className="text-sm text-gray-500">Sort: {sub.sortOrder}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(sub)}
                          leftIcon={<PencilIcon className="w-4 h-4" />}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(sub.id)}
                          leftIcon={<TrashIcon className="w-4 h-4" />}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {subs.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                No sub-categories
              </div>
            )}
          </Card>
        ))}

        {groupedCategories.length === 0 && (
          <Card padding="lg">
            <div className="text-center text-gray-500">
              <p>No categories yet. Click "Add Category" to create your first one.</p>
            </div>
          </Card>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Category Name"
            error={errors.name?.message}
            {...register('name')}
          />

          <Select
            label="Type"
            error={errors.type?.message}
            options={[
              { value: 'major', label: 'Major Category' },
              { value: 'sub', label: 'Sub Category' },
            ]}
            {...register('type')}
          />

          {categoryType === 'sub' && (
            <Select
              label="Parent Category"
              error={errors.parentId?.message}
              options={[
                { value: '', label: 'Select parent category' },
                ...majorCategories.map((cat) => ({
                  value: cat.id,
                  label: cat.name,
                })),
              ]}
              {...register('parentId')}
            />
          )}

          <Input
            label="Sort Order"
            type="number"
            error={errors.sortOrder?.message}
            helperText="Lower numbers appear first"
            {...register('sortOrder', { valueAsNumber: true })}
          />

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

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
