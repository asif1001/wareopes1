"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import type { Department, Role, User, PermissionAction, AppPageKey } from "@/lib/types";
import { UserEditForm } from "@/components/settings-edit-forms";

export function UserEditDialog({
  user,
  departments,
  roles,
  roleDefaults,
}: {
  user: User;
  departments: Department[];
  roles: Role[];
  roleDefaults?: Partial<Record<AppPageKey, Partial<Record<PermissionAction, boolean>>>>;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit User">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <UserEditForm user={user} departments={departments} roles={roles} roleDefaults={roleDefaults} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}