"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { User, Department, Role } from "@/lib/types";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { UserEditForm } from "@/components/settings-edit-forms";
import { deleteUserAction } from "@/app/actions";

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
          <CardTitle>Existing Users</CardTitle>
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
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, or email"
            className="w-64"
          />
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-48">
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
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-48">
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

        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Employee No</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.fullName || user.name}</TableCell>
                  <TableCell>{user.employeeNo}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{String(user.role)}</TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserEditForm user={user} departments={departments} roles={roles} />
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
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </CardContent>
    </Card>
  );
}