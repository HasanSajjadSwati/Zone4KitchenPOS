import React from 'react';
import { format } from 'date-fns';
import type { RegisterSession } from '@/db/types';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface RegisterSessionPickerProps {
  sessions: RegisterSession[];
  selectedId: string;
  onSelect: (sessionId: string) => void;
}

export const RegisterSessionPicker: React.FC<RegisterSessionPickerProps> = ({
  sessions,
  selectedId,
  onSelect,
}) => {
  if (sessions.length === 0) {
    return (
      <div className="pt-4 mt-4 border-t border-gray-100">
        <p className="text-sm text-gray-400 text-center py-4">No register sessions found.</p>
      </div>
    );
  }

  return (
    <div className="pt-4 mt-4 border-t border-gray-100">
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
        Select Register Session
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
        {sessions.map((session) => {
          const isSelected = selectedId === session.id;
          const isOpen = session.status === 'open';
          const openDate = new Date(session.openedAt);
          const closeDate = session.closedAt ? new Date(session.closedAt) : null;

          return (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`relative text-left w-full px-3.5 py-3 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 shadow-sm ring-1 ring-primary-200'
                  : 'border-gray-150 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {/* Selected indicator */}
              {isSelected && (
                <CheckCircleIcon className="absolute top-2.5 right-2.5 w-5 h-5 text-primary-500" />
              )}

              {/* Status + Date */}
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isOpen
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                  {isOpen ? 'Open' : 'Closed'}
                </span>
                <span className="text-xs text-gray-400">
                  {format(openDate, 'dd MMM yyyy')}
                </span>
              </div>

              {/* Time range */}
              <div className="text-sm font-medium text-gray-800 mb-2">
                {format(openDate, 'hh:mm a')}
                <span className="text-gray-300 mx-1.5">&#8594;</span>
                {closeDate ? format(closeDate, 'hh:mm a') : (
                  <span className="text-emerald-600">Now</span>
                )}
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-gray-400">Sales</span>
                  <span className="text-xs font-semibold text-gray-700">
                    Rs {(session.totalSales || 0).toLocaleString()}
                  </span>
                </div>
                <div className="w-px h-3 bg-gray-200" />
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-gray-400">Orders</span>
                  <span className="text-xs font-semibold text-gray-700">
                    {session.totalOrders || 0}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
