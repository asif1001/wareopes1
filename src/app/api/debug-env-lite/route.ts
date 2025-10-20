import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const env = process.env as Record<string, string | undefined>;

    const publicVars = {
      NEXT_PUBLIC_FIREBASE_API_KEY: !!env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: !!env.NEXT_PUBLIC_FIREBASE_APP_ID,
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: !!env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

    return NextResponse.json({
      ok: true,
      env: {
        FIREBASE_ADMIN_CREDENTIALS: !!env.FIREBASE_ADMIN_CREDENTIALS,
        FIREBASE_ADMIN_CREDENTIALS_len: env.FIREBASE_ADMIN_CREDENTIALS?.length || 0,
        GOOGLE_APPLICATION_CREDENTIALS: !!env.GOOGLE_APPLICATION_CREDENTIALS,
        ...publicVars,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}