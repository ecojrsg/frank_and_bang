// @Author: Jonathan Serna
// @Date:   2026-11-23 21:00:30
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 21:00:30

/**
 * Next.js middleware refreshing Supabase Auth cookies and guarding app routes.
 */

import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/menu", "/gacha", "/lab", "/arena"];

/**
 * Refresh the Supabase session and enforce authentication redirects.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/")) {
    const menuUrl = request.nextUrl.clone();
    menuUrl.pathname = "/menu";
    return NextResponse.redirect(menuUrl);
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/menu/:path*", "/gacha/:path*", "/lab/:path*", "/arena/:path*"],
};
