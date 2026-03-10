export async function POST(req: Request) {
  await req.formData();
  return new Response(JSON.stringify({ success: true, message: "Preferences updated (demo)" }), { status: 200 });
}
