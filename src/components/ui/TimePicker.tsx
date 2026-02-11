import React from 'react';
import clsx from 'clsx';

interface TimePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
}

const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));
const PERIODS = ['AM', 'PM'] as const;
type Period = (typeof PERIODS)[number];

const parseTime = (value: string): { hour12: string; minute: string; period: Period } => {
  const [hourRaw = '00', minuteRaw = '00'] = value.split(':');
  const parsedHour = Number.parseInt(hourRaw, 10);
  const hour24 = Number.isFinite(parsedHour) ? Math.min(23, Math.max(0, parsedHour)) : 0;
  const period: Period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12Numeric = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const hour12 = String(hour12Numeric).padStart(2, '0');
  const minute = MINUTES.includes(minuteRaw) ? minuteRaw : '00';
  return { hour12, minute, period };
};

const to24Hour = (hour12: string, period: Period): string => {
  const parsedHour = Number.parseInt(hour12, 10);
  const normalized = Number.isFinite(parsedHour) ? Math.min(12, Math.max(1, parsedHour)) : 12;

  if (period === 'AM') {
    return String(normalized === 12 ? 0 : normalized).padStart(2, '0');
  }

  return String(normalized === 12 ? 12 : normalized + 12).padStart(2, '0');
};

export const TimePicker: React.FC<TimePickerProps> = ({
  label,
  value,
  onChange,
  disabled = false,
  error,
  helperText,
  className,
}) => {
  const { hour12, minute, period } = parseTime(value);
  const inputId = React.useId();

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label htmlFor={`${inputId}-hour`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <select
          id={`${inputId}-hour12`}
          value={hour12}
          onChange={(e) => onChange(`${to24Hour(e.target.value, period)}:${minute}`)}
          disabled={disabled}
          className={clsx(
            'block w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
              : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
            disabled && 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
          )}
        >
          {HOURS_12.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <span className="text-gray-500 dark:text-gray-400 font-medium">:</span>
        <select
          id={`${inputId}-minute`}
          value={minute}
          onChange={(e) => onChange(`${to24Hour(hour12, period)}:${e.target.value}`)}
          disabled={disabled}
          className={clsx(
            'block w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
              : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
            disabled && 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
          )}
        >
          {MINUTES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          id={`${inputId}-period`}
          value={period}
          onChange={(e) => onChange(`${to24Hour(hour12, e.target.value as Period)}:${minute}`)}
          disabled={disabled}
          className={clsx(
            'block w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
              : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
            disabled && 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
          )}
        >
          {PERIODS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mt-1 text-sm text-danger-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
};
