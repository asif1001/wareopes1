export async function POST(req: Request) {
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
