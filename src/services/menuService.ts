import { db } from '@/db';
import type { Category, MenuItem, Variant, VariantOption, MenuItemVariant, Deal, DealItem, DealVariant, SelectionMode } from '@/db/types';
import { logAudit } from '@/utils/audit';
import { createId } from '@/utils/uuid';

// Categories
export async function createCategory(
  category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Category> {
  const newCategory: Category = {
    id: createId(),
    ...category,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.categories.add(newCategory);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'categories',
    recordId: newCategory.id,
    description: `Created category: ${newCategory.name}`,
    after: newCategory,
  });

  return newCategory;
}

export async function updateCategory(
  id: string,
  updates: Partial<Category>,
  userId: string
): Promise<void> {
  const before = await db.categories.get(id);

  await db.categories.update(id, {
    ...updates,
    updatedAt: new Date(),
  });

  const after = await db.categories.get(id);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'categories',
    recordId: id,
    description: `Updated category: ${after?.name}`,
    before,
    after,
  });
}

export async function deleteCategory(id: string, userId: string): Promise<void> {
  const category = await db.categories.get(id);

  // Check if category has items
  const itemCount = await db.menuItems.where('categoryId').equals(id).count();
  if (itemCount > 0) {
    throw new Error('Cannot delete category with items. Please delete items first.');
  }

  // Check if major category has sub-categories
  if (category?.type === 'major') {
    const subCatCount = await db.categories.where('parentId').equals(id).count();
    if (subCatCount > 0) {
      throw new Error('Cannot delete major category with sub-categories. Please delete sub-categories first.');
    }
  }

  await db.categories.delete(id);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'categories',
    recordId: id,
    description: `Deleted category: ${category?.name}`,
    before: category,
  });
}

export async function getAllCategories(): Promise<Category[]> {
  return await db.categories.orderBy('sortOrder').toArray();
}

export async function getMajorCategories(): Promise<Category[]> {
  return await db.categories.where('type').equals('major').sortBy('sortOrder');
}

export async function getSubCategories(parentId: string): Promise<Category[]> {
  return await db.categories.where('parentId').equals(parentId).sortBy('sortOrder');
}

// Menu Items
export async function createMenuItem(
  item: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<MenuItem> {
  const newItem: MenuItem = {
    id: createId(),
    ...item,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.menuItems.add(newItem);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'menuItems',
    recordId: newItem.id,
    description: `Created menu item: ${newItem.name}`,
    after: newItem,
  });

  return newItem;
}

export async function updateMenuItem(
  id: string,
  updates: Partial<MenuItem>,
  userId: string
): Promise<void> {
  const before = await db.menuItems.get(id);

  await db.menuItems.update(id, {
    ...updates,
    updatedAt: new Date(),
  });

  const after = await db.menuItems.get(id);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'menuItems',
    recordId: id,
    description: `Updated menu item: ${after?.name}`,
    before,
    after,
  });
}

export async function deleteMenuItem(id: string, userId: string): Promise<void> {
  const item = await db.menuItems.get(id);

  // Delete associated variant links
  await db.menuItemVariants.where('menuItemId').equals(id).delete();

  await db.menuItems.delete(id);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'menuItems',
    recordId: id,
    description: `Deleted menu item: ${item?.name}`,
    before: item,
  });
}

export async function getMenuItemsByCategory(categoryId: string): Promise<MenuItem[]> {
  return await db.menuItems.where('categoryId').equals(categoryId).toArray();
}

export async function getAllMenuItems(): Promise<MenuItem[]> {
  const items = await db.menuItems.toArray();
  return items.filter((item: MenuItem) => item.isActive);
}

// Returns ALL menu items including inactive (for management/admin pages)
export async function getAllMenuItemsUnfiltered(): Promise<MenuItem[]> {
  return await db.menuItems.toArray();
}

// Variants
export async function createVariant(
  variant: Omit<Variant, 'id' | 'createdAt'>,
  userId: string
): Promise<Variant> {
  const newVariant: Variant = {
    id: createId(),
    ...variant,
    createdAt: new Date(),
  };

  await db.variants.add(newVariant);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'variants',
    recordId: newVariant.id,
    description: `Created variant: ${newVariant.name}`,
    after: newVariant,
  });

  return newVariant;
}

export async function updateVariant(
  id: string,
  updates: Partial<Variant>,
  userId: string
): Promise<void> {
  const before = await db.variants.get(id);

  await db.variants.update(id, updates);

  const after = await db.variants.get(id);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'variants',
    recordId: id,
    description: `Updated variant: ${after?.name}`,
    before,
    after,
  });
}

export async function deleteVariant(id: string, userId: string): Promise<void> {
  const variant = await db.variants.get(id);

  // Delete associated options
  await db.variantOptions.where('variantId').equals(id).delete();

  // Delete menu item associations
  await db.menuItemVariants.where('variantId').equals(id).delete();

  await db.variants.delete(id);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'variants',
    recordId: id,
    description: `Deleted variant: ${variant?.name}`,
    before: variant,
  });
}

export async function getAllVariants(): Promise<Variant[]> {
  const variants = await db.variants.orderBy('sortOrder').toArray();
  return variants.filter((v) => v.isActive);
}

