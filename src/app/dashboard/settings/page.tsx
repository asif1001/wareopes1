export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { DashboardHeader } from "@/components/dashboard-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBranches, getDepartments, getContainerSizes, getSources, getUsers, getRoles } from "@/lib/firebase/firestore";
import { makeSerializable } from "@/lib/serialization";
import { UserForm, SourceForm, ContainerSizeForm, DepartmentForm, BranchForm, RoleForm } from "@/components/settings-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Edit } from "lucide-react";
import { deleteUserAction, deleteSourceAction, deleteContainerSizeAction, deleteDepartmentAction, deleteBranchAction, deleteRoleAction } from "@/app/actions";
import { UserEditForm, SourceEditForm, ContainerSizeEditForm, DepartmentEditForm, BranchEditForm } from "@/components/settings-edit-forms";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import type { User, Source, ContainerSize, Department, Branch, Role } from "@/lib/types";
import { AddUserDialog } from "@/components/add-user-dialog";

import { redirect } from "next/navigation";
import { guardPage } from "@/lib/permissions/server";
import { can } from "@/lib/permissions/resolve";
import { getAccessControlData } from "./access-actions";
import { AccessControlPanel } from "@/components/access-control/access-control-panel";

import { getFormTemplatesAction } from "@/app/actions";
import { RoleFormsSettings } from "@/components/role-forms-settings";
import { ExistingUsersCard } from "@/components/settings-users-table";

function UsersTable({ users, departments, roles }: { users: User[], departments: Department[], roles: Role[] }) {
  const serializableUsers = JSON.parse(JSON.stringify(users));
  const serializableDepartments = JSON.parse(JSON.stringify(departments));
  const serializableRoles = JSON.parse(JSON.stringify(roles));

  return (
    <ExistingUsersCard
      users={serializableUsers}
      departments={serializableDepartments}
      roles={serializableRoles}
    />
  );
}

