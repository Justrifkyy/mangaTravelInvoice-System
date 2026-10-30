import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, zodErrorToApiResponse } from "@/lib/api/api-error";
import { requireApiAdmin, requireApiSession } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";
import { getKnownTransactionCase } from "@/lib/domain/cases";
import { parseJakartaDateTime } from "@/lib/domain/format";
import { validateAndPrepareTransaction } from "@/lib/domain/ingest";
import { parseRupiahToBigInt } from "@/lib/domain/money";
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
    return NextResponse.json({
      items: result.items,
      pagination: result.pagination,
      emptyReason: result.emptyReason,
    });
  } catch (err) {
    return handleApiError(err, { context: "GET /api/transactions" });
  }
}

const createManualTxSchema = z.object({
  agentId: z.string().trim().min(1, "Pilih agen terlebih dahulu."),
  transactionAt: z.string().trim().min(1, "Waktu transaksi wajib diisi."),
  case: z.string().trim().min(1, "Jenis transaksi (Case) wajib dipilih."),
  description: z.string().trim().min(1, "Keterangan transaksi wajib diisi."),
  amount: z.union([z.string(), z.number()]),
});

export function parseManualTransactionDate(raw: string): Date | null {
  const normalized = raw.trim().replace("T", " ");
  const jakartaParsed = parseJakartaDateTime(normalized);
  if (jakartaParsed) return jakartaParsed;

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
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

    const parsed = createManualTxSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorToApiResponse(parsed.error, "Input transaksi tidak valid.");
    }

    const txDate = parseManualTransactionDate(parsed.data.transactionAt);
    if (!txDate) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Format tanggal & jam transaksi tidak valid.",
          fields: {
            transactionAt: "Format tanggal & jam transaksi tidak valid.",
          },
        },
        { status: 400 }
      );
    }

    const caseMeta = getKnownTransactionCase(parsed.data.case);
    if (!caseMeta) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Jenis transaksi (Case) tidak dikenali.",
          fields: { case: "Jenis transaksi (Case) tidak dikenali." },
        },
        { status: 400 }
      );
    }

    const amountBig = parseRupiahToBigInt(parsed.data.amount, {
      allowNegative: false,
      emptyAsZero: false,
    });
    if (amountBig === null || amountBig <= 0n) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Nominal harus berupa angka bulat positif (> Rp 0).",
          fields: {
            amount: "Nominal harus berupa angka bulat positif (> Rp 0).",
          },
        },
        { status: 400 }
      );
    }

    const debit = caseMeta.side === "debit" ? amountBig : 0n;
    const credit = caseMeta.side === "credit" ? amountBig : 0n;

    const prepared = validateAndPrepareTransaction({
      agentId: parsed.data.agentId,
      transactionAt: txDate,
      case: caseMeta.value,
      description: parsed.data.description,
      debit,
      credit,
      source: "manual",
    });

    if (!prepared.ok) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: prepared.errors[0] ?? "Transaksi tidak valid.",
        },
        { status: 400 }
      );
    }

    const repo = getDataRepository();
    const created = await repo.createManualTransaction({
      agentId: prepared.data.agentId,
      transactionAt: prepared.data.transactionAt,
      case: prepared.data.case,
      description: prepared.data.description,
      debit: prepared.data.debit,
      credit: prepared.data.credit,
      orderNumber: prepared.data.refs.orderNumber,
      bookingCode: prepared.data.refs.bookingCode,
      groupKey: prepared.data.refs.groupKey,
      dedupHash: prepared.data.dedupHash,
      actorUserId: auth.session.id,
    });

    revalidatePath("/transactions");

    return NextResponse.json(
      {
        transaction: created,
        warnings: prepared.data.warnings,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, {
      context: "POST /api/transactions",
      defaultCode: "CREATE_FAILED",
    });
  }
}
