'use client';

/**
 * AuthContext
 *
 * What this provides
 * - login(): first tries server-side verification (/api/login with Admin SDK), then falls back to client-side Firestore verification.
 * - logout(): clears local session and calls server action to clear the HTTP-only cookie.
 * - session hydration & refresh: loads user from localStorage and extends session expiry.
 *
 * Why it signs in anonymously on mount
 * - Firestore rules in this project require request.auth != null for reads.
 * - Anonymous sign-in ensures client queries (when used) have an auth context without requiring email/password Firebase Auth.
 *
 * Why we still prefer server verification
 * - The server route uses Firebase Admin which bypasses rules and keeps credential checks off the client.
 * - After verifying, it sets a secure HTTP-only cookie used by middleware to protect /dashboard.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { app } from '@/lib/firebase/firebase';
import { 
  getCurrentSession, 
  login as authLogin, 
  logout as authLogout,
  isAdmin as checkIsAdmin,
  refreshSession,
  createSession
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
        // Ensure Firebase Auth is signed in (anonymous is fine for Firestore rules)
        const auth = getAuth(app);
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (e) {
            console.warn('Anonymous auth failed (continuing):', e);
          }
        }

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

  const login = async (employeeNo: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    setIsLoading(true);

    try {
      // First, try server-side login (preferred for security)
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeNo, password }),
      });

      if (response.ok) {
        const sessionData = await response.json();
        const userObj: User = {
          id: sessionData.id,
          employeeNo: String(sessionData.employeeNo),
          fullName: sessionData.fullName || sessionData.name || '',
          name: sessionData.name,
          role: sessionData.role,
          department: sessionData.department,
          email: sessionData.email,
        };

        setUser(userObj);
        // Mirror server cookie with local session for client context
        createSession(userObj);
        return { success: true, user: userObj };
      } else if (response.status === 401) {
        return { success: false, error: 'Invalid employee number or password' };
      } else {
        // Server error - fall back to client-side authentication
        console.warn('Server-side login failed, attempting client-side authentication');
        const result = await authLogin(employeeNo, password);
        if (result.success && result.user) {
          setUser(result.user);
        }
        return result;
      }
    } catch (error: any) {
      console.error('Login error:', error);
      // Handle network/connection errors specifically
      if (error.message?.includes('fetch') || error.name === 'TypeError') {
        return { success: false, error: 'Network connection issue. Please check your internet connection and try again.' };
      }
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    } finally {
      setIsLoading(false);
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
          // Keep key consistent with lib/auth.ts
          localStorage.setItem('wareopes_session', JSON.stringify(updatedSession));
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