import { getUserByEmployeeNo } from './firebase/firestore';
import type { User } from './types';

// Custom authentication using only Firestore (no Firebase Auth)
// This approach works for users without email addresses

export interface Session {
  user: User;
  expiresAt: number;
  createdAt: number;
}

// Session management
const SESSION_KEY = 'wareopes_session';

// Check if we're on the client side
const isClient = typeof window !== 'undefined';

// Authenticate user with employee number and password
export const authenticateUser = async (employeeNo: string, password: string): Promise<User | null> => {
  try {
    const user = await getUserByEmployeeNo(employeeNo);
    if (!user) return null;
    
    // For now, we'll do a simple password comparison
    // In production, you should hash passwords properly
    if (user.password === password) {
      return {
        id: user.id,
        employeeNo: user.employeeNo,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        email: user.email
      };
    }
    
    return null;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
};

// Create session (login)
export const createSession = (user: User): void => {
  if (!isClient) return;
  
  const session: Session = {
    user,
    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    createdAt: Date.now()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

// Get current session
export const getCurrentSession = (): Session | null => {
  if (!isClient) return null;
  
  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;
    
    const session: Session = JSON.parse(sessionData);
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    clearSession();
    return null;
  }
};

// Clear session (logout)
export const clearSession = (): void => {
  if (!isClient) return;
  localStorage.removeItem(SESSION_KEY);
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  if (!isClient) return false;
  const session = getCurrentSession();
  return session !== null;
};

// Check if user is admin
export const isAdmin = (): boolean => {
  if (!isClient) return false;
  const session = getCurrentSession();
  return session?.user?.role === 'Admin';
};

// Get current user
export const getCurrentUser = (): User | null => {
  if (!isClient) return null;
  const session = getCurrentSession();
  return session?.user || null;
};

// Refresh session (extend expiry)
export const refreshSession = (): boolean => {
  if (!isClient) return false;
  
  const session = getCurrentSession();
  if (!session) return false;

  const updatedSession: Session = {
    ...session,
    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
  return true;
};

// Login function
export const login = async (employeeNo: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const user = await authenticateUser(employeeNo, password);
    if (!user) {
      return { success: false, error: 'Invalid employee number or password' };
    }
    
    createSession(user);
    return { success: true, user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Authentication failed' };
  }
};

// Logout function
export const logout = (): void => {
  clearSession();
};