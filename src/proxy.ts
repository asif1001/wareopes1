import { NextRequest, NextResponse } from 'next/server';

// Proxy to protect dashboard routes
export function proxy(request: NextRequest) {
  const session = request.cookies.get('session');
  if (!session) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
