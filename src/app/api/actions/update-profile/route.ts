import { updateUserProfileAction } from '@/app/actions';

export async function POST(req: Request) {
  const body = await req.json();
  const { userId, profile } = body;
  const result = await updateUserProfileAction(userId, profile);
  return new Response(JSON.stringify(result), { status: 200 });
}
