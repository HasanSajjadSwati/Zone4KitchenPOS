// Database API Compatibility Layer
// The application now uses the backend API (PostgreSQL via Node.js/Express)
// This file provides a compatibility layer for gradual migration

import { apiClient } from '@/services/api';

export * from './types';

// Helper to create orderBy() chains
const createOrderBy = (fetchFn: () => Promise<any[]>) => {
  return (sortField: string) => ({
    toArray: async () => {
      const all = await fetchFn();
      return all.sort((a: any, b: any) => {
        if (a[sortField] < b[sortField]) return -1;
        if (a[sortField] > b[sortField]) return 1;
        return 0;
      });
    },
    limit: (n: number) => ({
      toArray: async () => {
        const all = await fetchFn();
        return all.sort((a: any, b: any) => {
          if (a[sortField] < b[sortField]) return -1;
          if (a[sortField] > b[sortField]) return 1;
          return 0;
        }).slice(0, n);
      },
    }),
    reverse: () => ({
      toArray: async () => {
        const all = await fetchFn();
        return all.sort((a: any, b: any) => {
          if (a[sortField] < b[sortField]) return 1;
          if (a[sortField] > b[sortField]) return -1;
          return 0;
        });
      },
      first: async () => {
        const all = await fetchFn();
        const sorted = all.sort((a: any, b: any) => {
          if (a[sortField] < b[sortField]) return 1;
          if (a[sortField] > b[sortField]) return -1;
          return 0;
        });
        return sorted[0] || null;
      },
      limit: (n: number) => ({
        toArray: async () => {
          const all = await fetchFn();
          return all.sort((a: any, b: any) => {
            if (a[sortField] < b[sortField]) return 1;
            if (a[sortField] > b[sortField]) return -1;
            return 0;
          }).slice(0, n);
        },
      }),
    }),
    first: async () => {
      const all = await fetchFn();
      const sorted = all.sort((a: any, b: any) => {
        if (a[sortField] < b[sortField]) return -1;
        if (a[sortField] > b[sortField]) return 1;
        return 0;
      });
      return sorted[0] || null;
    },
  });
};

// Helper to create table-level reverse() chain
const createReverse = (fetchFn: () => Promise<any[]>) => {
  return () => ({
    toArray: async () => {
      const all = await fetchFn();
      return all.reverse();
    },
    sortBy: (sortField: string) => {
      return (async () => {
        const all = await fetchFn();
        return all.sort((a: any, b: any) => {
          if (a[sortField] < b[sortField]) return 1;
          if (a[sortField] > b[sortField]) return -1;
          return 0;
        });
      })();
    },
    first: async () => {
      const all = await fetchFn();
      return all.reverse()[0] || null;
    },
  });
};

