"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { User, Department, Role } from "@/lib/types";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { deleteUserAction } from "@/app/actions";
import { UserEditDialog } from "@/components/user-edit-dialog";

type Props = {
  users: User[];
  departments: Department[];
  roles: Role[];
};

function normalize(val: unknown) {
  return String(val ?? "").toLowerCase();
}

function matchesSearch(user: User, term: string) {
  if (!term) return true;
  const t = term.toLowerCase();
  return (
    normalize(user.fullName).includes(t) ||
    normalize(user.name).includes(t) ||
    normalize(user.employeeNo).includes(t) ||
    normalize(user.email).includes(t)
  );
}

export function ExistingUsersCard({ users, departments, roles }: Props) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [role, setRole] = useState<string>("all");

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const roleStr = String(u.role ?? "");
      const matchesDept = dept === "all" || u.department === dept;
      const matchesRole = role === "all" || roleStr === role;
      return matchesSearch(u, search) && matchesDept && matchesRole;
    });
  }, [users, search, dept, role]);

  const resetFilters = () => {
    setSearch("");
    setDept("all");
    setRole("all");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>Manage users; filter by department and role.</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {filteredUsers.length} of {users.length}
            </span>
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="space-y-1">
            <Label className="text-xs">Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, or email"
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Department</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id ?? d.name} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id ?? r.name} value={r.name}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground border rounded-md">
            No users match your filters.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee No</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="truncate" title={user.fullName || user.name}>{user.fullName || user.name}</TableCell>
                    <TableCell className="truncate" title={String(user.employeeNo)}>{user.employeeNo}</TableCell>
                    <TableCell className="truncate" title={user.email}>{user.email}</TableCell>
                    <TableCell className="truncate" title={String(user.role)}>{String(user.role)}</TableCell>
                    <TableCell className="truncate" title={user.department}>{user.department}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Edit opens modal; no inline form here */}
                        <UserEditDialog user={user} departments={departments} roles={roles} />
                        <DeleteConfirmationDialog
                          title="Delete User"
                          description={`Are you sure you want to delete ${user.fullName || user.name}? This action cannot be undone.`}
                          itemId={user.id}
                          deleteAction={deleteUserAction}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </CardContent>
    </Card>
  );
}
export default function SettingsUsersTable({ users, departments, roles }: { users: User[]; departments: Department[]; roles: Role[] }) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [role, setRole] = useState("all");

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch = !q || [u.fullName, u.name, u.email, String(u.employeeNo)].some((v) => String(v || "").toLowerCase().includes(q));
      const matchesDepartment = department === "all" || u.department === department;
      const matchesRole = role === "all" || String(u.role) === role;
      return matchesSearch && matchesDepartment && matchesRole;
    });
  }, [users, search, department, role]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Manage users; filter by department and role.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-1">
            <Label className="text-xs">Search</Label>
            <Input placeholder="Search name, ID, or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id ?? d.name} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id ?? r.name} value={r.name}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground border rounded-md">
            No users match your filters.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee No</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="truncate" title={user.fullName || user.name}>{user.fullName || user.name}</TableCell>
                    <TableCell className="truncate" title={String(user.employeeNo)}>{user.employeeNo}</TableCell>
                    <TableCell className="truncate" title={user.email}>{user.email}</TableCell>
                    <TableCell className="truncate" title={String(user.role)}>{String(user.role)}</TableCell>
                    <TableCell className="truncate" title={user.department}>{user.department}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Edit opens modal; no inline form here */}
                        <UserEditDialog user={user} departments={departments} roles={roles} />
                        <DeleteConfirmationDialog
                          title="Delete User"
                          description={`Are you sure you want to delete ${user.fullName || user.name}? This action cannot be undone.`}
                          itemId={user.id}
                          deleteAction={deleteUserAction}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </CardContent>
    </Card>
  );
}