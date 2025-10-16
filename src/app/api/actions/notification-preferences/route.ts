import { updateNotificationPreferencesAction } from '@/app/actions';

export async function POST(req: Request) {
  const formData = await req.formData();
  const result = await updateNotificationPreferencesAction(formData as unknown as FormData);
  return new Response(JSON.stringify(result), { status: 200 });
}
