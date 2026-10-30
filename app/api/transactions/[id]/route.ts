import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireApiSession } from "@/lib/auth/api-guards";
import { getTransactionDetailForSession } from "@/lib/services/transaction-service";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/transactions/[id]">
) {
  try {
    const auth = await requireApiSession();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const detail = await getTransactionDetailForSession(auth.session, id);

    if (!detail) {
      return NextResponse.json(
        {
          code: "NOT_FOUND",
          message: "Transaksi tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(detail);
  } catch (err) {
    return handleApiError(err, { context: "GET /api/transactions/[id]" });
  }
}
