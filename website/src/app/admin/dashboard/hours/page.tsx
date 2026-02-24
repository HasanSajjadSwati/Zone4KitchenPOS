'use client';

import { useEffect, useState } from 'react';
import { Save, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

interface WorkingHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

const defaultHours: WorkingHours = {
  monday: { open: '11:00', close: '23:00', closed: false },
  tuesday: { open: '11:00', close: '23:00', closed: false },
  wednesday: { open: '11:00', close: '23:00', closed: false },
  thursday: { open: '11:00', close: '23:00', closed: false },
  friday: { open: '11:00', close: '23:00', closed: false },
  saturday: { open: '12:00', close: '00:00', closed: false },
  sunday: { open: '12:00', close: '00:00', closed: false },
};

const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export default function WorkingHoursPage() {
  const [settings, setSettings] = useState<WorkingHours>(defaultHours);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/settings/working-hours`
      );
      if (response.ok) {
        const data = await response.json();
        setSettings({ ...defaultHours, ...data });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('zone4kitchen_admin_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/admin/settings/working-hours`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(settings),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Working hours updated successfully!');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateDay = (day: keyof WorkingHours, field: keyof DayHours, value: any) => {
    setSettings({
      ...settings,
      [day]: {
        ...settings[day],
        [field]: value,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-gray-900">
          Working Hours
        </h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Clock className="w-6 h-6 text-blue-600" />
          <p className="text-blue-800">
            Set your business hours for each day of the week.
          </p>
        </div>

        <div className="space-y-4">
          {dayNames.map((day) => (
            <div
              key={day}
              className={`p-4 rounded-lg border ${
                settings[day].closed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-4 min-w-[140px]">
                  <span className="font-medium text-gray-900 capitalize w-24">
                    {day}
                  </span>
                </div>

                <div className="flex items-center space-x-4 flex-wrap gap-2">
                  {!settings[day].closed && (
                    <>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Open:</label>
                        <input
                          type="time"
                          value={settings[day].open}
                          onChange={(e) => updateDay(day, 'open', e.target.value)}
                          className="input-field w-auto py-1.5 px-2"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Close:</label>
                        <input
                          type="time"
                          value={settings[day].close}
                          onChange={(e) => updateDay(day, 'close', e.target.value)}
                          className="input-field w-auto py-1.5 px-2"
                        />
                      </div>
                    </>
                  )}

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[day].closed}
                      onChange={(e) => updateDay(day, 'closed', e.target.checked)}
                      className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600">Closed</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold mb-4">Opening Hours</h3>
          <div className="space-y-2">
            {dayNames.map((day) => (
              <div key={day} className="flex justify-between py-1.5 border-b border-gray-200 last:border-0">
                <span className="capitalize text-gray-700">{day}</span>
                <span className="font-medium">
                  {settings[day].closed
                    ? 'Closed'
                    : `${settings[day].open} - ${settings[day].close}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
