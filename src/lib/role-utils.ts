import { AppPageKey, PermissionAction } from "./types";

// Centralized lists of pages and actions used across forms and server actions
export const APP_PAGES: AppPageKey[] = ["shipments", "tasks", "settings", "production", "productivity"];
export const PERMISSION_ACTIONS: PermissionAction[] = ["view", "add", "edit", "delete"];

// Existing utilities
export function getDashboardRouteForRole(role: string, user?: { redirectPage?: string }): string {
  // Check if user has a custom redirect page preference
  if (user?.redirectPage) {
    return user.redirectPage;
  }
  
  // Fall back to role-based defaults
  switch (role) {
    case "admin":
      return "/dashboard/settings";
    case "manager":
      return "/dashboard/tasks";
    default:
      return "/dashboard/shipments";
  }
}

// Backward-compatible alias used by legacy callers
export function getRoleDashboardRoute(role: string): string {
  return getDashboardRouteForRole(String(role).toLowerCase());
}

export function isAdminRole(role: string): boolean {
  return role === "admin";
}

export function isManagerRole(role: string): boolean {
  return role === "manager" || role === "admin";
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case "admin":
      return "Administrator";
    case "manager":
      return "Manager";
    case "operator":
      return "Operator";
    default:
      return role;
  }
}