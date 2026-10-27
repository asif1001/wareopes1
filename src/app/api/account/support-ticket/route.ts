import { apiAccess } from '@/lib/permissions/server';
export async function POST(req: Request) {
  const gate = await apiAccess();
  if (!gate.ok) return gate.response;
  const formData = await req.formData();
  const subject = formData.get("subject");
  const message = formData.get("message");
  if (!subject || !message) {
    return new Response(
      JSON.stringify({ success: false, error: "Subject and message are required" }),
      { status: 400 }
    );
  }
  return new Response(
    JSON.stringify({ success: true, message: "Ticket submitted (demo)" }),
    { status: 200 }
  );
}
