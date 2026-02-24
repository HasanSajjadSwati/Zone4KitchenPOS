'use client';

import { useEffect, useState } from 'react';
import { Save, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface SiteSettings {
  siteName: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

export default function SiteSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: 'Zone 4 Kitchen',
    tagline: 'Authentic Pakistani Cuisine',
    metaTitle: 'Zone 4 Kitchen - Authentic Pakistani Cuisine',
    metaDescription: 'Order delicious Pakistani food online. Fresh ingredients, authentic recipes, fast delivery in Islamabad.',
    logoUrl: null,
    faviconUrl: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/settings/site`
      );
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
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
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/admin/settings/site`,
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

      toast.success('Site settings updated successfully!');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
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
          Site Settings
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

      <div className="space-y-6">
        {/* Branding */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Branding</span>
          </h2>
          
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Name
                </label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) =>
                    setSettings({ ...settings, siteName: e.target.value })
                  }
                  className="input-field"
                  placeholder="e.g., Zone 4 Kitchen"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tagline
                </label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) =>
                    setSettings({ ...settings, tagline: e.target.value })
                  }
                  className="input-field"
                  placeholder="e.g., Authentic Pakistani Cuisine"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo URL
                </label>
                <input
                  type="text"
                  value={settings.logoUrl || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, logoUrl: e.target.value || null })
                  }
                  className="input-field"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Favicon URL
                </label>
                <input
                  type="text"
                  value={settings.faviconUrl || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, faviconUrl: e.target.value || null })
                  }
                  className="input-field"
                  placeholder="https://example.com/favicon.ico"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SEO */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">SEO Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta Title
              </label>
              <input
                type="text"
                value={settings.metaTitle}
                onChange={(e) =>
                  setSettings({ ...settings, metaTitle: e.target.value })
                }
                className="input-field"
                placeholder="Page title for search engines"
              />
              <p className="text-xs text-gray-500 mt-1">
                {settings.metaTitle.length}/60 characters (recommended)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta Description
              </label>
              <textarea
                value={settings.metaDescription}
                onChange={(e) =>
                  setSettings({ ...settings, metaDescription: e.target.value })
                }
                rows={3}
                className="input-field resize-none"
                placeholder="Brief description for search engines"
              />
              <p className="text-xs text-gray-500 mt-1">
                {settings.metaDescription.length}/160 characters (recommended)
              </p>
            </div>
          </div>
        </div>

        {/* Search Preview */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Google Search Preview</h3>
          <div className="bg-white p-4 rounded-lg border">
            <p className="text-blue-600 text-lg hover:underline cursor-pointer truncate">
              {settings.metaTitle || 'Page Title'}
            </p>
            <p className="text-green-700 text-sm">zone4kitchen.com</p>
            <p className="text-gray-600 text-sm line-clamp-2">
              {settings.metaDescription || 'Page description will appear here...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
