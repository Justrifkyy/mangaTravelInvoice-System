import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseManualTransactionDate } from "@/app/api/transactions/route";
import { requireApiAdmin } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";
import { getKnownTransactionCase } from "@/lib/domain/cases";
import { parseRupiahToBigInt } from "@/lib/domain/money";

const previewSchema = z.object({
  agentId: z.string().trim().min(1),
  transactionAt: z.string().trim().min(1),
  case: z.string().trim().min(1),
  amount: z.union([z.string(), z.number()]).optional(),
});

export async function POST(request: NextRequest) {
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

  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Parameter pratinjau tidak lengkap." },
      { status: 400 }
    );
  }

  const txDate = parseManualTransactionDate(parsed.data.transactionAt);
  if (!txDate) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Tanggal transaksi tidak valid." },
      { status: 400 }
    );
  }

  const caseMeta = getKnownTransactionCase(parsed.data.case);
  const amountBig =
    parsed.data.amount !== undefined && String(parsed.data.amount).trim() !== ""
      ? (parseRupiahToBigInt(parsed.data.amount, {
          allowNegative: false,
          emptyAsZero: true,
        }) ?? 0n)
      : 0n;

  const debit = caseMeta?.side === "debit" ? amountBig : 0n;
  const credit = caseMeta?.side === "credit" ? amountBig : 0n;

  const repo = getDataRepository();
  const preview = await repo.previewManualTransaction({
    agentId: parsed.data.agentId,
    transactionAt: txDate,
    debit,
    credit,
  });

  if (!preview) {
    return NextResponse.json(
      { code: "AGENT_NOT_FOUND", message: "Agen tidak ditemukan." },
      { status: 404 }
    );
  }

  return NextResponse.json({ preview });
}

