import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const protectedRoutes = [
  '/admin',
  '/dashboard',
  '/forum',
  '/help',
  '/mentoring',
  '/profile',
  '/requests',
  '/schedule',
  '/tasks',
  '/tracking',
];

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('error', 'missing_supabase_env');
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getClaims() verifies the access token locally against the project's ES256
  // signing key (JWKS, cached per instance), refreshing an expired session
  // through the cookies above. getUser() made a round trip to Supabase Auth
  // (Sydney) on every protected request — page loads, client navigations and
  // link prefetches alike — which cost ~1s per navigation from Israel.
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/forum/:path*', '/help/:path*', '/mentoring/:path*', '/profile/:path*', '/requests/:path*', '/schedule/:path*', '/tasks/:path*', '/tracking/:path*'],
};
