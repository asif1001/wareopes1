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
        }
      } catch (error) {
        console.error('Error loading session:', error);
        authLogout();
      } finally {
        setIsLoading(false);
        setIsHydrated(true);
      }
    };

    checkSession();
  }, []);

  const login = async (employeeNo: string, password: string) => {
    try {
      // Prefer server-side verification via Admin SDK (no client permissions required)
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeNo, password })
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            // Create client session and update context
            const { createSession } = await import('@/lib/auth');
            createSession(data.user);
            setUser(data.user);
            return { success: true, user: data.user };
          }
        } else {
          const text = await res.text();
          console.warn('Server login failed:', text);
        }
      } catch (e) {
        console.warn('Server login call failed, falling back to client:', e);
      }

      // Fallback: client-side Firestore verification (requires anonymous auth enabled)
      const result = await authLogin(employeeNo, password);
      if (result.success && result.user) {
        // Best effort: set cookie for middleware via server
        try {
          await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNo, password })
          });
        } catch {}
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