import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { MaintenanceClientPage } from "@/components/maintenance-client-page";
import { getUsers, getBranches } from "@/lib/firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft } from "lucide-react";
import type { UserPermissions } from "@/lib/types";
import { cookies } from "next/headers";

async function getCurrentUserPermissions(): Promise<{ ok: boolean; role?: string; permissions?: UserPermissions }>{
  try {
    const sessionCookie = (await cookies()).get('session');
    let userId: string | null = null;
    if (sessionCookie?.value) {
      try {
        const parsed = JSON.parse(sessionCookie.value);
        userId = typeof parsed?.id === 'string' ? parsed.id : sessionCookie.value;
      } catch {
        userId = sessionCookie.value;
      }
    }
    if (!userId) return { ok: false };

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const userSnap = await adb.collection('Users').doc(userId).get();
    if (!userSnap.exists) return { ok: false };
    const udata = userSnap.data() as any;
    let permissions: UserPermissions | undefined = udata?.permissions as any;
    const role: string | undefined = udata?.role;

    // Normalize permissions from role if explicit not set
    if (!permissions && role) {
      const rolesSnap = await adb.collection('Roles').where('name', '==', String(role)).get();
      if (!rolesSnap.empty) {
        const roleData = rolesSnap.docs[0].data() as any;
        const arr = Array.isArray(roleData?.permissions) ? roleData.permissions : [];
        const normalized: Record<string, string[]> = {};
        for (const item of arr) {
          if (typeof item !== 'string') continue;
          const [page, action] = item.split(':');
          if (!page || !action) continue;
          (normalized[page] ||= []).push(action);
        }
        permissions = normalized as any;
      }
    }

    return { ok: true, role, permissions };
  } catch {
    return { ok: false };
  }
}

export default function MaintenancePage() {
  const Page = async () => {
    const { ok, role, permissions } = await getCurrentUserPermissions();
    const canView = ok && (
      role === 'Admin' ||
      (permissions && Array.isArray((permissions as any)?.maintenance) && ((permissions as any).maintenance as string[]).includes('view'))
    );

    if (!canView) {
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Access Denied</CardTitle>
              <CardDescription>
                You don't have permission to access Maintenance. Contact an administrator.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                <p>Current role: <span className="font-medium">{String(role || 'Unknown')}</span></p>
                <p>Required: <span className="font-medium">Maintenance view permission or Admin</span></p>
              </div>
              <Button 
                onClick={() => { if (typeof window !== 'undefined') window.location.href = '/dashboard'; }}
                className="w-full"
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Fetch users and branches server-side to ensure data availability regardless of client Firestore rules
    const [usersRaw, branchesRaw] = await Promise.all([
      getUsers().catch(() => []),
      getBranches().catch(() => [])
    ]);

    // Serialize Firestore Timestamp/Date fields to ISO strings to satisfy Client Component prop requirements
    const toIso = (v: any): string | undefined => {
      if (!v) return undefined;
      if (typeof v === 'string') return v;
      if (v instanceof Date) return v.toISOString();
      if (typeof v?.toDate === 'function') {
        try { return v.toDate().toISOString(); } catch {}
      }
      if (typeof v?._seconds === 'number') {
        const ms = (v._seconds * 1000) + Math.floor((v._nanoseconds || 0) / 1_000_000);
        return new Date(ms).toISOString();
      }
      return undefined;
    };

    const users = (usersRaw as any[]).map((u) => ({
      id: String(u.id || ''),
      fullName: typeof u.fullName === 'string' ? u.fullName : (typeof u.name === 'string' ? u.name : ''),
      name: typeof u.name === 'string' ? u.name : undefined,
      employeeNo: String(u.employeeNo ?? ''),
      // Do not pass sensitive fields to client
      password: undefined,
      email: typeof u.email === 'string' ? u.email : undefined,
      phone: typeof u.phone === 'string' ? u.phone : undefined,
      department: String(u.department || ''),
      role: u.role,
      redirectPage: typeof u.redirectPage === 'string' ? u.redirectPage : undefined,
      profilePicture: typeof u.profilePicture === 'string' ? u.profilePicture : undefined,
      createdAt: toIso(u.createdAt),
      updatedAt: toIso(u.updatedAt),
      permissions: u.permissions ?? undefined,
    }));

    const branches = (branchesRaw as any[]).map((b) => ({
      id: String(b.id || ''),
      name: String(b.name || ''),
      code: typeof b.code === 'string' ? b.code : '',
    }));

    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Vehicle & MHE Maintenance" />
        <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
          <Suspense fallback={<div>Loading...</div>}>
            <MaintenanceClientPage initialUsers={users} initialBranches={branches} />
          </Suspense>
        </main>
      </div>
    );
  };

  // Wrap async in a component to keep default export signature
  // Next.js supports async Server Components; returning the inner async component works.
  return <Page />;
}