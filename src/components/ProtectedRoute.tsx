"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect while still loading
    if (isLoading) return;

    // Add a small delay to prevent rapid redirects
    const timeoutId = setTimeout(() => {
      // If no user is logged in, redirect to login
      if (!user) {
        router.replace('/');
        return;
      }

      // If admin is required but user is not admin, redirect to dashboard
      if (requireAdmin && !isAdmin) {
        router.replace('/dashboard');
        return;
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [user, isLoading, isAdmin, requireAdmin, router]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // If no user, don't render anything (redirect will happen)
  if (!user) {
    return null;
  }

  // If admin required but user is not admin, don't render anything (redirect will happen)
  if (requireAdmin && !isAdmin) {
    return null;
  }

  // User is authenticated and authorized, render children
  return <>{children}</>;
}