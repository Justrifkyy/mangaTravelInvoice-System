import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, zodErrorToApiResponse } from "@/lib/api/api-error";
import {
  requireApiSession,
  verifySameOriginWrite,
} from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";
import {
  getReceiptForSession,
  getTransactionDetailForSession,
} from "@/lib/services/transaction-service";

const receiptQuerySchema = z.object({
  transactionId: z.string().trim().min(1, "ID transaksi wajib diisi."),
  mode: z.enum(["individual", "group"]).default("individual"),
});

export async function GET(request: NextRequest) {
  try {
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
  } catch (err) {
    return handleApiError(err, { context: "GET /api/receipts" });
  }
}

const recordPrintSchema = z.object({
  transactionId: z.string().trim().min(1, "ID transaksi wajib diisi."),
  mode: z.enum(["individual", "group"]).default("individual"),
  size: z.enum(["58", "80", "a4"]).optional(),
});

/**
 * Mencatat aktivitas pencetakan/ekspor struk (print_receipt) ke audit log
 * dengan memverifikasi hak akses ruang lingkup agen pengguna terlebih dahulu.
 */
export async function POST(request: NextRequest) {
  try {
    const csrfError = verifySameOriginWrite(request);
    if (csrfError) return csrfError;

    const auth = await requireApiSession();
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { code: "INVALID_JSON", message: "Format permintaan tidak valid." },
        { status: 400 }
      );
    }

    const parsed = recordPrintSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorToApiResponse(parsed.error, "Parameter cetak tidak valid.");
    }

    const detail = await getTransactionDetailForSession(
      auth.session,
      parsed.data.transactionId
    );
    if (!detail) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Transaksi tidak ditemukan." },
        { status: 404 }
      );
    }

    const repo = getDataRepository();
    await repo.writeAuditLog({
      userId: auth.session.id,
      action: "print_receipt",
      entity: "transactions",
      entityId: parsed.data.transactionId,
      metadata: {
        mode: parsed.data.mode,
        ...(parsed.data.size ? { size: parsed.data.size } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { context: "POST /api/receipts" });
  }
}