// Helper to create where().equals() and where().between() chains
const createWhereEquals = (fetchFn: () => Promise<any[]>) => {
  return (fieldName: string) => ({
    equals: (value: any) => ({
      first: async () => {
        const all = await fetchFn();
        return all.find((item: any) => item[fieldName] === value) || null;
      },
      toArray: async () => {
        const all = await fetchFn();
        return all.filter((item: any) => item[fieldName] === value);
      },
      count: async () => {
        const all = await fetchFn();
        return all.filter((item: any) => item[fieldName] === value).length;
      },
      delete: async () => {
        const all = await fetchFn();
        const filtered = all.filter((item: any) => item[fieldName] === value);
        // Note: bulk delete not yet implemented, would need API support
        return filtered.length;
      },
      sortBy: (sortField: string) => {
        return (async () => {
          const all = await fetchFn();
          return all
            .filter((item: any) => item[fieldName] === value)
            .sort((a: any, b: any) => {
              if (a[sortField] < b[sortField]) return -1;
              if (a[sortField] > b[sortField]) return 1;
              return 0;
            });
        })();
      },
      reverse: () => ({
        toArray: async () => {
          const all = await fetchFn();
          return all
            .filter((item: any) => item[fieldName] === value)
            .reverse();
        },
        sortBy: (sortField: string) => {
          return (async () => {
            const all = await fetchFn();
            return all
              .filter((item: any) => item[fieldName] === value)
              .sort((a: any, b: any) => {
                if (a[sortField] < b[sortField]) return 1;
                if (a[sortField] > b[sortField]) return -1;
                return 0;
              });
          })();
        },
      }),
      and: (filterFn: (item: any) => boolean) => ({
        toArray: async () => {
          const all = await fetchFn();
          return all.filter((item: any) => item[fieldName] === value && filterFn(item));
        },
        count: async () => {
          const all = await fetchFn();
          return all.filter((item: any) => item[fieldName] === value && filterFn(item)).length;
        },
        first: async () => {
          const all = await fetchFn();
          return all.find((item: any) => item[fieldName] === value && filterFn(item)) || null;
        },
      }),
    }),
    between: (lowerBound: any, upperBound: any) => ({
      toArray: async () => {
        const all = await fetchFn();
        return all.filter((item: any) => {
          const val = item[fieldName];
          return val >= lowerBound && val <= upperBound;
        });
      },
      count: async () => {
        const all = await fetchFn();
        return all.filter((item: any) => {
          const val = item[fieldName];
          return val >= lowerBound && val <= upperBound;
        }).length;
      },
      first: async () => {
        const all = await fetchFn();
        return all.find((item: any) => {
          const val = item[fieldName];
          return val >= lowerBound && val <= upperBound;
        }) || null;
      },
      sortBy: (sortField: string) => {
        return (async () => {
          const all = await fetchFn();
          return all
            .filter((item: any) => {
              const val = item[fieldName];
              return val >= lowerBound && val <= upperBound;
            })
            .sort((a: any, b: any) => {
              if (a[sortField] < b[sortField]) return -1;
              if (a[sortField] > b[sortField]) return 1;
              return 0;
            });
        })();
      },
      reverse: async () => {
        const all = await fetchFn();
        return all
          .filter((item: any) => {
            const val = item[fieldName];
            return val >= lowerBound && val <= upperBound;
          })
          .reverse();
      },
    }),
    aboveOrEqual: (value: any) => ({
      toArray: async () => {
        const all = await fetchFn();
        return all.filter((item: any) => {
          const val = item[fieldName];
          // Handle date comparison
          if (value instanceof Date) {
            const itemDate = new Date(val);
            return itemDate >= value;
          }
          return val >= value;
        });
      },
      count: async () => {
        const all = await fetchFn();
        return all.filter((item: any) => {
          const val = item[fieldName];
          if (value instanceof Date) {
            const itemDate = new Date(val);
            return itemDate >= value;
          }
          return val >= value;
        }).length;
      },
      first: async () => {
        const all = await fetchFn();
        return all.find((item: any) => {
          const val = item[fieldName];
          if (value instanceof Date) {
            const itemDate = new Date(val);
            return itemDate >= value;
          }
          return val >= value;
        }) || null;
      },
      reverse: () => ({
        toArray: async () => {
          const all = await fetchFn();
          return all
            .filter((item: any) => {
              const val = item[fieldName];
              if (value instanceof Date) {
                const itemDate = new Date(val);
                return itemDate >= value;
              }
              return val >= value;
            })
            .reverse();
        },
        sortBy: (sortField: string) => {
          return (async () => {
            const all = await fetchFn();
            return all
              .filter((item: any) => {
                const val = item[fieldName];
                if (value instanceof Date) {
                  const itemDate = new Date(val);
                  return itemDate >= value;
                }
                return val >= value;
              })
              .sort((a: any, b: any) => {
                if (a[sortField] < b[sortField]) return 1;
                if (a[sortField] > b[sortField]) return -1;
                return 0;
              });
          })();
        },
      }),
    }),
    anyOf: (values: any[]) => ({
      toArray: async () => {
        const all = await fetchFn();
        return all.filter((item: any) => values.includes(item[fieldName]));
      },
      count: async () => {
        const all = await fetchFn();
        return all.filter((item: any) => values.includes(item[fieldName])).length;
      },
      first: async () => {
        const all = await fetchFn();
        return all.find((item: any) => values.includes(item[fieldName])) || null;
      },
      delete: async () => {
        const all = await fetchFn();
        const filtered = all.filter((item: any) => values.includes(item[fieldName]));
        return filtered.length;
      },
      and: (filterFn: (item: any) => boolean) => ({
        toArray: async () => {
          const all = await fetchFn();
          return all.filter((item: any) => values.includes(item[fieldName]) && filterFn(item));
        },
        count: async () => {
          const all = await fetchFn();
          return all.filter((item: any) => values.includes(item[fieldName]) && filterFn(item)).length;
        },
        first: async () => {
          const all = await fetchFn();
          return all.find((item: any) => values.includes(item[fieldName]) && filterFn(item)) || null;
        },
      }),
    }),
    toArray: async () => {
      return fetchFn();
    },
  });
};

