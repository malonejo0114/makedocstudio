import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "adg_admin_session";

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

function getAdminSecret(): string {
  return process.env.ADMIN_AUTH_SECRET?.trim() || "adg-admin-secret-v1";
}

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isAdminAuthConfigured(): boolean {
  return Boolean(getAdminPassword());
}

function getAdminCookieName(): string {
  return ADMIN_COOKIE_NAME;
}

async function verifyAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !isAdminAuthConfigured()) return false;
  const expected = await sha256Hex(`${getAdminPassword()}:${getAdminSecret()}:session-v1`);
  return token === expected;
}

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
    url.pathname = "/studio";
    return NextResponse.redirect(url);
  }

  if (isLegacyAliasPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/history" ? "/projects" : "/studio";
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
