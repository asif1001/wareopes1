import { apiAccess } from '@/lib/permissions/server';
export async function POST(req: Request) {
  const gate = await apiAccess();
  if (!gate.ok) return gate.response;
  const formData = await req.formData();
  const current = formData.get("currentPassword");
  const next = formData.get("newPassword");
  if (!current || !next) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing password fields" }),
      { status: 400 }
    );
  }
  return new Response(
    JSON.stringify({ success: true, message: "Password changed successfully (demo)" }),
    { status: 200 }
  );
}
