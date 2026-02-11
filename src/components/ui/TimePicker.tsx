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

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));

const parseTime = (value: string): { hour: string; minute: string } => {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = HOURS.includes(hourRaw) ? hourRaw : '00';
  const minute = MINUTES.includes(minuteRaw) ? minuteRaw : '00';
  return { hour, minute };
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
  const { hour, minute } = parseTime(value);
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
          id={`${inputId}-hour`}
          value={hour}
          onChange={(e) => onChange(`${e.target.value}:${minute}`)}
          disabled={disabled}
          className={clsx(
            'block w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
              : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
            disabled && 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
          )}
        >
          {HOURS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <span className="text-gray-500 dark:text-gray-400 font-medium">:</span>
        <select
          id={`${inputId}-minute`}
          value={minute}
          onChange={(e) => onChange(`${hour}:${e.target.value}`)}
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
      </div>
      {error && <p className="mt-1 text-sm text-danger-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
};

