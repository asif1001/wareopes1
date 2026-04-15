import { Suspense } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { StaffClientPage } from "@/components/staff-client-page";
import { getBranches } from "@/lib/firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft } from "lucide-react";
import type { UserPermissions } from "@/lib/types";
import { cookies } from "next/headers";

async function getCurrentUserPermissions(): Promise<{ ok: boolean; role?: string; permissions?: UserPermissions }> {
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

export default function StaffPage() {
  const Page = async () => {
    const { ok, role, permissions } = await getCurrentUserPermissions();
    const canView = ok && (
      role === 'Admin' ||
      (permissions && Array.isArray((permissions as any)?.staff) && ((permissions as any).staff as string[]).includes('view'))
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
                You don&apos;t have permission to access Staff. Contact an administrator.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                <p>Current role: <span className="font-medium">{String(role || 'Unknown')}</span></p>
                <p>Required: <span className="font-medium">Staff view permission or Admin</span></p>
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    const toIso = (v: any): string | undefined => {
      if (!v) return undefined;
      if (typeof v === 'string') return v;
      if (v instanceof Date) return v.toISOString();
      if (typeof v?.toDate === 'function') { try { return v.toDate().toISOString(); } catch {} }
      if (typeof v?._seconds === 'number') {
        return new Date((v._seconds * 1000) + Math.floor((v._nanoseconds || 0) / 1_000_000)).toISOString();
      }
      return undefined;
    };

    const branchesRaw = await getBranches().catch(() => []);
    const branches = (branchesRaw as any[]).map(b => ({
      id: String(b.id || ''),
      name: String(b.name || ''),
      code: typeof b.code === 'string' ? b.code : '',
    }));

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const staffSnap = await adb.collection('staff').orderBy('createdAt', 'desc').limit(100).get().catch(() => ({ docs: [] } as any));

    const staffList = (staffSnap as any).docs.map((d: any) => {
      const s = d.data() || {};
      return {
        id: d.id,
        type: s.type || 'Staff',
        fullName: s.fullName || '',
        status: s.status || 'Active',
        cprNo: s.cprNo ?? null,
        contactNo: s.contactNo ?? null,
        cprExpiry: s.cprExpiry ?? null,
        visaExpiry: s.visaExpiry ?? null,
        contractorCompanyName: s.contractorCompanyName ?? null,
        assignedShiftId: s.assignedShiftId ?? null,
        assignedShiftName: s.assignedShiftName ?? null,
        companyName: s.companyName ?? null,
        contactPersonName: s.contactPersonName ?? null,
        contactPersonPhone: s.contactPersonPhone ?? null,
        contactPersonEmail: s.contactPersonEmail ?? null,
        employeeId: s.employeeId ?? null,
        designation: s.designation ?? null,
        department: s.department ?? null,
        branch: s.branch ?? null,
        phone: s.phone ?? null,
        email: s.email ?? null,
        nationality: s.nationality ?? null,
        contractStartDate: s.contractStartDate ?? null,
        contractEndDate: s.contractEndDate ?? null,
        ratePerHour: s.ratePerHour != null ? Number(s.ratePerHour) : null,
        currency: s.currency ?? null,
        notes: s.notes ?? null,
        imageUrl: s.imageUrl ?? null,
        createdAt: toIso(s.createdAt) ?? null,
        updatedAt: toIso(s.updatedAt) ?? null,
      };
    });

    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Staff" />
        <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
          <Suspense fallback={<div>Loading...</div>}>
            <StaffClientPage initialStaff={staffList} initialBranches={branches} />
          </Suspense>
        </main>
      </div>
    );
  };

  return <Page />;
}
