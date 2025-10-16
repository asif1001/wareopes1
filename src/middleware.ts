import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// Middleware to protect dashboard routes
export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  if (!session) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