// Stub db object for backward compatibility
// Each property maps to the API client
export const db = {
  // Users table proxy
  users: {
    toArray: async () => apiClient.getUsers(),
    get: async (id: string) => apiClient.getUser(id),
    add: async (user: any) => apiClient.createUser(user),
    put: async (user: any) => apiClient.updateUser(user.id, user),
    update: async (id: string, changes: any) => apiClient.updateUser(id, changes),
    delete: async (id: string) => apiClient.deleteUser(id),
    clear: async () => {
      const all = await apiClient.getUsers();
      await Promise.all(all.map((u: any) => apiClient.deleteUser(u.id)));
    },
    bulkAdd: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createUser(item)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createUser(item)));
    },
    where: createWhereEquals(() => apiClient.getUsers()),
  },

  // Roles table proxy
  roles: {
    toArray: async () => apiClient.getRoles(),
    get: async (id: string) => apiClient.getRole(id),
    add: async (role: any) => apiClient.createRole(role),
    put: async (role: any) => apiClient.updateRole(role.id, role),
    update: async (id: string, changes: any) => apiClient.updateRole(id, changes),
    delete: async (id: string) => apiClient.deleteRole(id),
  },

  // Categories table proxy
  categories: {
    toArray: async () => apiClient.getCategories(),
    get: async (id: string) => apiClient.getCategory(id),
    add: async (category: any) => apiClient.createCategory(category),
    put: async (category: any) => apiClient.updateCategory(category.id, category),
    update: async (id: string, changes: any) => apiClient.updateCategory(id, changes),
    delete: async (id: string) => apiClient.deleteCategory(id),
    clear: async () => {
      const all = await apiClient.getCategories();
      await Promise.all(all.map((c: any) => apiClient.deleteCategory(c.id)));
    },
    bulkAdd: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createCategory(item)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createCategory(item)));
    },
    where: createWhereEquals(() => apiClient.getCategories()),
    orderBy: createOrderBy(() => apiClient.getCategories()),
  },

  // Menu Items table proxy
  menuItems: {
    toArray: async () => apiClient.getMenuItems(),
    get: async (id: string) => apiClient.getMenuItem(id),
    add: async (item: any) => apiClient.createMenuItem(item),
    put: async (item: any) => apiClient.updateMenuItem(item.id, item),
    update: async (id: string, changes: any) => apiClient.updateMenuItem(id, changes),
    delete: async (id: string) => apiClient.deleteMenuItem(id),
    clear: async () => {
      const all = await apiClient.getMenuItems();
      await Promise.all(all.map((m: any) => apiClient.deleteMenuItem(m.id)));
    },
    bulkAdd: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createMenuItem(item)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createMenuItem(item)));
    },
    where: createWhereEquals(() => apiClient.getMenuItems()),
  },

  // Variants table proxy
  variants: {
    toArray: async () => apiClient.getVariants(),
    get: async (id: string) => apiClient.getVariant(id),
    add: async (variant: any) => apiClient.createVariant(variant),
    put: async (variant: any) => apiClient.updateVariant(variant.id, variant),
    update: async (id: string, changes: any) => apiClient.updateVariant(id, changes),
    delete: async (id: string) => apiClient.deleteVariant(id),
    clear: async () => {
      const all = await apiClient.getVariants();
      await Promise.all(all.map((v: any) => apiClient.deleteVariant(v.id)));
    },
    bulkAdd: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createVariant(item)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createVariant(item)));
    },
    orderBy: createOrderBy(() => apiClient.getVariants()),
  },

  // Variant Options table proxy
  variantOptions: {
    toArray: async () => {
      // Get all variants and collect their options
      const variants = await apiClient.getVariants();
      const allOptions: any[] = [];
      for (const variant of variants) {
        const options = await apiClient.getVariantOptions(variant.id);
        allOptions.push(...options);
      }
      return allOptions;
    },
    get: async (id: string) => {
      const variants = await apiClient.getVariants();
      for (const variant of variants) {
        const options = await apiClient.getVariantOptions(variant.id);
        const option = options.find((o: any) => o.id === id);
        if (option) return option;
      }
      return null;
    },
    add: async (option: any) => {
      return apiClient.createVariantOption(option.variantId, option);
    },
    update: async (variantId: string, optionId: string, changes: any) => {
      return apiClient.updateVariantOption(variantId, optionId, changes);
    },
    delete: async (variantId: string, optionId: string) => {
      return apiClient.deleteVariantOption(variantId, optionId);
    },
    clear: async () => {
      const variants = await apiClient.getVariants();
      for (const variant of variants) {
        const options = await apiClient.getVariantOptions(variant.id);
        for (const option of options) {
          await apiClient.deleteVariantOption(variant.id, option.id);
        }
      }
    },
    bulkAdd: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createVariantOption(item.variantId, item)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createVariantOption(item.variantId, item)));
    },
    where: (fieldName: string) => ({
      equals: (value: any) => ({
        first: async () => {
          if (fieldName === 'variantId') {
            const options = await apiClient.getVariantOptions(value);
            return options[0] || null;
          }
          return null;
        },
        toArray: async () => {
          if (fieldName === 'variantId') {
            return apiClient.getVariantOptions(value);
          }
          return [];
        },
        count: async () => {
          if (fieldName === 'variantId') {
            const options = await apiClient.getVariantOptions(value);
            return options.length;
          }
          return 0;
        },
        delete: async () => {
          if (fieldName === 'variantId') {
            const options = await apiClient.getVariantOptions(value);
            for (const option of options) {
              await apiClient.deleteVariantOption(value, option.id);
            }
            return options.length;
          }
          return 0;
        },
        sortBy: (sortField: string) => {
          return (async () => {
            if (fieldName === 'variantId') {
              const options = await apiClient.getVariantOptions(value);
              return options.sort((a: any, b: any) => {
                if (a[sortField] < b[sortField]) return -1;
                if (a[sortField] > b[sortField]) return 1;
                return 0;
              });
            }
            return [];
          })();
        },
        reverse: async () => {
          if (fieldName === 'variantId') {
            const options = await apiClient.getVariantOptions(value);
            return options.reverse();
          }
          return [];
        },
      }),
      between: (lowerBound: any, upperBound: any) => {
        void lowerBound;
        void upperBound;
        return {
          toArray: async () => [],
          count: async () => 0,
          first: async () => null,
          sortBy: (sortField: string) => {
            void sortField;
            return Promise.resolve([]);
          },
          reverse: async () => [],
        };
      },
      anyOf: (values: any[]) => {
        void values;
        return {
          toArray: async () => [],
          count: async () => 0,
          first: async () => null,
          delete: async () => 0,
        };
      },
      toArray: async () => [],
    }),
  },

  // Menu Item Variants table proxy
  menuItemVariants: {
    toArray: async () => {
      // Get all menu items and collect their variants
      const menuItems = await apiClient.getMenuItems();
      const allVariants: any[] = [];
      for (const item of menuItems) {
        if (item.hasVariants) {
          const variants = await apiClient.getMenuItemVariants(item.id);
          allVariants.push(...variants);
        }
      }
      return allVariants;
    },
    get: async (id: string) => {
      void id;
      return null;
    },
    add: async (item: any) => {
      return apiClient.addMenuItemVariant(item.menuItemId, item);
    },
    update: async (menuItemId: string, variantId: string, changes: any) => {
      return apiClient.updateMenuItemVariant(menuItemId, variantId, changes);
    },
    delete: async (menuItemId: string, variantId: string) => {
      return apiClient.deleteMenuItemVariant(menuItemId, variantId);
    },
    clear: async () => {
      const menuItems = await apiClient.getMenuItems();
      for (const item of menuItems) {
        const variants = await apiClient.getMenuItemVariants(item.id);
        for (const variant of variants) {
          await apiClient.deleteMenuItemVariant(item.id, variant.variantId);
        }
      }
    },
    bulkAdd: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.addMenuItemVariant(item.menuItemId, item)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.addMenuItemVariant(item.menuItemId, item)));
    },
    where: (fieldName: string) => ({
      equals: (value: any) => ({
        first: async () => {
          if (fieldName === 'menuItemId') {
            const variants = await apiClient.getMenuItemVariants(value);
            return variants[0] || null;
          }
          return null;
        },
        toArray: async () => {
          if (fieldName === 'menuItemId') {
            return apiClient.getMenuItemVariants(value);
          }
          return [];
        },
        count: async () => {
          if (fieldName === 'menuItemId') {
            const variants = await apiClient.getMenuItemVariants(value);
            return variants.length;
          }
          return 0;
        },
        delete: async () => {
          if (fieldName === 'menuItemId') {
            const variants = await apiClient.getMenuItemVariants(value);
            for (const v of variants) {
              await apiClient.deleteMenuItemVariant(value, v.variantId);
            }
            return variants.length;
          }
          return 0;
        },
        sortBy: (sortField: string) => {
          return (async () => {
            if (fieldName === 'menuItemId') {
              const variants = await apiClient.getMenuItemVariants(value);
              return variants.sort((a: any, b: any) => {
                if (a[sortField] < b[sortField]) return -1;
                if (a[sortField] > b[sortField]) return 1;
                return 0;
              });
            }
            return [];
          })();
        },
        reverse: async () => {
          if (fieldName === 'menuItemId') {
            const variants = await apiClient.getMenuItemVariants(value);
            return variants.reverse();
          }
          return [];
        },
      }),
      between: (lowerBound: any, upperBound: any) => {
        void lowerBound;
        void upperBound;
        return {
          toArray: async () => [],
          count: async () => 0,
          first: async () => null,
          sortBy: (sortField: string) => {
            void sortField;
            return Promise.resolve([]);
          },
          reverse: async () => [],
        };
      },
      anyOf: (values: any[]) => {
        void values;
        return {
          toArray: async () => [],
          count: async () => 0,
          first: async () => null,
          delete: async () => 0,
        };
      },
      toArray: async () => [],
    }),
  },

  // Deals table proxy
  deals: {
    toArray: async () => apiClient.getDeals(),
    get: async (id: string) => apiClient.getDeal(id),
    add: async (deal: any) => apiClient.createDeal(deal),
    put: async (deal: any) => apiClient.updateDeal(deal.id, deal),
    update: async (id: string, changes: any) => apiClient.updateDeal(id, changes),
    delete: async (id: string) => apiClient.deleteDeal(id),
    clear: async () => {
      const all = await apiClient.getDeals();
      await Promise.all(all.map((d: any) => apiClient.deleteDeal(d.id)));
    },
    bulkAdd: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createDeal(item)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createDeal(item)));
    },
  },

  // Deal Items table proxy
  dealItems: {
    toArray: async () => {
      // Get all deals and collect their items
      const deals = await apiClient.getDeals();
      const allItems: any[] = [];
      for (const deal of deals) {
        const items = await apiClient.getDealItems(deal.id);
        allItems.push(...items);
      }
      return allItems;
    },
    get: async (id: string) => {
      const deals = await apiClient.getDeals();
      for (const deal of deals) {
        const items = await apiClient.getDealItems(deal.id);
        const item = items.find((i: any) => i.id === id);
        if (item) return item;
      }
      return null;
    },
    add: async (item: any) => {
      return apiClient.addDealItem(item.dealId, item);
    },
    update: async (dealId: string, itemId: string, changes: any) => {
      return apiClient.updateDealItem(dealId, itemId, changes);
    },
    delete: async (dealId: string, itemId: string) => {
      return apiClient.deleteDealItem(dealId, itemId);
    },
    clear: async () => {
      const deals = await apiClient.getDeals();
      for (const deal of deals) {
        const items = await apiClient.getDealItems(deal.id);
        for (const item of items) {
          await apiClient.deleteDealItem(deal.id, item.id);
        }
      }
    },
    bulkAdd: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.addDealItem(item.dealId, item)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.addDealItem(item.dealId, item)));
    },
    where: (fieldName: string) => ({
      equals: (value: any) => ({
        first: async () => {
          if (fieldName === 'dealId') {
            const items = await apiClient.getDealItems(value);
            return items[0] || null;
          }
          return null;
        },
        toArray: async () => {
          if (fieldName === 'dealId') {
            return apiClient.getDealItems(value);
          }
          return [];
        },
        count: async () => {
          if (fieldName === 'dealId') {
            const items = await apiClient.getDealItems(value);
            return items.length;
          }
          return 0;
        },
        delete: async () => {
          if (fieldName === 'dealId') {
            const items = await apiClient.getDealItems(value);
            for (const item of items) {
              await apiClient.deleteDealItem(value, item.id);
            }
            return items.length;
          }
          return 0;
        },
        sortBy: (sortField: string) => {
          return (async () => {
            if (fieldName === 'dealId') {
              const items = await apiClient.getDealItems(value);
              return items.sort((a: any, b: any) => {
                if (a[sortField] < b[sortField]) return -1;
                if (a[sortField] > b[sortField]) return 1;
                return 0;
              });
            }
            return [];
          })();
        },
        reverse: async () => {
          if (fieldName === 'dealId') {
            const items = await apiClient.getDealItems(value);
            return items.reverse();
          }
          return [];
        },
      }),
      between: (lowerBound: any, upperBound: any) => {
        void lowerBound;
        void upperBound;
        return {
          toArray: async () => [],
          count: async () => 0,
          first: async () => null,
          sortBy: (sortField: string) => {
            void sortField;
            return Promise.resolve([]);
          },
          reverse: async () => [],
        };
      },
      anyOf: (values: any[]) => {
        void values;
        return {
          toArray: async () => [],
          count: async () => 0,
          first: async () => null,
          delete: async () => 0,
        };
      },
      toArray: async () => [],
    }),
  },

  // Deal Variants table proxy
  dealVariants: {
    toArray: async () => {
      // Get all deals and collect their variants
      const deals = await apiClient.getDeals();
      const allVariants: any[] = [];
      for (const deal of deals) {
        if (deal.hasVariants) {
          const variants = await apiClient.getDealVariants(deal.id);
          allVariants.push(...variants);
        }
      }
      return allVariants;
    },
    get: async (id: string) => {
      void id;
      return null;
    },
    add: async (item: any) => {
      return apiClient.addDealVariant(item.dealId, item);
    },
    update: async (dealId: string, variantId: string, changes: any) => {
      return apiClient.updateDealVariant(dealId, variantId, changes);
    },
    delete: async (dealId: string, variantId: string) => {
      return apiClient.deleteDealVariant(dealId, variantId);
    },
    clear: async () => {},
    where: (fieldName: string) => ({
      equals: (value: any) => ({
        first: async () => {
          if (fieldName === 'dealId') {
            const variants = await apiClient.getDealVariants(value);
            return variants[0] || null;
          }
          return null;
        },
        toArray: async () => {
          if (fieldName === 'dealId') {
            return apiClient.getDealVariants(value);
          }
          return [];
        },
        count: async () => {
          if (fieldName === 'dealId') {
            const variants = await apiClient.getDealVariants(value);
            return variants.length;
          }
          return 0;
        },
        delete: async () => {
          if (fieldName === 'dealId') {
            const variants = await apiClient.getDealVariants(value);
            for (const v of variants) {
              await apiClient.deleteDealVariant(value, v.variantId);
            }
            return variants.length;
          }
          return 0;
        },
        sortBy: (sortField: string) => {
          return (async () => {
            if (fieldName === 'dealId') {
              const variants = await apiClient.getDealVariants(value);
              return variants.sort((a: any, b: any) => {
                if (a[sortField] < b[sortField]) return -1;
                if (a[sortField] > b[sortField]) return 1;
                return 0;
              });
            }
            return [];
          })();
        },
        reverse: async () => {
          if (fieldName === 'dealId') {
            const variants = await apiClient.getDealVariants(value);
            return variants.reverse();
          }
          return [];
        },
      }),
      between: (lowerBound: any, upperBound: any) => {
        void lowerBound;
        void upperBound;
        return {
          toArray: async () => [],
          count: async () => 0,
          first: async () => null,
          sortBy: (sortField: string) => {
            void sortField;
            return Promise.resolve([]);
          },
          reverse: async () => [],
        };
      },
      anyOf: (values: any[]) => {
        void values;
        return {
          toArray: async () => [],
          count: async () => 0,
          first: async () => null,
          delete: async () => 0,
        };
      },
      toArray: async () => [],
    }),
  },

  // Customers table proxy
  customers: {
    toArray: async () => apiClient.getCustomers(),
    get: async (id: string) => apiClient.getCustomer(id),
    add: async (customer: any) => apiClient.createCustomer(customer),
    put: async (customer: any) => apiClient.updateCustomer(customer.id, customer),
    update: async (id: string, changes: any) => apiClient.updateCustomer(id, changes),
    delete: async (id: string) => apiClient.deleteCustomer(id),
    clear: async () => {
      const all = await apiClient.getCustomers();
      await Promise.all(all.map((c: any) => apiClient.deleteCustomer(c.id)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createCustomer(item)));
    },
    where: createWhereEquals(() => apiClient.getCustomers()),
    orderBy: createOrderBy(() => apiClient.getCustomers()),
  },

  // Waiters table proxy
  waiters: {
    toArray: async () => apiClient.getWaiters(),
    get: async (id: string) => apiClient.getWaiter(id),
    add: async (waiter: any) => apiClient.createWaiter(waiter),
    put: async (waiter: any) => apiClient.updateWaiter(waiter.id, waiter),
    update: async (id: string, changes: any) => apiClient.updateWaiter(id, changes),
    delete: async (id: string) => apiClient.deleteWaiter(id),
    clear: async () => {
      const all = await apiClient.getWaiters();
      await Promise.all(all.map((w: any) => apiClient.deleteWaiter(w.id)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createWaiter(item)));
    },
    where: createWhereEquals(() => apiClient.getWaiters()),
    filter: (filterFn: (item: any) => boolean) => ({
      toArray: async () => {
        const all = await apiClient.getWaiters();
        return all.filter(filterFn);
      },
      count: async () => {
        const all = await apiClient.getWaiters();
        return all.filter(filterFn).length;
      },
      first: async () => {
        const all = await apiClient.getWaiters();
        return all.find(filterFn) || null;
      },
    }),
  },

  // Riders table proxy
  riders: {
    toArray: async () => apiClient.getRiders(),
    get: async (id: string) => apiClient.getRider(id),
    add: async (rider: any) => apiClient.createRider(rider),
    put: async (rider: any) => apiClient.updateRider(rider.id, rider),
    update: async (id: string, changes: any) => apiClient.updateRider(id, changes),
    delete: async (id: string) => apiClient.deleteRider(id),
    clear: async () => {
      const all = await apiClient.getRiders();
      await Promise.all(all.map((r: any) => apiClient.deleteRider(r.id)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createRider(item)));
    },
    where: createWhereEquals(() => apiClient.getRiders()),
    filter: (filterFn: (item: any) => boolean) => ({
      toArray: async () => {
        const all = await apiClient.getRiders();
        return all.filter(filterFn);
      },
      count: async () => {
        const all = await apiClient.getRiders();
        return all.filter(filterFn).length;
      },
      first: async () => {
        const all = await apiClient.getRiders();
        return all.find(filterFn) || null;
      },
    }),
  },

  // Dining Tables proxy
  diningTables: {
    toArray: async () => apiClient.getDiningTables(),
    get: async (id: string) => apiClient.getDiningTable(id),
    add: async (table: any) => apiClient.createDiningTable(table),
    put: async (table: any) => apiClient.updateDiningTable(table.id, table),
    update: async (id: string, changes: any) => apiClient.updateDiningTable(id, changes),
    delete: async (id: string) => apiClient.deleteDiningTable(id),
    clear: async () => {
      const all = await apiClient.getDiningTables();
      await Promise.all(all.map((t: any) => apiClient.deleteDiningTable(t.id)));
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createDiningTable(item)));
    },
    where: createWhereEquals(() => apiClient.getDiningTables()),
    filter: (filterFn: (item: any) => boolean) => ({
      toArray: async () => {
        const all = await apiClient.getDiningTables();
        return all.filter(filterFn);
      },
      count: async () => {
        const all = await apiClient.getDiningTables();
        return all.filter(filterFn).length;
      },
      first: async () => {
        const all = await apiClient.getDiningTables();
        return all.find(filterFn) || null;
      },
    }),
  },

  // Register Sessions proxy
  registerSessions: {
    toArray: async () => apiClient.getRegisterSessions(),
    get: async (id: string) => apiClient.getRegisterSession(id),
    add: async (session: any) => apiClient.createRegisterSession(session),
    put: async (session: any) => apiClient.updateRegisterSession(session.id, session),
    update: async (id: string, changes: any) => apiClient.updateRegisterSession(id, changes),
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createRegisterSession(item)));
    },
    where: createWhereEquals(() => apiClient.getRegisterSessions()),
    orderBy: createOrderBy(() => apiClient.getRegisterSessions()),
  },

  // Orders table proxy
  orders: {
    toArray: async () => apiClient.getOrders(),
    get: async (id: string) => apiClient.getOrder(id),
    add: async (order: any) => apiClient.createOrder(order),
    put: async (order: any) => apiClient.updateOrder(order.id, order),
    update: async (id: string, changes: any) => apiClient.updateOrder(id, changes),
    clear: async () => {
      // Orders are not deleted in this system (they're archived/cancelled)
      // This is a no-op for now
    },
    filter: (filterFn: (item: any) => boolean) => ({
      toArray: async () => {
        const all = await apiClient.getOrders();
        return all.filter(filterFn);
      },
      count: async () => {
        const all = await apiClient.getOrders();
        return all.filter(filterFn).length;
      },
      first: async () => {
        const all = await apiClient.getOrders();
        return all.find(filterFn) || null;
      },
    }),
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createOrder(item)));
    },
    where: createWhereEquals(() => apiClient.getOrders()),
    orderBy: createOrderBy(() => apiClient.getOrders()),
  },

  // Order Items proxy
  orderItems: {
    toArray: async () => {
      // Get all orders and collect items
      const orders = await apiClient.getOrders();
      const allItems: any[] = [];
      for (const order of orders) {
        const items = await apiClient.getOrderItems(order.id);
        allItems.push(...items);
      }
      return allItems;
    },
    get: async (id: string) => {
      // Get all orders and find the item
      const orders = await apiClient.getOrders();
      for (const order of orders) {
        const items = await apiClient.getOrderItems(order.id);
        const item = items.find((i: any) => i.id === id);
        if (item) return item;
      }
      return null;
    },
    add: async (item: any) => {
      return apiClient.addOrderItem(item.orderId, item);
    },
    update: async (id: string, changes: any) => {
      // Find the item's order first
      const orders = await apiClient.getOrders();
      for (const order of orders) {
        const items = await apiClient.getOrderItems(order.id);
        const item = items.find((i: any) => i.id === id);
        if (item) {
          return apiClient.updateOrderItem(order.id, id, changes);
        }
      }
      return null;
    },
    delete: async (id: string) => {
      // Find the item's order first
      const orders = await apiClient.getOrders();
      for (const order of orders) {
        const items = await apiClient.getOrderItems(order.id);
        const item = items.find((i: any) => i.id === id);
        if (item) {
          await apiClient.deleteOrderItem(order.id, id);
          return;
        }
      }
    },
    clear: async () => {},
    filter: (filterFn: (item: any) => boolean) => ({
      toArray: async () => {
        const orders = await apiClient.getOrders();
        const allItems: any[] = [];
        for (const order of orders) {
          const items = await apiClient.getOrderItems(order.id);
          allItems.push(...items);
        }
        return allItems.filter(filterFn);
      },
      count: async () => {
        const orders = await apiClient.getOrders();
        const allItems: any[] = [];
        for (const order of orders) {
          const items = await apiClient.getOrderItems(order.id);
          allItems.push(...items);
        }
        return allItems.filter(filterFn).length;
      },
      first: async () => {
        const orders = await apiClient.getOrders();
        const allItems: any[] = [];
        for (const order of orders) {
          const items = await apiClient.getOrderItems(order.id);
          allItems.push(...items);
        }
        return allItems.find(filterFn) || null;
      },
    }),
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.addOrderItem(item.orderId, item)));
    },
    where: (fieldName: string) => ({
      equals: (value: any) => ({
        first: async () => {
          if (fieldName === 'orderId') {
            const items = await apiClient.getOrderItems(value);
            return items[0] || null;
          }
          return null;
        },
        toArray: async () => {
          if (fieldName === 'orderId') {
            return apiClient.getOrderItems(value);
          }
          return [];
        },
        count: async () => {
          if (fieldName === 'orderId') {
            const items = await apiClient.getOrderItems(value);
            return items.length;
          }
          return 0;
        },
        delete: async () => {
          if (fieldName === 'orderId') {
            const items = await apiClient.getOrderItems(value);
            for (const item of items) {
              await apiClient.deleteOrderItem(value, item.id);
            }
            return items.length;
          }
          return 0;
        },
        sortBy: (sortField: string) => {
          return (async () => {
            if (fieldName === 'orderId') {
              const items = await apiClient.getOrderItems(value);
              return items.sort((a: any, b: any) => {
                if (a[sortField] < b[sortField]) return -1;
                if (a[sortField] > b[sortField]) return 1;
                return 0;
              });
            }
            return [];
          })();
        },
        reverse: async () => {
          if (fieldName === 'orderId') {
            const items = await apiClient.getOrderItems(value);
            return items.reverse();
          }
          return [];
        },
      }),
      between: (lowerBound: any, upperBound: any) => {
        void lowerBound;
        void upperBound;
        return {
          toArray: async () => [],
          count: async () => 0,
          first: async () => null,
          sortBy: (sortField: string) => {
            void sortField;
            return Promise.resolve([]);
          },
          reverse: async () => [],
        };
      },
      anyOf: (values: any[]) => {
        void values;
        return {
          toArray: async () => [],
          count: async () => 0,
          first: async () => null,
          delete: async () => 0,
        };
      },
      toArray: async () => [],
    }),
  },

  // Payments proxy
  payments: {
    toArray: async () => apiClient.getPayments(),
    get: async (id: string) => apiClient.getPayment(id),
    add: async (payment: any) => apiClient.createPayment(payment),
    put: async (payment: any) => apiClient.updatePayment(payment.id, payment),
    update: async (id: string, changes: any) => apiClient.updatePayment(id, changes),
    delete: async (id: string) => apiClient.deletePayment(id),
    clear: async () => {
      const all = await apiClient.getPayments();
      await Promise.all(all.map((p: any) => apiClient.deletePayment(p.id)));
    },
    where: createWhereEquals(() => apiClient.getPayments()),
    filter: (filterFn: (item: any) => boolean) => ({
      toArray: async () => {
        const all = await apiClient.getPayments();
        return all.filter(filterFn);
      },
      count: async () => {
        const all = await apiClient.getPayments();
        return all.filter(filterFn).length;
      },
      first: async () => {
        const all = await apiClient.getPayments();
        return all.find(filterFn) || null;
      },
    }),
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.createPayment(item)));
    },
  },

  // KOT Prints proxy
  kotPrints: {
    toArray: async () => [],
    get: async (id: string) => {
      void id;
      return null;
    },
    add: async (print: any) => {
      void print;
      return null;
    },
    clear: async () => {
      const deals = await apiClient.getDeals();
      for (const deal of deals) {
        const variants = await apiClient.getDealVariants(deal.id);
        for (const variant of variants) {
          await apiClient.deleteDealVariant(deal.id, variant.variantId);
        }
      }
    },
    bulkPut: async (items: any[]) => {
      for (const item of items) {
        void item;
      }
    },
    where: createWhereEquals(async () => []),
  },

  // Audit Logs proxy
  auditLogs: {
    toArray: async () => apiClient.getAuditLogs(100, 0),
    get: async (id: string) => {
      const logs = await apiClient.getAuditLogs(100, 0);
      return logs.find((log: any) => log.id === id) || null;
    },
    add: async (log: any) => {
      return apiClient.createAuditLog(log);
    },
    clear: async () => {},
    where: createWhereEquals(() => apiClient.getAuditLogs(500, 0)),
    orderBy: (sortField: string) => ({
      reverse: () => ({
        offset: (offset: number) => ({
          limit: (limit: number) => ({
            toArray: async () => {
              void sortField;
              return apiClient.getAuditLogs(limit, offset);
            },
          }),
        }),
      }),
    }),
    limit: (n: number) => ({
      toArray: async () => {
        return apiClient.getAuditLogs(n, 0);
      },
    }),
  },

  // Settings proxy
  settings: {
    toArray: async () => [await apiClient.getSettings()],
    get: async (id: string) => id === 'default' ? await apiClient.getSettings() : null,
    put: async (settings: any) => apiClient.updateSettings(settings),
    update: async (id: string, changes: any) => {
      void id;
      return apiClient.updateSettings(changes);
    },
    bulkPut: async (items: any[]) => {
      return Promise.all(items.map(item => apiClient.updateSettings(item)));
    },
  },

  // Upload Queue proxy
  uploadQueue: {
    toArray: async () => [],
    get: async (id: string) => {
      void id;
      return null;
    },
    add: async (item: any) => {
      void item;
      return null;
    },
    clear: async () => {},
    where: createWhereEquals(async () => []),
  },

  // Employees proxy
  employees: {
    toArray: async () => apiClient.getEmployees(),
    get: async (id: string) => apiClient.getEmployee(id),
    add: async (employee: any) => apiClient.createEmployee(employee),
    put: async (employee: any) => apiClient.updateEmployee(employee.id, employee),
    update: async (id: string, changes: any) => apiClient.updateEmployee(id, changes),
    delete: async (id: string) => apiClient.deleteEmployee(id),
    clear: async () => {
      const all = await apiClient.getEmployees();
      await Promise.all(all.map((e: any) => apiClient.deleteEmployee(e.id)));
    },
    where: createWhereEquals(() => apiClient.getEmployees()),
    orderBy: createOrderBy(() => apiClient.getEmployees()),
  },

  // Employee Loans proxy
  employeeLoans: {
    toArray: async () => apiClient.getAllLoans(),
    get: async (id: string) => apiClient.getLoan(id),
    add: async (loan: any) => apiClient.createLoan(loan.employeeId, loan),
    put: async (loan: any) => apiClient.updateLoan(loan.id, loan),
    update: async (id: string, changes: any) => apiClient.updateLoan(id, changes),
    clear: async () => {},
    where: createWhereEquals(() => apiClient.getAllLoans()),
    reverse: createReverse(() => apiClient.getAllLoans()),
  },

  // Expenses proxy
  expenses: {
    toArray: async () => apiClient.getExpenses(),
    get: async (id: string) => apiClient.getExpense(id),
    add: async (expense: any) => apiClient.createExpense(expense),
    put: async (expense: any) => apiClient.updateExpense(expense.id, expense),
    update: async (id: string, changes: any) => apiClient.updateExpense(id, changes),
    delete: async (id: string) => apiClient.deleteExpense(id),
    clear: async () => {
      const all = await apiClient.getExpenses();
      await Promise.all(all.map((e: any) => apiClient.deleteExpense(e.id)));
    },
    where: createWhereEquals(() => apiClient.getExpenses()),
    reverse: createReverse(() => apiClient.getExpenses()),
    filter: (filterFn: (item: any) => boolean) => ({
      toArray: async () => {
        const all = await apiClient.getExpenses();
        return all.filter(filterFn);
      },
      count: async () => {
        const all = await apiClient.getExpenses();
        return all.filter(filterFn).length;
      },
      first: async () => {
        const all = await apiClient.getExpenses();
        return all.find(filterFn) || null;
      },
    }),
  },

  // Rider Receipts proxy
  riderReceipts: {
    toArray: async () => [],
    get: async (id: string) => {
      void id;
      return null;
    },
    add: async (receipt: any) => {
      void receipt;
      return null;
    },
    clear: async () => {},
  },

  // Transaction support (no-op for API-based operations)
  transaction: async (mode: string, tables: any[], fn: () => Promise<void>) => {
    void mode;
    void tables;
    // Transactions are handled at the database level
    // Just execute the function sequentially since API calls are independent
    await fn();
  },

  // Table list for iteration
  tables: [] as any[],
};

// Populate the tables array after db object is created
Object.defineProperty(db, 'tables', {
  get() {
    return [
      db.users,
      db.roles,
      db.categories,
      db.menuItems,
      db.variants,
      db.variantOptions,
      db.menuItemVariants,
      db.deals,
      db.dealItems,
      db.dealVariants,
      db.customers,
      db.waiters,
      db.riders,
      db.diningTables,
      db.registerSessions,
      db.orders,
      db.orderItems,
      db.payments,
      db.kotPrints,
      db.auditLogs,
      db.settings,
      db.uploadQueue,
      db.employees,
      db.employeeLoans,
      db.expenses,
      db.riderReceipts,
    ].map(table => ({
      ...table,
      name: Object.keys(db).find(key => db[key as keyof typeof db] === table),
    }));
  },
});
