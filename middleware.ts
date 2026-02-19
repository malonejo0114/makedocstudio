import { NextRequest, NextResponse } from "next/server";

import {
  getAdminCookieName,
  isAdminAuthConfigured,
  verifyAdminSessionToken,
} from "@/lib/adminSession";

function isBlockedLegacyPath(pathname: string): boolean {
  return (
    pathname === "/diagnosis" ||
    pathname.startsWith("/diagnosis/") ||
    pathname === "/report" ||
    pathname.startsWith("/report/") ||
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/")
  );
}

function isLegacyAliasPath(pathname: string): boolean {
  return pathname === "/creative" || pathname === "/history";
}

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isAuthPath(pathname: string): boolean {
  return pathname === "/admin/login" || pathname === "/api/admin/login";
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isBlockedLegacyPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/studio-entry";
    return NextResponse.redirect(url);
  }

  if (isLegacyAliasPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/history" ? "/projects" : "/studio-entry";
    return NextResponse.redirect(url);
  }

  if (!isProtectedPath(pathname) || isAuthPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAdminAuthConfigured()) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        { error: "ADMIN_PASSWORD is not configured." },
        { status: 500 },
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname + search);
    url.searchParams.set("error", "config");
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(getAdminCookieName())?.value;
  const valid = await verifyAdminSessionToken(token);
  if (valid) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/diagnosis/:path*",
    "/report/:path*",
    "/checkout/:path*",
    "/creative",
    "/history",
  ],
};
