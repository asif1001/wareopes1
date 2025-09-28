import { DashboardHeader } from "@/components/dashboard-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBranches, getDepartments, getContainerSizes, getSources, getUsers } from "@/lib/firebase/firestore";
import { UserForm, SourceForm, ContainerSizeForm, DepartmentForm, BranchForm } from "@/components/settings-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Edit } from "lucide-react";
import { deleteUserAction, deleteSourceAction, deleteContainerSizeAction, deleteDepartmentAction, deleteBranchAction } from "@/app/actions";
import { UserEditForm, SourceEditForm, ContainerSizeEditForm, DepartmentEditForm, BranchEditForm } from "@/components/settings-edit-forms";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import type { User, Source, ContainerSize, Department, Branch } from "@/lib/types";
import { BulkImport } from "@/components/bulk-import";
import { AdminRoute } from "@/components/AdminRoute";

async function UsersTable() {
  const users = await getUsers();
  const departments = await getDepartments();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Existing Users</CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Employee No</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.fullName}</TableCell>
                <TableCell>{user.employeeNo}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.department}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell className="text-right flex justify-end gap-2">
                    <UserEditForm user={user} departments={departments} />
                    <DeleteConfirmationDialog
                      title="Delete User"
                      description={`Are you sure you want to delete ${user.fullName}? This action cannot be undone.`}
                      itemId={user.id}
                      deleteAction={deleteUserAction}
                    />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {/* Bottom scroll indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background/80 to-transparent pointer-events-none flex items-end justify-center pb-1">
          <div className="w-8 h-1 bg-muted-foreground/30 rounded-full"></div>
        </div>
      </CardContent>
    </Card>
  );
}

async function SourcesTable() {
    const sources = await getSources();
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
                        {sources.map((source) => (
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
                        {containerSizes.map((size) => (
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
                        {departments.map((dept) => (
                            <TableRow key={dept.id}>
                                <TableCell>{dept.name}</TableCell>
                                <TableCell>{dept.branch}</TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    <DepartmentEditForm department={dept} branches={branches} />
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
                        {branches.map((branch) => (
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

export default async function SettingsPage() {
  const departments = await getDepartments();
  const branches = await getBranches();

  return (
    <AdminRoute>
      <div className="flex flex-col h-full">
        <DashboardHeader title="Settings" />
        <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
          <Tabs defaultValue="users">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="users">User</TabsTrigger>
              <TabsTrigger value="sources">Source</TabsTrigger>
              <TabsTrigger value="containers">Container Size</TabsTrigger>
              <TabsTrigger value="departments">Department</TabsTrigger>
              <TabsTrigger value="branches">Branch</TabsTrigger>
              <TabsTrigger value="bulk-import">Bulk Import</TabsTrigger>
            </TabsList>
            <TabsContent value="users">
              <div className="grid lg:grid-cols-2 gap-6">
                  <UserForm departments={departments} />
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
                  <DepartmentForm branches={branches} />
                  <DepartmentsTable />
              </div>
            </TabsContent>
            <TabsContent value="branches">
              <div className="grid lg:grid-cols-2 gap-6">
                  <BranchForm />
                  <BranchesTable />
              </div>
            </TabsContent>
            <TabsContent value="bulk-import">
              <BulkImport />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AdminRoute>
  );
}
