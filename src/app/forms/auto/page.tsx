import { redirect } from 'next/navigation';
import { findAutoRedirectFormForRoleAction } from '@/app/actions';
import { getAccess } from '@/lib/permissions/server';

export default async function AutoFormRedirectPage() {
  let role: string | null = null;
  try {
    role = (await getAccess())?.role || null;
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
