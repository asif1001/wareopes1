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

import { AdminRoute } from "@/components/AdminRoute";
import { getFormTemplatesAction } from "@/app/actions";
import { RoleFormsSettings } from "@/components/role-forms-settings";
import { ExistingUsersCard } from "@/components/settings-users-table";
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

async function UsersTable() {
  const users = await getUsers();
  const departments = await getDepartments();
  const roles = await getRoles();
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

async function SourcesTable() {
    const sources = await getSources();
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

async function ContainerSizesTable() {
    const containerSizes = await getContainerSizes();
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

async function DepartmentsTable() {
    const departments = await getDepartments();
    const branches = await getBranches();
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

async function BranchesTable() {
    const branches = await getBranches();
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

async function RolesTable() {
    const roles = await getRoles();
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
  // Server-side gate: ensure user has settings:view or is admin
  const c = await cookies();
  const rawSession = c.get('session')?.value;
  let userId: string | null = null;
  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession);
      userId = typeof parsed?.id === 'string' ? parsed.id : rawSession;
    } catch {
      userId = rawSession;
    }
  }
  if (!userId) {
    redirect('/');
  }

  const { getAdminDb } = await import('@/lib/firebase/admin');
  const adb = await getAdminDb();
  const snap = await adb.collection('Users').doc(userId!).get();
  const udata = snap.exists ? (snap.data() as any) : {};
  if (!udata?.role && !udata?.permissions) {
    redirect('/dashboard');
  }

  let permissions = udata?.permissions as any | undefined;
  if (!permissions && udata?.role) {
    const rolesSnap = await adb.collection('Roles').where('name', '==', String(udata.role)).get();
    if (!rolesSnap.empty) {
      const roleData = rolesSnap.docs[0].data() as any;
      const arr = Array.isArray(roleData?.permissions) ? roleData.permissions : [];
      const normalized: any = {};
      for (const item of arr) {
        if (typeof item !== 'string') continue;
        const [page, action] = item.split(':');
        if (!page || !action) continue;
        (normalized[page] ||= []).push(action);
      }
      permissions = Object.keys(normalized).length ? normalized : undefined;
    }
  }
  const isAdmin = String(udata?.role || '').toLowerCase() === 'admin';
  const canViewSettings = isAdmin || (Array.isArray(permissions?.settings) && permissions.settings.includes('view'));
  if (!canViewSettings) {
    redirect('/dashboard');
  }

  const departments = await getDepartments();
  const branches = await getBranches();
  const roles = await getRoles();
  const serializableDepartments = departments.map(makeSerializable);
  const serializableBranches = branches.map(makeSerializable);
  const serializableRoles = roles.map(makeSerializable);
  const formsResult = await getFormTemplatesAction();
  const initialTemplates = formsResult.success && formsResult.data ? formsResult.data.map(makeSerializable) : [];

  return (
    <AdminRoute>
      <div className="flex flex-col h-full">
        <DashboardHeader title="Settings" />
        <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
          <Tabs defaultValue="users">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="users">User</TabsTrigger>
              <TabsTrigger value="sources">Source</TabsTrigger>
              <TabsTrigger value="containers">Container Size</TabsTrigger>
              <TabsTrigger value="departments">Department</TabsTrigger>
              <TabsTrigger value="branches">Branch</TabsTrigger>
              <TabsTrigger value="role-forms">Role-Based Forms</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
            </TabsList>
            <TabsContent value="users">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-end">
                  <AddUserDialog departments={serializableDepartments} roles={serializableRoles} />
                </div>
                <UsersTable />
              </div>
            </TabsContent>
            <TabsContent value="sources">
              <div className="grid lg:grid-cols-2 gap-6">
                  <SourceForm />
                  <SourcesTable />
              </div>
            </TabsContent>
            <TabsContent value="containers">
              <div className="grid lg:grid-cols-2 gap-6">
                  <ContainerSizeForm />
                  <ContainerSizesTable />
              </div>
            </TabsContent>
            <TabsContent value="departments">
              <div className="grid lg:grid-cols-2 gap-6">
                  <DepartmentForm branches={serializableBranches} />
                  <DepartmentsTable />
              </div>
            </TabsContent>
            <TabsContent value="branches">
              <div className="grid lg:grid-cols-2 gap-6">
                  <BranchForm />
                  <BranchesTable />
              </div>
            </TabsContent>
            <TabsContent value="role-forms">
              <RoleFormsSettings initialTemplates={initialTemplates} roles={serializableRoles} />
            </TabsContent>
            <TabsContent value="roles">
              <div className="grid lg:grid-cols-2 gap-6">
                <RoleForm />
                <RolesTable />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AdminRoute>
  );
}
