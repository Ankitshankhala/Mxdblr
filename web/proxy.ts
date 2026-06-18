import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dealer-only routes — just check cookie presence (real auth on API)
  if (
    pathname.startsWith('/account') ||
    pathname.startsWith('/cart') ||
    pathname === '/wishlist'
  ) {
    const token = request.cookies.get('mxd_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
    return NextResponse.next();
  }

  // Admin: redirect already-logged-in admin away from /admin/login
  if (pathname === '/admin/login') {
    const existing = request.cookies.get('adminToken')?.value;
    if (existing) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(existing, secret);
        if (payload.type === 'admin') {
          return NextResponse.redirect(new URL('/admin', request.url));
        }
      } catch {
        const res = NextResponse.next();
        res.cookies.delete('adminToken');
        return res;
      }
    }
    return NextResponse.next();
  }

  // All other /admin/* routes require valid admin token
  const token = request.cookies.get('adminToken')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== 'admin') throw new Error('Not an admin token');
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL('/admin/login', request.url));
    response.cookies.delete('adminToken');
    return response;
  }
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/cart', '/wishlist'],
};
