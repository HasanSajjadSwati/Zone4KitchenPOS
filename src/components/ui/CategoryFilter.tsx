import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon, FolderIcon, TagIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { Category } from '@/db/types';

interface CategoryFilterProps {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  value,
  onChange,
  label = 'Filter by Category',
  placeholder = 'All Categories',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sort categories
  const sortCategories = (a: Category, b: Category) => {
    const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  };

  // Organize categories
  const majorCategories = categories
    .filter((cat) => cat.type === 'major' && cat.isActive)
    .sort(sortCategories);

  const subCategories = categories
    .filter((cat) => cat.type === 'sub' && cat.isActive)
    .sort(sortCategories);

  const majorCategoryIds = new Set(majorCategories.map((cat) => cat.id));

  const subCategoriesByParent = new Map<string, Category[]>();
  majorCategories.forEach((major) => {
    const subs = subCategories.filter((cat) => cat.parentId === major.id);
    subCategoriesByParent.set(major.id, subs);
  });

  const orphanSubCategories = subCategories.filter(
    (cat) => !cat.parentId || !majorCategoryIds.has(cat.parentId)
  );

  // Get selected category name
  const getSelectedName = () => {
    if (!value) return placeholder;
    const selected = categories.find((cat) => cat.id === value);
    if (!selected) return placeholder;

    if (selected.type === 'major') {
      return `${selected.name} (All)`;
    }

    const parent = categories.find((cat) => cat.id === selected.parentId);
    if (parent) {
      return `${parent.name} › ${selected.name}`;
    }
    return selected.name;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (categoryId: string) => {
    onChange(categoryId);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Filter categories based on search
  const filterBySearch = (cat: Category) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return cat.name.toLowerCase().includes(query);
  };

  // Get filtered major categories and their subs
  const filteredMajorCategories = majorCategories.filter((major) => {
    const subs = subCategoriesByParent.get(major.id) || [];
    const matchesMajor = filterBySearch(major);
    const hasMatchingSub = subs.some(filterBySearch);
    return matchesMajor || hasMatchingSub;
  });

  const filteredOrphanSubs = orphanSubCategories.filter(filterBySearch);

  return (
    <div className={clsx('w-full', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className={clsx(
            'w-full flex items-center justify-between px-4 py-2 text-left',
            'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg',
            'hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'transition-all duration-150',
            isOpen && 'ring-2 ring-primary-500 border-primary-500'
          )}
        >
          <span className={clsx(
            'truncate',
            value ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'
          )}>
            {getSelectedName()}
          </span>
          <ChevronDownIcon
            className={clsx(
              'w-5 h-5 text-gray-400 transition-transform duration-200',
              isOpen && 'transform rotate-180'
            )}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-hidden">
            {/* Search Input */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-800">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="overflow-auto max-h-60">
            {/* All Categories Option */}
            {!searchQuery && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={clsx(
                  'w-full flex items-center justify-between px-4 py-2.5 text-left',
                  'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                  !value && 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                )}
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">{placeholder}</span>
                {!value && <CheckIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
              </button>
            )}

            {!searchQuery && <div className="border-t border-gray-100 dark:border-gray-700" />}

            {/* Major Categories with Subcategories */}
            {filteredMajorCategories.map((major) => {
              const subs = (subCategoriesByParent.get(major.id) || []).filter(filterBySearch);
              const showMajor = filterBySearch(major) || subs.length > 0;
              const isSelected = value === major.id;

              if (!showMajor && subs.length === 0) return null;

              return (
                <div key={major.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                  {/* Major Category Header */}
                  {filterBySearch(major) && (
                    <button
                      type="button"
                      onClick={() => handleSelect(major.id)}
                      className={clsx(
                        'w-full flex items-center justify-between px-4 py-2.5 text-left',
                        'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                        isSelected && 'bg-primary-50 dark:bg-primary-900/40'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <FolderIcon className="w-4 h-4 text-gray-400" />
                        <span className={clsx(
                          'font-semibold',
                          isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-gray-100'
                        )}>
                          {major.name}
                        </span>
                        {!searchQuery && (
                          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {(subCategoriesByParent.get(major.id) || []).length + 1}
                          </span>
                        )}
                      </div>
                      {isSelected && <CheckIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                    </button>
                  )}

                  {/* Subcategories */}
                  {subs.length > 0 && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/30">
                      {subs.map((sub) => {
                        const isSubSelected = value === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSelect(sub.id)}
                            className={clsx(
                              'w-full flex items-center justify-between pl-10 pr-4 py-2 text-left',
                              'hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                              isSubSelected && 'bg-primary-50 dark:bg-primary-900/40'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                              <span className={clsx(
                                'text-sm',
                                isSubSelected ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                              )}>
                                {sub.name}
                              </span>
                            </div>
                            {isSubSelected && <CheckIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Orphan Subcategories */}
            {filteredOrphanSubs.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-600">
                <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Other Categories
                  </span>
                </div>
                {filteredOrphanSubs.map((sub) => {
                  const isSubSelected = value === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSelect(sub.id)}
                      className={clsx(
                        'w-full flex items-center justify-between px-4 py-2 text-left',
                        'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                        isSubSelected && 'bg-primary-50 dark:bg-primary-900/40'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span className={clsx(
                          'text-sm',
                          isSubSelected ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                        )}>
                          {sub.name}
                        </span>
                      </div>
                      {isSubSelected && <CheckIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* No results message */}
            {searchQuery && filteredMajorCategories.length === 0 && filteredOrphanSubs.length === 0 && (
              <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                No categories found
              </div>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
