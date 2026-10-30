import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TIMEOUT_MS,
  verifySessionToken,
} from "@/lib/auth/session-token";

const ADMIN_ONLY_PREFIXES = [
  "/admin",
  "/settings",
  "/transactions/new",
  "/import",
];

function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/403") {
    return NextResponse.next();
  }

  const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verified = rawCookie ? await verifySessionToken(rawCookie) : null;

  if (pathname === "/login") {
    if (verified?.status === "valid") {
      return NextResponse.redirect(new URL("/transactions", request.url));
    }
    return NextResponse.next();
  }

  if (!verified || verified.status !== "valid") {
    const loginUrl = new URL("/login", request.url);
    if (verified?.status === "expired") {
      loginUrl.searchParams.set("expired", "1");
    }
    const returnTo = `${pathname}${search}`;
    if (returnTo && returnTo !== "/") {
      loginUrl.searchParams.set("next", returnTo);
    }
    const res = NextResponse.redirect(loginUrl);
    if (rawCookie) {
      res.cookies.delete(SESSION_COOKIE_NAME);
    }
    return res;
  }

  // Tolak akses role agent ke rute khusus admin dengan HTTP 403 (F-01 > acceptance_criteria)
  if (verified.payload.role !== "admin" && isAdminOnlyPath(pathname)) {
    return NextResponse.rewrite(new URL("/403", request.url));
  }

  const response = NextResponse.next();

  // Perpanjang masa aktif sesi (sliding 8 jam tidak aktif) bila sudah berjalan > 15 menit
  const elapsed = Date.now() - verified.payload.iat;
  if (elapsed > 15 * 60 * 1000) {
    const refreshedToken = await createSessionToken({
      userId: verified.payload.userId,
      role: verified.payload.role,
      ttlMs: SESSION_IDLE_TIMEOUT_MS,
    });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      refreshedToken,
      getSessionCookieOptions()
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|brand|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|ico)$).*)",
  ],
};

