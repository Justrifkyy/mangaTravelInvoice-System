import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireApiAdmin } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;

    const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "200");
    const safeLimit = Number.isFinite(rawLimit)
      ? Math.min(500, Math.max(10, Math.floor(rawLimit)))
      : 200;

    const repo = getDataRepository();
    const logs = await repo.listAuditLogs(safeLimit);
    return NextResponse.json({ logs });
  } catch (err) {
    return handleApiError(err, { context: "GET /api/admin/audit-logs" });
  }
}
