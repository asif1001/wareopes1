"use client"
import { useFormStatus } from "react-dom";
import { addUserAction, addSourceAction, addContainerSizeAction, addDepartmentAction, addBranchAction, addRoleAction } from "@/app/actions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Department, Branch, Role, userRoles } from "@/lib/types";
import { APP_PAGES, PERMISSION_ACTIONS } from "@/lib/role-utils";
import { useEffect, useRef, useActionState, useState } from "react";
import { useToast } from "@/hooks/use-toast";

function SubmitButton({ text = "Save" }: { text?: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : text}
        </Button>
    );
}

export function UserForm({ departments, roles }: { departments: Department[]; roles: Role[] }) {
    const [state, formAction] = useActionState(addUserAction, { message: "" });
    const formRef = useRef<HTMLFormElement>(null);
    const employeeNoRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Derive role options from dynamic roles with fallback to static roles
    const roleOptions = (roles && roles.length > 0) ? roles.map(r => r.name) : userRoles;

    useEffect(() => {
        if (state?.message) {
            if (state.message.includes("success")) {
                toast({ title: "Success", description: state.message });
                formRef.current?.reset();
            } else {
                 toast({ title: "Error", description: state.message, variant: "destructive" });
                 if (employeeNoRef.current) employeeNoRef.current.value = "";
                 if (passwordRef.current) passwordRef.current.value = "";
            }
        }
    }, [state, toast]);

    return (
        <Card>
            <form action={formAction} ref={formRef}>
                <CardHeader>
                    <CardTitle>Create User</CardTitle>
                    <CardDescription>Add a new user to the system.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input id="fullName" name="fullName" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="employeeNo">Employee No/CPR No</Label>
                        <Input id="employeeNo" name="employeeNo" type="number" required autoComplete="off" ref={employeeNoRef} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" name="password" type="password" required autoComplete="new-password" ref={passwordRef} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email ID (Optional)</Label>
                        <Input id="email" name="email" type="email" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="department">Department</Label>
                        <Select name="department" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a department" />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="role">Role</Label>
                        <Select name="role" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {roleOptions.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Redirect Page Selection */}
                    <div className="grid gap-2">
                        <Label htmlFor="redirectPage">Default Redirect Page (Optional)</Label>
                        <Select name="redirectPage">
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
                    {/* Permissions grid */}
                    <div className="space-y-2">
                        <Label>Permissions</Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {APP_PAGES.map(page => (
                                <div key={page} className="border rounded-md p-3">
                                    <div className="font-medium mb-2 capitalize">{page}</div>
                                    <div className="flex flex-wrap gap-3">
                                        {PERMISSION_ACTIONS.map(action => (
                                            <label key={action} className="flex items-center gap-2">
                                                <input type="checkbox" name={`perm:${page}:${action}`} />
                                                <span className="capitalize">{action}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">If left blank, role-based defaults apply.</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </form>
        </Card>
    );
}

export function SourceForm() {
    const [state, formAction] = useActionState(addSourceAction, { message: "" });
     const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (state?.message) {
            if (state.message.includes("success")) {
                toast({ title: "Success", description: state.message });
                formRef.current?.reset();
            } else {
                 toast({ title: "Error", description: state.message, variant: "destructive" });
            }
        }
    }, [state, toast]);

    return (
        <Card>
            <form action={formAction} ref={formRef}>
                <CardHeader>
                    <CardTitle>Create Source</CardTitle>
                    <CardDescription>Add a new source.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="code">Source Code</Label>
                        <Input id="code" name="code" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="name">Source Name</Label>
                        <Input id="name" name="name" required />
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </form>
        </Card>
    );
}

export function ContainerSizeForm() {
    const [state, formAction] = useActionState(addContainerSizeAction, { message: "" });
     const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (state?.message) {
            if (state.message.includes("success")) {
                toast({ title: "Success", description: state.message });
                formRef.current?.reset();
            } else {
                 toast({ title: "Error", description: state.message, variant: "destructive" });
            }
        }
    }, [state, toast]);

    return (
        <Card>
            <form action={formAction} ref={formRef}>
                <CardHeader>
                    <CardTitle>Create Container Size</CardTitle>
                    <CardDescription>Add a new container size.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="size">Container Size</Label>
                        <Input id="size" name="size" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Input id="description" name="description" />
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </form>
        </Card>
    );
}

export function DepartmentForm({ branches }: { branches: Branch[] }) {
    const [state, formAction] = useActionState(addDepartmentAction, { message: "" });
     const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (state?.message) {
            if (state.message.includes("success")) {
                toast({ title: "Success", description: state.message });
                formRef.current?.reset();
            } else {
                 toast({ title: "Error", description: state.message, variant: "destructive" });
            }
        }
    }, [state, toast]);

    return (
        <Card>
            <form action={formAction} ref={formRef}>
                <CardHeader>
                    <CardTitle>Create Department</CardTitle>
                    <CardDescription>Add a new department.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Department Name</Label>
                        <Input id="name" name="name" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="branch">Branch</Label>
                        <Select name="branch" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a branch" />
                            </SelectTrigger>
                            <SelectContent>
                                {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </form>
        </Card>
    );
}

export function BranchForm() {
    const [state, formAction] = useActionState(addBranchAction, { message: "" });
     const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (state?.message) {
            if (state.message.includes("success")) {
                toast({ title: "Success", description: state.message });
                formRef.current?.reset();
            } else {
                 toast({ title: "Error", description: state.message, variant: "destructive" });
            }
        }
    }, [state, toast]);
    
    return (
        <Card>
            <form action={formAction} ref={formRef}>
                <CardHeader>
                    <CardTitle>Create Branch</CardTitle>
                    <CardDescription>Add a new branch.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Branch Name</Label>
                        <Input id="name" name="name" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="code">Branch Code</Label>
                        <Input id="code" name="code" required />
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </form>
        </Card>
    );
}

export function RoleForm() {
  const [state, formAction] = useActionState(addRoleAction, { message: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [permInput, setPermInput] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);

  const addPerm = () => {
    const p = permInput.trim();
    if (!p) return;
    if (permissions.includes(p)) return;
    setPermissions(prev => [...prev, p]);
    setPermInput("");
  };
  const removePerm = (p: string) => {
    setPermissions(prev => prev.filter(x => x !== p));
  };

  useEffect(() => {
    if (state?.message) {
      if (state.message.includes("success")) {
        toast({ title: "Success", description: state.message });
        formRef.current?.reset();
        setPermissions([]);
        setPermInput("");
      } else {
        toast({ title: "Error", description: state.message, variant: "destructive" });
      }
    }
  }, [state, toast]);

  return (
    <Card>
      <form action={formAction} ref={formRef}>
        <CardHeader>
          <CardTitle>Create Role</CardTitle>
          <CardDescription>Define a role name and optional permissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Role Name</Label>
            <Input id="name" name="name" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="permissionInput">Permissions</Label>
            <div className="flex gap-2">
              <Input
                id="permissionInput"
                value={permInput}
                onChange={(e) => setPermInput(e.target.value)}
                placeholder="e.g. manage_users"
              />
              <Button type="button" onClick={addPerm}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {permissions.map(p => (
                <div key={p} className="flex items-center gap-2 border rounded px-2 py-1 text-sm">
                  <span>{p}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removePerm(p)}>Remove</Button>
                  <input type="hidden" name="permissions" value={p} />
                </div>
              ))}
              {permissions.length === 0 && (
                <p className="text-xs text-muted-foreground">Add permissions or leave empty.</p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
