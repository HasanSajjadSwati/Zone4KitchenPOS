import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon, FolderIcon, TagIcon } from '@heroicons/react/24/outline';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  };

  return (
    <div className={clsx('w-full', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
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
            'bg-white border border-gray-300 rounded-lg',
            'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'transition-all duration-150',
            isOpen && 'ring-2 ring-primary-500 border-primary-500'
          )}
        >
          <span className={clsx(
            'truncate',
            value ? 'text-gray-900 font-medium' : 'text-gray-500'
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
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-auto">
            {/* All Categories Option */}
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={clsx(
                'w-full flex items-center justify-between px-4 py-2.5 text-left',
                'hover:bg-gray-50 transition-colors',
                !value && 'bg-primary-50 text-primary-700'
              )}
            >
              <span className="font-medium">{placeholder}</span>
              {!value && <CheckIcon className="w-4 h-4 text-primary-600" />}
            </button>

            <div className="border-t border-gray-100" />

            {/* Major Categories with Subcategories */}
            {majorCategories.map((major) => {
              const subs = subCategoriesByParent.get(major.id) || [];
              const isSelected = value === major.id;

              return (
                <div key={major.id} className="border-b border-gray-100 last:border-b-0">
                  {/* Major Category Header */}
                  <button
                    type="button"
                    onClick={() => handleSelect(major.id)}
                    className={clsx(
                      'w-full flex items-center justify-between px-4 py-2.5 text-left',
                      'hover:bg-gray-50 transition-colors',
                      isSelected && 'bg-primary-50'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderIcon className="w-4 h-4 text-gray-400" />
                      <span className={clsx(
                        'font-semibold',
                        isSelected ? 'text-primary-700' : 'text-gray-900'
                      )}>
                        {major.name}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {subs.length + 1}
                      </span>
                    </div>
                    {isSelected && <CheckIcon className="w-4 h-4 text-primary-600" />}
                  </button>

                  {/* Subcategories */}
                  {subs.length > 0 && (
                    <div className="bg-gray-50/50">
                      {subs.map((sub) => {
                        const isSubSelected = value === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSelect(sub.id)}
                            className={clsx(
                              'w-full flex items-center justify-between pl-10 pr-4 py-2 text-left',
                              'hover:bg-gray-100 transition-colors',
                              isSubSelected && 'bg-primary-50'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                              <span className={clsx(
                                'text-sm',
                                isSubSelected ? 'text-primary-700 font-medium' : 'text-gray-700'
                              )}>
                                {sub.name}
                              </span>
                            </div>
                            {isSubSelected && <CheckIcon className="w-4 h-4 text-primary-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Orphan Subcategories */}
            {orphanSubCategories.length > 0 && (
              <div className="border-t border-gray-200">
                <div className="px-4 py-2 bg-gray-100">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Other Categories
                  </span>
                </div>
                {orphanSubCategories.map((sub) => {
                  const isSubSelected = value === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSelect(sub.id)}
                      className={clsx(
                        'w-full flex items-center justify-between px-4 py-2 text-left',
                        'hover:bg-gray-50 transition-colors',
                        isSubSelected && 'bg-primary-50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span className={clsx(
                          'text-sm',
                          isSubSelected ? 'text-primary-700 font-medium' : 'text-gray-700'
                        )}>
                          {sub.name}
                        </span>
                      </div>
                      {isSubSelected && <CheckIcon className="w-4 h-4 text-primary-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
