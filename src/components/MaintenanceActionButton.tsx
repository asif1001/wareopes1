"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import type { PermissionAction } from "@/lib/types";

type MaintenanceAction = Exclude<PermissionAction, "view"> | "view";

type MaintenanceActionButtonProps = React.ComponentProps<typeof Button> & {
  action: MaintenanceAction;
  hideIfNoAccess?: boolean;
  label?: string;
};

export default function MaintenanceActionButton(props: MaintenanceActionButtonProps) {
  const { action, hideIfNoAccess = false, label, disabled, children, ...rest } = props;
  const { canView, canAdd, canEdit, canDelete } = usePagePermissions('maintenance');

  const actionMap: Record<MaintenanceAction, boolean> = {
    view: canView,
    add: canAdd,
    edit: canEdit,
    delete: canDelete,
  };
  const allowed = actionMap[action] ?? false;

  if (!allowed && hideIfNoAccess) {
    return null;
  }

  return (
    <Button
      aria-label={label}
      title={label}
      disabled={!allowed || disabled}
      {...rest}
    >
      {children}
    </Button>
  );
}