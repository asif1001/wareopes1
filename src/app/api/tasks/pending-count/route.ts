export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';

// Returns the count of pending tasks for the current user (reporter or assignee)
// Pending = status not equal to 'Done' and not equal to 'On Hold'
// Server-side calculation using Firebase Admin SDK.
export async function GET(_req: NextRequest) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'tasks', 'view'));
    if (!canView || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();

    const [reporterSnap, assigneeSnap] = await Promise.all([
      adb.collection('tasks').where('reporterId', '==', String(userId)).get(),
      adb.collection('tasks').where('assigneeId', '==', String(userId)).get(),
    ]);

    const seen = new Set<string>();
    let count = 0;
    const isPending = (status: string | undefined) => status !== 'Done' && status !== 'On Hold';

    for (const d of reporterSnap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const raw = d.data ? d.data() : {};
      if (isPending((raw as any)?.status)) count++;
    }
    for (const d of assigneeSnap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const raw = d.data ? d.data() : {};
      if (isPending((raw as any)?.status)) count++;
    }

    return NextResponse.json({ count });
  } catch (error: any) {
    console.error('Error computing pending task count:', error);
    return NextResponse.json({ error: 'Failed to compute pending task count' }, { status: 500 });
  }
}