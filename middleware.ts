import { NextRequest, NextResponse } from 'next/server';

// Route → AppPageKey mapping
const PAGE_PERMISSION_MAP: Record<string, string> = {
  '/dashboard/shipments':     'shipments',
  '/dashboard/dispatches':    'dispatches',
  '/dashboard/dispatch':      'dispatches',
  '/dashboard/production':    'production',
  '/dashboard/maintenance':   'maintenance',
  '/dashboard/oil-status':    'oil_status',
  '/dashboard/driver-license':'licenses',
  '/dashboard/tasks':         'tasks',
  '/dashboard/productivity':  'productivity',
  '/dashboard/staff':         'staff',
  '/dashboard/reports':       'reports',
  '/dashboard/feedback':      'feedback',
  '/dashboard/settings':      'settings',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const reqMethod = request.method;

  // 1. Only process GET navigations — skip POSTs (Server Actions, form submits, etc.)
  if (reqMethod !== 'GET') return NextResponse.next();

  // 2. Skip _next internals and static assets
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) return NextResponse.next();

  // 3. Only enforce /dashboard routes
  if (!pathname.startsWith('/dashboard')) return NextResponse.next();

  // 4. Dashboard home is always accessible (need to be logged in though)
  const isHome = pathname === '/dashboard' || pathname === '/dashboard/';

  // 5. Read & parse session cookie
  const sessionCookie = request.cookies.get('session');
  if (!sessionCookie?.value) {
    const url = new URL('/', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  let session: any = null;
  try {
    session = JSON.parse(sessionCookie.value);
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!session?.id) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (isHome) return NextResponse.next();

  // 6. Find required page key for this route
  const matchedRoute = Object.keys(PAGE_PERMISSION_MAP).find(route =>
    pathname === route || pathname.startsWith(route + '/')
  );

  // Route not in permission map → allow (e.g. /dashboard/admin sub-pages)
  if (!matchedRoute) return NextResponse.next();

  const requiredPage = PAGE_PERMISSION_MAP[matchedRoute];

  // 7. Read permissions from cookie (baked in at login / session refresh)
  //    Format: { shipments: ['view','add','edit','delete'], ... }
  const permissions = session.permissions as Record<string, string[]> | null | undefined;

  // No permissions object at all → deny (forces admin to explicitly grant)
  if (!permissions) {
    const url = new URL('/dashboard', request.url);
    url.searchParams.set('unauthorized', requiredPage);
    return NextResponse.redirect(url);
  }

  const allowed = Array.isArray(permissions[requiredPage]) &&
    permissions[requiredPage].includes('view');

  if (!allowed) {
    const url = new URL('/dashboard', request.url);
    url.searchParams.set('unauthorized', requiredPage);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
