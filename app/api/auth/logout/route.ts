import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifySameOriginWrite } from "@/lib/auth/api-guards";
import { getOptionalSessionUser } from "@/lib/auth/guards";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-token";
import { getDataRepository } from "@/lib/db/repository";

export async function POST(request: NextRequest) {
  const csrfError = verifySameOriginWrite(request);
  if (csrfError) return csrfError;

  try {
    const { user } = await getOptionalSessionUser();
    if (user) {
      const repo = getDataRepository();
      await repo.writeAuditLog({
        userId: user.id,
        action: "logout",
        entity: "users",
        entityId: user.id,
      });
    }
  } catch (err) {
    // Jangan pernah menghalangi proses penghapusan cookie sesi jika database sedang turun
    console.error("[POST /api/auth/logout] Audit log skipped due to error:", err);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
