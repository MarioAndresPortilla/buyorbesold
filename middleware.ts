import { NextResponse, type NextRequest } from "next/server";

/**
 * Injects `x-pathname` into request headers so server components
 * (SiteNav, SubNav, Breadcrumbs) can detect the active route without
 * needing usePathname() — which only works in client components.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static files
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|rss.xml|.*\\.png|.*\\.jpg|.*\\.svg).*)",
  ],
};
