import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, zodErrorToApiResponse } from "@/lib/api/api-error";
import { verifySameOriginWrite } from "@/lib/auth/api-guards";
import {
  checkLoginRateLimit,
  clearFailedLoginAttempts,
  recordFailedLoginAttempt,
} from "@/lib/auth/rate-limit";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session-token";
import { getDataRepository } from "@/lib/db/repository";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi."),
  password: z.string().min(1, "Password wajib diisi."),
});

export async function POST(request: NextRequest) {
  try {
    const csrfError = verifySameOriginWrite(request);
    if (csrfError) return csrfError;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { code: "INVALID_JSON", message: "Format permintaan tidak valid." },
        { status: 400 }
      );
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorToApiResponse(parsed.error, "Data login tidak lengkap.");
    }

    const { username, password } = parsed.data;
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rateLimitKey = `${clientIp}:${username.toLowerCase()}`;

    const rateStatus = checkLoginRateLimit(rateLimitKey);
    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          message: `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(rateStatus.retryAfterSeconds / 60)} menit.`,
        },
        { status: 429 }
      );
    }

    const repo = getDataRepository();
    const user = await repo.findUserByUsername(username);
    const passwordValid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !passwordValid) {
      recordFailedLoginAttempt(rateLimitKey);
      await repo
        .writeAuditLog({
          userId: null,
          action: "login_failed",
          entity: "users",
          metadata: { username },
        })
        .catch(() => undefined);

      return NextResponse.json(
        {
          code: "INVALID_CREDENTIALS",
          message: "Username atau password salah.",
        },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          code: "ACCOUNT_INACTIVE",
          message: "Akun Anda dinonaktifkan. Hubungi admin.",
        },
        { status: 403 }
      );
    }

    clearFailedLoginAttempts(rateLimitKey);
    await repo.recordUserLogin(user.id);

    const token = await createSessionToken({
      userId: user.id,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        agentId: user.agentId,
        agentCode: user.agentCode,
      },
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      token,
      getSessionCookieOptions()
    );

    return response;
  } catch (err) {
    return handleApiError(err, { context: "POST /api/auth/login" });
  }
}
