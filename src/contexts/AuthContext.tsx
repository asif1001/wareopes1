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
import { getUsers } from '@/lib/firebase/firestore';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (employeeNo: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = getCurrentSession();
        if (session) {
          setUser(session.user);
          // Refresh session to extend expiry
          refreshSession();
        } else {
          // Ensure user is null if no valid session
          setUser(null);
        }
      } catch (error) {
        console.error('Error loading session:', error);
        setUser(null);
        authLogout();
      } finally {
        setIsLoading(false);
        setIsHydrated(true);
      }
    };

    // Add a small delay to prevent race conditions
    const timeoutId = setTimeout(checkSession, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  const login = async (employeeNo: string, password: string) => {
    try {
      const normalizedEmployeeNo = employeeNo?.trim();
      const normalizedPassword = password?.trim();

      if (!normalizedEmployeeNo || !normalizedPassword) {
        return { success: false, error: 'Employee number and password are required' };
      }

      const result = await authLogin(normalizedEmployeeNo, normalizedPassword);
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
    setIsLoading(false);
    // Use Next.js router instead of hard reload to prevent issues
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  };

  const refreshUser = async () => {
    if (!user?.id) return;
    
    try {
      const users = await getUsers();
      const updatedUser = users.find(u => u.id === user.id);
      
      if (updatedUser) {
        setUser(updatedUser);
        
        // Update session storage with new user data
        const session = getCurrentSession();
        if (session) {
          const updatedSession = {
            ...session,
            user: updatedUser
          };
          localStorage.setItem('session', JSON.stringify(updatedSession));
        }
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  // Only check admin status after hydration to prevent server/client mismatch
  const isAdmin = isHydrated ? checkIsAdmin() : false;

  const value = {
    user,
    isLoading,
    isAdmin,
    login,
    logout,
    refreshUser,
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