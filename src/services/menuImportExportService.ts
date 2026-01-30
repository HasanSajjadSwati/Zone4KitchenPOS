import { db } from '@/db';
import { logAudit } from '@/utils/audit';
import type { Category, MenuItem, Variant, VariantOption, Deal, DealItem, MenuItemVariant } from '@/db/types';

export interface MenuExportData {
  version: string;
  timestamp: Date;
  data: {
    categories: Category[];
    menuItems: MenuItem[];
    menuItemVariants: MenuItemVariant[];
    variants: Variant[];
    variantOptions: VariantOption[];
    deals: Deal[];
    dealItems: DealItem[];
  };
}

export async function exportMenuData(userId: string): Promise<MenuExportData> {
  const exportData: MenuExportData = {
    version: '1.0.0',
    timestamp: new Date(),
    data: {
      categories: await db.categories.toArray(),
      menuItems: await db.menuItems.toArray(),
      menuItemVariants: await db.menuItemVariants.toArray(),
      variants: await db.variants.toArray(),
      variantOptions: await db.variantOptions.toArray(),
      deals: await db.deals.toArray(),
      dealItems: await db.dealItems.toArray(),
    },
  };

  await logAudit({
    userId,
    action: 'export',
    tableName: 'menu',
    recordId: 'export',
    description: 'Exported menu data',
  });

  return exportData;
}

export function downloadMenuData(exportData: MenuExportData): void {
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `menu-export-${timestamp}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importMenuData(
  menuData: MenuExportData,
  userId: string,
  options: {
    replaceExisting: boolean;
  }
): Promise<void> {
  if (options.replaceExisting) {
    // Clear menu-related tables in dependency order
    await db.transaction('rw', [
      db.dealVariants,
      db.menuItemVariants,
      db.dealItems,
      db.variantOptions,
      db.deals,
      db.menuItems,
      db.categories,
      db.variants,
    ], async () => {
      await db.dealVariants.clear();
      await db.menuItemVariants.clear();
      await db.dealItems.clear();
      await db.variantOptions.clear();
      await db.deals.clear();
      await db.menuItems.clear();
      await db.categories.clear();
      await db.variants.clear();
    });
  }

  // Import menu data
  await db.transaction('rw', [
    db.categories,
    db.menuItems,
    db.menuItemVariants,
    db.variants,
    db.variantOptions,
    db.deals,
    db.dealItems,
  ], async () => {
    if (menuData.data.categories.length > 0) {
      await db.categories.bulkPut(menuData.data.categories);
    }
    if (menuData.data.variants.length > 0) {
      await db.variants.bulkPut(menuData.data.variants);
    }
    if (menuData.data.variantOptions.length > 0) {
      await db.variantOptions.bulkPut(menuData.data.variantOptions);
    }
    if (menuData.data.menuItems.length > 0) {
      await db.menuItems.bulkPut(menuData.data.menuItems);
    }
    if (menuData.data.menuItemVariants.length > 0) {
      await db.menuItemVariants.bulkPut(menuData.data.menuItemVariants);
    }
    if (menuData.data.deals.length > 0) {
      await db.deals.bulkPut(menuData.data.deals);
    }
    if (menuData.data.dealItems.length > 0) {
      await db.dealItems.bulkPut(menuData.data.dealItems);
    }
  });

  await logAudit({
    userId,
    action: 'import',
    tableName: 'menu',
    recordId: 'import',
    description: `Imported menu data from ${menuData.timestamp}`,
  });
}