// Variant Options
export async function createVariantOption(
  option: Omit<VariantOption, 'id' | 'createdAt'>,
  userId: string
): Promise<VariantOption> {
  const newOption: VariantOption = {
    id: createId(),
    ...option,
    createdAt: new Date(),
  };

  await db.variantOptions.add(newOption);

  await logAudit({
    userId,
    action: 'create',
    tableName: 'variantOptions',
    recordId: newOption.id,
    description: `Created variant option: ${newOption.name}`,
    after: newOption,
  });

  return newOption;
}

export async function getVariantOptions(variantId: string): Promise<VariantOption[]> {
  return await db.variantOptions
    .where('variantId')
    .equals(variantId)
    .sortBy('sortOrder');
}

export async function deleteVariantOption(id: string, userId: string): Promise<void> {
  const option = await db.variantOptions.get(id);

  if (option) {
    await db.variantOptions.delete(option.variantId, id);
  }

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'variantOptions',
    recordId: id,
    description: `Deleted variant option: ${option?.name}`,
    before: option,
  });
}

// Menu Item Variants (linking variants to menu items)
export async function getMenuItemVariants(menuItemId: string): Promise<MenuItemVariant[]> {
  return await db.menuItemVariants.where('menuItemId').equals(menuItemId).toArray();
}

export async function setMenuItemVariants(
  menuItemId: string,
  variantIds: { variantId: string; isRequired: boolean; selectionMode: SelectionMode; availableOptionIds: string[] }[],
  userId: string
): Promise<void> {
  // Delete existing links
  await db.menuItemVariants.where('menuItemId').equals(menuItemId).delete();

  // Create new links
  for (const { variantId, isRequired, selectionMode, availableOptionIds } of variantIds) {
    const newLink: MenuItemVariant = {
      id: createId(),
      menuItemId,
      variantId,
      isRequired,
      selectionMode,
      availableOptionIds,
      createdAt: new Date(),
    };
    await db.menuItemVariants.add(newLink);
  }

  await logAudit({
    userId,
    action: 'update',
    tableName: 'menuItemVariants',
    recordId: menuItemId,
    description: `Updated variants for menu item: ${menuItemId}`,
    after: variantIds,
  });
}

// Deals
export async function createDeal(
  deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>,
  dealItems: Omit<DealItem, 'id' | 'dealId' | 'createdAt'>[],
  userId: string
): Promise<Deal> {
  const newDeal: Deal = {
    id: createId(),
    ...deal,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.transaction('rw', [db.deals, db.dealItems], async () => {
    await db.deals.add(newDeal);

    for (const item of dealItems) {
      await db.dealItems.add({
        id: createId(),
        dealId: newDeal.id,
        ...item,
        createdAt: new Date(),
      });
    }
  });

  await logAudit({
    userId,
    action: 'create',
    tableName: 'deals',
    recordId: newDeal.id,
    description: `Created deal: ${newDeal.name}`,
    after: newDeal,
  });

  return newDeal;
}

export async function updateDeal(
  id: string,
  updates: Partial<Deal>,
  userId: string
): Promise<void> {
  const before = await db.deals.get(id);

  await db.deals.update(id, {
    ...updates,
    updatedAt: new Date(),
  });

  const after = await db.deals.get(id);

  await logAudit({
    userId,
    action: 'update',
    tableName: 'deals',
    recordId: id,
    description: `Updated deal: ${after?.name}`,
    before,
    after,
  });
}

export async function deleteDeal(id: string, userId: string): Promise<void> {
  const deal = await db.deals.get(id);

  // Delete associated items
  await db.dealItems.where('dealId').equals(id).delete();
  await db.dealVariants.where('dealId').equals(id).delete();

  await db.deals.delete(id);

  await logAudit({
    userId,
    action: 'delete',
    tableName: 'deals',
    recordId: id,
    description: `Deleted deal: ${deal?.name}`,
    before: deal,
  });
}

export async function getAllDeals(): Promise<Deal[]> {
  const deals = await db.deals.toArray();
  return deals.filter((deal: Deal) => deal.isActive);
}

export async function getDealItems(dealId: string): Promise<DealItem[]> {
  return await db.dealItems.where('dealId').equals(dealId).sortBy('sortOrder');
}

// Deal Variants (linking variants to deals)
export async function getDealVariants(dealId: string): Promise<DealVariant[]> {
  return await db.dealVariants.where('dealId').equals(dealId).toArray();
}

export async function setDealVariants(
  dealId: string,
  variantIds: { variantId: string; isRequired: boolean; selectionMode: SelectionMode; availableOptionIds: string[] }[],
  userId: string
): Promise<void> {
  // Delete existing links
  await db.dealVariants.where('dealId').equals(dealId).delete();

  // Create new links
  for (const { variantId, isRequired, selectionMode, availableOptionIds } of variantIds) {
    const newLink: DealVariant = {
      id: createId(),
      dealId,
      variantId,
      isRequired,
      selectionMode,
      availableOptionIds,
      createdAt: new Date(),
    };
    await db.dealVariants.add(newLink);
  }

  await logAudit({
    userId,
    action: 'update',
    tableName: 'dealVariants',
    recordId: dealId,
    description: `Updated variants for deal: ${dealId}`,
    after: variantIds,
  });
}
