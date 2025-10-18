"use client"
import { useFormStatus } from "react-dom";
import { updateUserAction, updateSourceAction, updateContainerSizeAction, updateDepartmentAction, updateBranchAction } from "@/app/actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Department, Branch, User, Source, ContainerSize, Role, userRoles } from "@/lib/types";
import { useEffect, useState, useRef, useActionState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Edit } from "lucide-react";

function SubmitButton({ text = "Save Changes" }: { text?: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : text}
        </Button>
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

export function UserEditForm({ user, departments, roles }: { user: User; departments: Department[]; roles: Role[] }) {
    const { formAction, open, setOpen } = useEditFormState(updateUserAction, { message: "" });
    // Derive role options from dynamic roles with fallback to static roles
    const roleOptions = (roles && roles.length > 0) ? roles.map(r => r.name) : userRoles;
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                    <DialogDescription>Update the user's details.</DialogDescription>
                </DialogHeader>
                <form action={formAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input id="fullName" name="fullName" required defaultValue={user.fullName} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="employeeNo">Employee No/CPR No</Label>
                            <Input id="employeeNo" name="employeeNo" type="number" required defaultValue={user.employeeNo} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email ID (Optional)</Label>
                            <Input id="email" name="email" type="email" defaultValue={user.email} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="department">Department</Label>
                            <Select name="department" required defaultValue={user.department}>
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
                            <Select name="role" required defaultValue={user.role}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roleOptions.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
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
                        <SubmitButton />
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
                        <SubmitButton />
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
                        <SubmitButton />
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
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
