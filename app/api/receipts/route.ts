import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/api-guards";
import { getReceiptForSession } from "@/lib/services/transaction-service";

const receiptQuerySchema = z.object({
  transactionId: z.string().trim().min(1, "ID transaksi wajib diisi."),
  mode: z.enum(["individual", "group"]).default("individual"),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const parsed = receiptQuerySchema.safeParse({
    transactionId: request.nextUrl.searchParams.get("transactionId") ?? "",
    mode: request.nextUrl.searchParams.get("mode") ?? "individual",
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "INVALID_QUERY",
        message:
          parsed.error.issues[0]?.message ?? "Parameter struk tidak valid.",
      },
      { status: 400 }
    );
  }

  const result = await getReceiptForSession({
    session: auth.session,
    transactionId: parsed.data.transactionId,
    mode: parsed.data.mode,
    printedAt: new Date(),
    recordAudit: true,
  });

  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      {
        code: result.code,
        message: result.message,
      },
      { status }
    );
  }

  return NextResponse.json({ receipt: result.receipt });
}
