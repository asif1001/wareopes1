"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { ModuleKey, PermissionAction } from "@/lib/permissions/registry";

/** Hides UI the user may not use. The server checks every action again. */
export function useCan() {
  const { isAdmin, permissions } = useAuth();
  return useCallback(
    (module: ModuleKey, action: PermissionAction) => {
      if (isAdmin) return true;
      const actions = (permissions as Record<string, string[] | undefined> | null)?.[module];
      return Array.isArray(actions) && actions.includes(action);
    },
    [isAdmin, permissions],
  );
}
