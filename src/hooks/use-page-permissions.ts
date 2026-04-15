"use client";
import { useAuth } from "@/contexts/AuthContext";
import type { AppPageKey } from "@/lib/types";

/**
 * Returns granular permission flags for a given page.
 * All flags are false while loading, so UI is locked until permissions are known.
 */
export function usePagePermissions(page: AppPageKey) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return { canView: false, canAdd: false, canEdit: false, canDelete: false, isLoading: true };
  }

  const actions: string[] = Array.isArray(user?.permissions?.[page])
    ? (user!.permissions![page] as string[])
    : [];

  return {
    canView:   actions.includes("view"),
    canAdd:    actions.includes("add"),
    canEdit:   actions.includes("edit"),
    canDelete: actions.includes("delete"),
    isLoading: false,
  };
}
