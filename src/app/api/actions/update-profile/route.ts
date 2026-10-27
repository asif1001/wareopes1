import { updateOwnProfile } from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { status, ...result } = await updateOwnProfile(String(body?.userId ?? ""), body?.profile);
  return new Response(JSON.stringify(result), { status });
}
