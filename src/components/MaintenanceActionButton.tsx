"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import type { PermissionAction } from "@/lib/types";

type MaintenanceAction = Exclude<PermissionAction, "view"> | "view";

type MaintenanceActionButtonProps = React.ComponentProps<typeof Button> & {
  action: MaintenanceAction;
  hideIfNoAccess?: boolean;
  label?: string;
};

export default function MaintenanceActionButton(props: MaintenanceActionButtonProps) {
  const { action, hideIfNoAccess = false, label, disabled, children, ...rest } = props;
  const { user, isAdmin } = useAuth();

  const allowed = Boolean(
    isAdmin || (user?.permissions?.maintenance ?? []).includes(action as PermissionAction)
  );

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