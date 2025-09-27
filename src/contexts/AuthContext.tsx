'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { 
  getCurrentSession, 
  login as authLogin, 
  logout as authLogout,
  isAdmin as checkIsAdmin,
  refreshSession
} from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (employeeNo: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = () => {
      try {
        const session = getCurrentSession();
        if (session) {
          setUser(session.user);
          // Refresh session to extend expiry
          refreshSession();
        }
      } catch (error) {
        console.error('Error loading session:', error);
        authLogout();
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (employeeNo: string, password: string) => {
    try {
      const result = await authLogin(employeeNo, password);
      if (result.success && result.user) {
        setUser(result.user);
      }
      return result;
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  };

  const logout = () => {
    authLogout();
    setUser(null);
    // Force a page reload to ensure clean state
    window.location.href = '/';
  };

  const isAdmin = checkIsAdmin();

  const value = {
    user,
    isLoading,
    isAdmin,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
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