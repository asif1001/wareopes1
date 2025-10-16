import { submitSupportTicketAction } from '@/app/actions';

export async function POST(req: Request) {
  const formData = await req.formData();
  const result = await submitSupportTicketAction(formData as unknown as FormData);
  return new Response(JSON.stringify(result), { status: 200 });
}
