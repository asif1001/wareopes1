export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, profile } = body ?? {};
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: "Missing user id" }), { status: 400 });
    }
    const { getAdminDb } = await import("@/lib/firebase/admin");
    const adb = await getAdminDb();
    await adb.collection("Users").doc(userId).update(profile ?? {});
    return new Response(JSON.stringify({ success: true, message: "Profile updated successfully." }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || "Failed to update profile." }), { status: 500 });
  }
}
