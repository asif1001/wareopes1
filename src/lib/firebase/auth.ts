import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { app } from './firebase';
import { getUserByEmployeeNo } from './firestore';
import type { User } from '@/lib/types';

export const auth = getAuth(app);

// Custom user type that combines Firebase user with our app user data
export interface AuthUser extends FirebaseUser {
  userData?: User;
}

// Sign in with employee number and password
export const signInWithEmployeeNo = async (employeeNo: string, password: string) => {
  try {
    // First, get user data from Firestore to get their email
    const userData = await getUserByEmployeeNo(employeeNo);
    
    if (!userData) {
      throw new Error('Invalid employee number or password');
    }

    // Use email for Firebase authentication
    const userCredential = await signInWithEmailAndPassword(auth, userData.email || '', password);
    
    // Return both Firebase user and our app user data
    return {
      firebaseUser: userCredential.user,
      userData: userData
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    
    // Handle specific Firebase auth errors
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      throw new Error('Invalid employee number or password');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many failed attempts. Please try again later.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection.');
    } else {
      throw new Error(error.message || 'Authentication failed');
    }
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Create a new user account (for admin use)
export const createUserAccount = async (email: string, password: string, displayName: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update the user's display name
    await updateProfile(userCredential.user, {
      displayName: displayName
    });
    
    return userCredential.user;
  } catch (error: any) {
    console.error('Create user error:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Email is already registered');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address');
    } else {
      throw new Error(error.message || 'Failed to create account');
    }
  }
};