import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { findAutoRedirectFormForRoleAction } from '@/app/actions';

export default async function AutoFormRedirectPage() {
  // Get current user role from Users collection via Admin
  let role: string | null = null;
  try {
    const c = await cookies();
    const id = c.get('session')?.value;
    if (id) {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const adb = await getAdminDb();
      const snap = await adb.collection('Users').doc(id).get();
      if (snap.exists) {
        role = (snap.data() as any)?.role || null;
      }
    }
  } catch {}

  // If no role or not logged in, fallback to dashboard
  if (!role) {
    redirect('/dashboard');
  }

  const res = await findAutoRedirectFormForRoleAction(role);
  if (res.success && res.slug) {
    redirect(`/forms/${res.slug}`);
  }
  // Fallback: go to dashboard if no matching template
  redirect('/dashboard');
}