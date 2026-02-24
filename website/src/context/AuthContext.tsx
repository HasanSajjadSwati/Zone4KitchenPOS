'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  name: string;
  phone: string;
  address?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, otp: string) => Promise<void>;
  register: (name: string, phone: string, address?: string) => Promise<void>;
  requestOTP: (phone: string) => Promise<{ exists: boolean }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const savedUser = localStorage.getItem('zone4kitchen_user');
      const token = localStorage.getItem('zone4kitchen_token');
      
      if (savedUser && token) {
        try {
          // Validate token with server
          const userData = await api.get('/website/auth/me');
          setUser(userData);
        } catch (e) {
          // Token invalid, clear storage
          localStorage.removeItem('zone4kitchen_user');
          localStorage.removeItem('zone4kitchen_token');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const requestOTP = async (phone: string): Promise<{ exists: boolean }> => {
    const response = await api.post('/website/auth/request-otp', { phone });
    return response;
  };

  const login = async (phone: string, otp: string) => {
    const response = await api.post('/website/auth/verify-otp', { phone, otp });
    const { user: userData, token } = response;
    
    setUser(userData);
    localStorage.setItem('zone4kitchen_user', JSON.stringify(userData));
    localStorage.setItem('zone4kitchen_token', token);
  };

  const register = async (name: string, phone: string, address?: string) => {
    const response = await api.post('/website/auth/register', { name, phone, address });
    const { user: userData, token } = response;
    
    setUser(userData);
    localStorage.setItem('zone4kitchen_user', JSON.stringify(userData));
    localStorage.setItem('zone4kitchen_token', token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('zone4kitchen_user');
    localStorage.removeItem('zone4kitchen_token');
  };

  const updateProfile = async (data: Partial<User>) => {
    const updatedUser = await api.put('/website/auth/profile', data);
    setUser(updatedUser);
    localStorage.setItem('zone4kitchen_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        requestOTP,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
