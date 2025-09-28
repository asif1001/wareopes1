"use client"
import { useFormStatus } from "react-dom";
import { addUserAction, addSourceAction, addContainerSizeAction, addDepartmentAction, addBranchAction } from "@/app/actions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Department, Branch, userRoles } from "@/lib/types";
import { useEffect, useRef, useActionState } from "react";
import { useToast } from "@/hooks/use-toast";

function SubmitButton({ text = "Save" }: { text?: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : text}
        </Button>
    );
}

export function UserForm({ departments }: { departments: Department[] }) {
    const [state, formAction] = useActionState(addUserAction, { message: "" });
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
                        <Input id="employeeNo" name="employeeNo" type="number" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" name="password" type="password" required />
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
                                {userRoles.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
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
                        <Label htmlFor="location">Branch Location</Label>
                        <Input id="location" name="location" required />
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </form>
        </Card>
    );
}
