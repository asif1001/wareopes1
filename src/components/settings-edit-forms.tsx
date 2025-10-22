"use client"
import { useEffect, useRef } from "react";
import { updateUserAction, updateSourceAction, updateContainerSizeAction, updateDepartmentAction, updateBranchAction } from "@/app/actions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit } from "lucide-react";
import { Department, Branch, Role, User, userRoles, PermissionAction, AppPageKey, Source, ContainerSize } from "@/lib/types";
import { APP_PAGES, PERMISSION_ACTIONS } from "@/lib/role-utils";
import { useFormStatus } from "react-dom";
import { useActionState, useState } from "react";
import { useToast } from "@/hooks/use-toast";

function SubmitButton({ text = "Update" }: { text?: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Updating..." : text}
        </Button>
    );
}

export function UserEditForm({ departments, roles, user, roleDefaults, onSuccess }: { departments: Department[]; roles: Role[]; user: User; roleDefaults?: Partial<Record<AppPageKey, Partial<Record<PermissionAction, boolean>>>>; onSuccess?: () => void }) {
    const [state, formAction] = useActionState(updateUserAction, { message: "" });
    const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();

    const roleOptions = (roles && roles.length > 0) ? roles.map(r => r.name) : userRoles;

    useEffect(() => {
        if (state?.message) {
            const isSuccess = state.message.toLowerCase().includes("success");
            toast({ title: isSuccess ? "Success" : "Error", description: state.message, variant: isSuccess ? undefined : "destructive" });
            if (isSuccess && typeof onSuccess === 'function') {
                onSuccess();
            }
        }
    }, [state, toast, onSuccess]);

    const getInitialChecked = (page: AppPageKey, action: PermissionAction) => {
        const actions = user.permissions?.[page];
        if (Array.isArray(actions)) return actions.includes(action);
        const rolePerm = roleDefaults?.[page]?.[action];
        return !!rolePerm; // fallback to role default if available
    };

    return (
        <form ref={formRef} action={formAction}>
            <Card className="max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>Edit User</CardTitle>
                    <CardDescription>Update the user's details and permissions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <input type="hidden" name="id" value={user.id} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input id="fullName" name="fullName" required defaultValue={user.fullName} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="employeeNo">Employee No</Label>
                            <Input id="employeeNo" name="employeeNo" required defaultValue={user.employeeNo} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="department">Department</Label>
                            <Select name="department" defaultValue={user.department}>
                                <SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger>
                                <SelectContent>
                                    {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="role">Role</Label>
                            <Select name="role" defaultValue={user.role}>
                                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                                <SelectContent>
                                    {roleOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="redirectPage">Default Redirect Page (Optional)</Label>
                            <Select name="redirectPage" defaultValue={user.redirectPage}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select default page after login" />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* Removed empty-value item per Radix Select API */}
                                    <SelectItem value="/dashboard">Dashboard</SelectItem>
                                    <SelectItem value="/dashboard/admin">Admin Dashboard</SelectItem>
                                    <SelectItem value="/dashboard/manager">Manager Dashboard</SelectItem>
                                    <SelectItem value="/dashboard/employee">Employee Dashboard</SelectItem>
                                    <SelectItem value="/dashboard/shipments">Shipments</SelectItem>
                                    <SelectItem value="/dashboard/tasks">Tasks</SelectItem>
                                    <SelectItem value="/dashboard/feedback">Feedback</SelectItem>
                                    <SelectItem value="/dashboard/reports">Reports</SelectItem>
                                    <SelectItem value="/dashboard/settings">Settings</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground">
                                If not set, user will be redirected based on their role default
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="newPassword">New Password (Optional)</Label>
                            <Input id="newPassword" name="newPassword" type="password" placeholder="Enter a new password" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>Permissions</Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {APP_PAGES.map(page => (
                                <div key={page} className="border rounded-md p-3">
                                    <div className="font-medium mb-2 capitalize">{page}</div>
                                    <div className="flex flex-wrap gap-3">
                                        {PERMISSION_ACTIONS.map(action => (
                                            <label key={action} className="flex items-center gap-2">
                                               <input type="checkbox" name={`perm:${page}:${action}`} defaultChecked={getInitialChecked(page as AppPageKey, action as PermissionAction)} />
                                                <span className="capitalize">{action}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Unchecked boxes rely on role defaults.</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}

function useEditFormState(action: any, initialState: any) {
  const [state, formAction] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.message) {
      if (state.message.includes("success")) {
        toast({ title: "Success", description: state.message });
        setOpen(false);
      } else {
        toast({ title: "Error", description: state.message, variant: "destructive" });
      }
    }
  }, [state, toast]);

  return { formAction, open, setOpen };
}

export function SourceEditForm({ source }: { source: Source }) {
  const { formAction, open, setOpen } = useEditFormState(updateSourceAction, { message: "" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Source</DialogTitle>
          <DialogDescription>Update the source details.</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={source.id} />
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="shortName">Source Short Name</Label>
              <Input id="shortName" name="shortName" required defaultValue={source.shortName} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Source Name</Label>
              <Input id="name" name="name" required defaultValue={source.name} />
            </div>
          </div>
          <DialogFooter>
            <SubmitButton text="Save Changes" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContainerSizeEditForm({ containerSize }: { containerSize: ContainerSize }) {
  const { formAction, open, setOpen } = useEditFormState(updateContainerSizeAction, { message: "" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Container Size</DialogTitle>
          <DialogDescription>Update the container size details.</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={containerSize.id} />
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="size">Container Size</Label>
              <Input id="size" name="size" required defaultValue={containerSize.size} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cmb">CMB</Label>
              <Input id="cmb" name="cmb" required defaultValue={containerSize.cmb} />
            </div>
          </div>
          <DialogFooter>
            <SubmitButton text="Save Changes" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DepartmentEditForm({ department, branches }: { department: Department; branches: Branch[] }) {
  const { formAction, open, setOpen } = useEditFormState(updateDepartmentAction, { message: "" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
          <DialogDescription>Update the department details.</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={department.id} />
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Department Name</Label>
              <Input id="name" name="name" required defaultValue={department.name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="branch">Branch</Label>
              <Select name="branch" required defaultValue={department.branch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <SubmitButton text="Save Changes" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BranchEditForm({ branch }: { branch: Branch }) {
  const { formAction, open, setOpen } = useEditFormState(updateBranchAction, { message: "" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Branch</DialogTitle>
          <DialogDescription>Update the branch details.</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={branch.id} />
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Branch Name</Label>
              <Input id="name" name="name" required defaultValue={branch.name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">Branch Code</Label>
              <Input id="code" name="code" required defaultValue={branch.code} />
            </div>
          </div>
          <DialogFooter>
            <SubmitButton text="Save Changes" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