function SourcesTable({ sources }: { sources: Source[] }) {
    const serializableSources = sources.map(makeSerializable);
    return (
        <Card>
            <CardHeader>
                <CardTitle>Existing Sources</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Short Name</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {serializableSources.map((source) => (
                            <TableRow key={source.id}>
                                <TableCell>{source.shortName}</TableCell>
                                <TableCell>{source.name}</TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    <SourceEditForm source={source} />
                                    <DeleteConfirmationDialog
                                      title="Delete Source"
                                      description={`Are you sure you want to delete ${source.name}? This action cannot be undone.`}
                                      itemId={source.id}
                                      deleteAction={deleteSourceAction}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function ContainerSizesTable({ containerSizes }: { containerSizes: ContainerSize[] }) {
    const serializableSizes = containerSizes.map(makeSerializable);
    return (
        <Card>
            <CardHeader>
                <CardTitle>Existing Container Sizes</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Container Size</TableHead>
                            <TableHead>CMB</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {serializableSizes.map((size) => (
                            <TableRow key={size.id}>
                                <TableCell>{size.size}</TableCell>
                                <TableCell>{size.cmb}</TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    <ContainerSizeEditForm containerSize={size} />
                                    <DeleteConfirmationDialog
                                      title="Delete Container Size"
                                      description={`Are you sure you want to delete ${size.size}? This action cannot be undone.`}
                                      itemId={size.id}
                                      deleteAction={deleteContainerSizeAction}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function DepartmentsTable({ departments, branches }: { departments: Department[], branches: Branch[] }) {
    const serializableDepartments = departments.map(makeSerializable);
    const serializableBranches = branches.map(makeSerializable);
    return (
        <Card>
            <CardHeader>
                <CardTitle>Existing Departments</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Department Name</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {serializableDepartments.map((dept) => (
                            <TableRow key={dept.id}>
                                <TableCell>{dept.name}</TableCell>
                                <TableCell>{dept.branch}</TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    <DepartmentEditForm department={dept} branches={serializableBranches} />
                                    <DeleteConfirmationDialog
                                      title="Delete Department"
                                      description={`Are you sure you want to delete ${dept.name}? This action cannot be undone.`}
                                      itemId={dept.id}
                                      deleteAction={deleteDepartmentAction}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function BranchesTable({ branches }: { branches: Branch[] }) {
    const serializableBranches = branches.map(makeSerializable);
    return (
        <Card>
            <CardHeader>
                <CardTitle>Existing Branches</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Branch Name</TableHead>
                            <TableHead>Branch Code</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {serializableBranches.map((branch) => (
                            <TableRow key={branch.id}>
                                <TableCell>{branch.name}</TableCell>
                                <TableCell>{branch.code}</TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    <BranchEditForm branch={branch} />
                                    <DeleteConfirmationDialog
                                      title="Delete Branch"
                                      description={`Are you sure you want to delete ${branch.name}? This action cannot be undone.`}
                                      itemId={branch.id}
                                      deleteAction={deleteBranchAction}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function RolesTable({ roles }: { roles: Role[] }) {
    const serializableRoles = roles.map(makeSerializable);
    return (
        <Card>
            <CardHeader>
                <CardTitle>Existing Roles</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Permissions</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {serializableRoles.map((role) => (
                            <TableRow key={role.id}>
                                <TableCell>{role.name}</TableCell>
                                <TableCell>{(role.permissions || []).join(", ")}</TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    <DeleteConfirmationDialog
                                      title="Delete Role"
                                      description={`Are you sure you want to delete ${role.name}? This action cannot be undone.`}
                                      itemId={role.id}
                                      deleteAction={deleteRoleAction}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export default async function SettingsPage() {
  const access = await guardPage('signed-in');
  const canUsers = can(access, 'user_management', 'view');
  const canMaster = can(access, 'settings', 'view');
  if (!canUsers && !canMaster) redirect('/dashboard?denied=settings');

  const [
    departments,
    branches,
    roles,
    users,
    sources,
    containerSizes,
    formsResult
  ] = await Promise.all([
    getDepartments(),
    getBranches(),
    getRoles(),
    canUsers ? getUsers() : Promise.resolve([] as User[]),
    getSources(),
    getContainerSizes(),
    access.isAdmin ? getFormTemplatesAction() : Promise.resolve({ success: true, data: [] } as Awaited<ReturnType<typeof getFormTemplatesAction>>)
  ]);
  const accessControl = access.isAdmin ? await getAccessControlData() : null;

  const serializableDepartments = departments.map(makeSerializable);
  const serializableBranches = branches.map(makeSerializable);
  const serializableRoles = roles.map(makeSerializable);
  const initialTemplates = formsResult.success && formsResult.data ? formsResult.data.map(makeSerializable) : [];

  const tabs = [
    canUsers && { value: 'users', label: 'User' },
    canMaster && { value: 'sources', label: 'Source' },
    canMaster && { value: 'containers', label: 'Container Size' },
    canMaster && { value: 'departments', label: 'Department' },
    canMaster && { value: 'branches', label: 'Branch' },
    access.isAdmin && { value: 'role-forms', label: 'Role-Based Forms' },
    access.isAdmin && { value: 'roles', label: 'Roles' },
    accessControl && { value: 'access', label: 'Access control' },
  ].filter(Boolean) as { value: string; label: string }[];

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Settings" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        <Tabs defaultValue={tabs[0]?.value}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {canUsers && (
            <TabsContent value="users">
              <div className="flex flex-col gap-4">
                {can(access, 'user_management', 'add') && (
                  <div className="flex items-center justify-end">
                    <AddUserDialog departments={serializableDepartments} roles={serializableRoles} />
                  </div>
                )}
                <UsersTable users={users} departments={departments} roles={roles} />
              </div>
            </TabsContent>
          )}
          {canMaster && (
            <>
              <TabsContent value="sources">
                <div className="grid lg:grid-cols-2 gap-6">
                    <SourceForm />
                    <SourcesTable sources={sources} />
                </div>
              </TabsContent>
              <TabsContent value="containers">
                <div className="grid lg:grid-cols-2 gap-6">
                    <ContainerSizeForm />
                    <ContainerSizesTable containerSizes={containerSizes} />
                </div>
              </TabsContent>
              <TabsContent value="departments">
                <div className="grid lg:grid-cols-2 gap-6">
                    <DepartmentForm branches={serializableBranches} />
                    <DepartmentsTable departments={departments} branches={branches} />
                </div>
              </TabsContent>
              <TabsContent value="branches">
                <div className="grid lg:grid-cols-2 gap-6">
                    <BranchForm />
                    <BranchesTable branches={branches} />
                </div>
              </TabsContent>
            </>
          )}
          {access.isAdmin && (
            <TabsContent value="role-forms">
              <RoleFormsSettings initialTemplates={initialTemplates} roles={serializableRoles} />
            </TabsContent>
          )}
          {access.isAdmin && (
            <TabsContent value="roles">
              <div className="grid lg:grid-cols-2 gap-6">
                <RoleForm roles={serializableRoles} />
                <RolesTable roles={roles} />
              </div>
            </TabsContent>
          )}
          {accessControl && (
            <TabsContent value="access">
              <AccessControlPanel {...accessControl} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}