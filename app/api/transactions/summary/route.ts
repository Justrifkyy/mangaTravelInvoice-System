import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireApiSession } from "@/lib/auth/api-guards";
import { queryTransactionsForSession } from "@/lib/services/transaction-service";
import { parseTransactionSearchParams } from "@/lib/validation/transaction-query";

function searchParamsToRecord(
  sp: URLSearchParams
): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(sp.keys())) {
    const all = sp.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiSession();
    if (!auth.ok) return auth.response;

    const parsed = parseTransactionSearchParams(
      searchParamsToRecord(request.nextUrl.searchParams)
    );

    if (parsed.validationError) {
      return NextResponse.json(
        {
          code: "INVALID_QUERY",
          message: parsed.validationError,
        },
        { status: 400 }
      );
    }

    const result = await queryTransactionsForSession(auth.session, parsed);
    return NextResponse.json({ summary: result.summary });
  } catch (err) {
    return handleApiError(err, { context: "GET /api/transactions/summary" });
  }
}
