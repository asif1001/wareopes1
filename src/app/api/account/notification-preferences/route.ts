import { apiAccess } from '@/lib/permissions/server';
export async function POST(req: Request) {
  const gate = await apiAccess();
  if (!gate.ok) return gate.response;
  await req.formData();
  return new Response(
    JSON.stringify({ success: true, message: "Preferences updated (demo)" }),
    { status: 200 }
  );
}
