import type { UserRole } from '@/lib/types';

/**
 * Get the appropriate dashboard route based on user role
 */
export function getRoleDashboardRoute(role: UserRole | string | undefined): string {
  if (!role) {
    return '/dashboard'; // Default dashboard
  }

  const normalizedRole = role.toLowerCase();
  
  switch (normalizedRole) {
    case 'admin':
    case 'administrator':
      return '/dashboard/admin';
    
    case 'manager':
    case 'supervisor':
      return '/dashboard/manager';
    
    case 'employee':
    case 'staff':
    case 'worker':
      return '/dashboard/employee';
    
    default:
      return '/dashboard'; // Default dashboard for unknown roles
  }
}

/**
 * Check if a user has admin privileges
 */
export function isAdminRole(role: UserRole | string | undefined): boolean {
  if (!role) return false;
  
  const normalizedRole = role.toLowerCase();
  return normalizedRole === 'admin' || normalizedRole === 'administrator';
}

/**
 * Check if a user has manager privileges
 */
export function isManagerRole(role: UserRole | string | undefined): boolean {
  if (!role) return false;
  
  const normalizedRole = role.toLowerCase();
  return normalizedRole === 'manager' || normalizedRole === 'supervisor' || isAdminRole(role);
}

/**
 * Get user role display name
 */
export function getRoleDisplayName(role: UserRole | string | undefined): string {
  if (!role) return 'User';
  
  const normalizedRole = role.toLowerCase();
  
  switch (normalizedRole) {
    case 'admin':
    case 'administrator':
      return 'Administrator';
    
    case 'manager':
      return 'Manager';
    
    case 'supervisor':
      return 'Supervisor';
    
    case 'employee':
      return 'Employee';
    
    case 'staff':
      return 'Staff';
    
    case 'worker':
      return 'Worker';
    
    default:
      return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }
}