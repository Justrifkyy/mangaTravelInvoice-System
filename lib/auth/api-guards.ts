/**
 * Helper otentikasi, otorisasi, dan proteksi CSRF (same-origin) untuk API Route Handlers.
 * Sumber: docs/app-spec.json > api_endpoints_internal.rules & non_functional.security
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/db/types";
import { getOptionalSessionUser } from "./guards";

export function verifySameOriginWrite(
  request: NextRequest
): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    // Permintaan non-browser atau same-origin tanpa header Origin
    return null;
  }

  try {
    const originUrl = new URL(originHeader);
    const hostHeader =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.host;

    if (originUrl.host !== hostHeader) {
      return NextResponse.json(
        {
          code: "CSRF_FORBIDDEN",
          message: "Permintaan lintas asal (cross-origin) ditolak.",
        },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      {
        code: "CSRF_FORBIDDEN",
        message: "Header Origin tidak valid.",
      },
      { status: 403 }
    );
  }

  return null;
}

export async function requireApiSession(): Promise<
  | { ok: true; session: SessionUser }
  | { ok: false; response: NextResponse }
> {
  const { user, expired } = await getOptionalSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: expired ? "SESSION_EXPIRED" : "UNAUTHORIZED",
          message: expired
            ? "Sesi Anda berakhir. Silakan masuk kembali."
            : "Silakan masuk terlebih dahulu.",
        },
        { status: 401 }
      ),
    };
  }
  return { ok: true, session: user };
}

export async function requireApiAdmin(
  request?: NextRequest
): Promise<
  | { ok: true; session: SessionUser }
  | { ok: false; response: NextResponse }
> {
  if (request) {
    const csrfError = verifySameOriginWrite(request);
    if (csrfError) {
      return { ok: false, response: csrfError };
    }
  }

  const auth = await requireApiSession();
  if (!auth.ok) return auth;

  if (auth.session.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "Anda tidak memiliki akses ke halaman ini.",
        },
        { status: 403 }
      ),
    };
  }

  return auth;
}

