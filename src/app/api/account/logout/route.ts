import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("session");
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e?.message || "Logout failed" }),
      { status: 500 }
    );
  }
}
