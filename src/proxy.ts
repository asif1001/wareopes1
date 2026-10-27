import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

// Protect dashboard routes: only a validly signed session gets through.
// Per-page permissions are checked on the server by each page (guardPage).
export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const response = NextResponse.redirect(new URL('/', request.url));
    if (request.cookies.get(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/my-account/:path*', '/forms/:path*', '/support/:path*'],
};
