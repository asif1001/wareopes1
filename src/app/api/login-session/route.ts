import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set('session', userId, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
  });
  return response;
}
