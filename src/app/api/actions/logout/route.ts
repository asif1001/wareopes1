import { logoutAction } from '@/app/actions';

export async function POST(req: Request) {
  // logoutAction redirects; to keep API behavior simple we call it and return JSON
  try {
    await logoutAction();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || 'Logout failed' }), { status: 500 });
  }
}
