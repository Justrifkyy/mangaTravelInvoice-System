/**
 * Layanan bersama untuk validasi, ekstraksi referensi, dan deteksi duplikat transaksi.
 * Sumber: docs/app-spec.json > F-09.design_hint & instructions_for_ai_coder
 * "Gunakan satu service bersama untuk validasi, ekstraksi, dan perhitungan saldo
 *  di input manual, impor, dan API."
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import { getTransactionCaseMeta, isKnownTransactionCase } from "./cases";
import { extractTransactionRefs, type ExtractedTransactionRefs } from "./extraction";

export interface RawTransactionIngestInput {
  agentId: string;
  transactionAt: Date;
  case: string;
  description: string;
  debit: bigint;
  credit: bigint;
  source: "manual" | "import" | "api";
}

export interface ValidatedTransactionPayload extends RawTransactionIngestInput {
  case: string;
  refs: ExtractedTransactionRefs;
  dedupHash: string;
  warnings: string[];
}

export type IngestValidationResult =
  | { ok: true; data: ValidatedTransactionPayload }
  | { ok: false; errors: string[] };

const baseSchema = z.object({
  agentId: z.string().trim().min(1, "Kode agen wajib dipilih."),
  transactionAt: z.date({ message: "Tanggal transaksi tidak valid." }),
  case: z.string().trim().min(1, "Jenis transaksi (case) wajib diisi."),
  description: z.string().trim().min(1, "Keterangan transaksi wajib diisi."),
  source: z.enum(["manual", "import", "api"]),
});

/**
 * Menghasilkan hash unik deteksi duplikat impor/API:
 * hash dari (agent_id, transaction_at ISO UTC, case, debit, credit, description)
 */
export function computeTransactionDedupHash(input: {
  agentId: string;
  transactionAt: Date;
  case: string;
  debit: bigint;
  credit: bigint;
  description: string;
}): string {
  const canonical = [
    input.agentId.trim(),
    input.transactionAt.toISOString(),
    input.case.trim().toLowerCase(),
    input.debit.toString(),
    input.credit.toString(),
    input.description.trim(),
  ].join("|");

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Memvalidasi aturan bisnis transaksi sesuai docs/app-spec.json > data_model.tables.transactions.constraints & F-08.validation
 */
export function validateAndPrepareTransaction(
  input: RawTransactionIngestInput
): IngestValidationResult {
  const errors: string[] = [];

  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(issue.message);
    }
  }

  if (Number.isNaN(input.transactionAt.getTime())) {
    errors.push("Format tanggal transaksi tidak dikenali.");
  }

  const normalizedCase = input.case.trim().toLowerCase();
  if (!isKnownTransactionCase(normalizedCase)) {
    errors.push(`Jenis transaksi '${input.case}' tidak terdaftar di sistem.`);
  }

  if (input.debit < 0n || input.credit < 0n) {
    errors.push("Nominal debet atau kredit tidak boleh bernilai negatif.");
  }

  const hasDebit = input.debit > 0n;
  const hasCredit = input.credit > 0n;

  if (hasDebit && hasCredit) {
    errors.push("Debet dan kredit tidak boleh terisi (> 0) secara bersamaan.");
  } else if (!hasDebit && !hasCredit) {
    errors.push("Salah satu dari debet atau kredit wajib bernilai lebih dari 0.");
  }

  if (isKnownTransactionCase(normalizedCase) && (hasDebit || hasCredit)) {
    const meta = getTransactionCaseMeta(normalizedCase);
    if (meta.side === "debit" && !hasDebit) {
      errors.push(
        `Transaksi '${meta.label}' wajib tercatat pada sisi Debet (kredit harus 0).`
      );
    }
    if (meta.side === "credit" && !hasCredit) {
      errors.push(
        `Transaksi '${meta.label}' wajib tercatat pada sisi Kredit (debet harus 0).`
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const trimmedDescription = input.description.trim();
  const refs = extractTransactionRefs(trimmedDescription);
  const warnings: string[] = [];

  if (
    (normalizedCase === "withdrawal" || normalizedCase === "bonus") &&
    !refs.orderNumber
  ) {
    warnings.push(
      "Nomor pesanan (No. Pesanan) tidak ditemukan pada keterangan transaksi."
    );
  }

  const dedupHash = computeTransactionDedupHash({
    agentId: input.agentId,
    transactionAt: input.transactionAt,
    case: normalizedCase,
    debit: input.debit,
    credit: input.credit,
    description: trimmedDescription,
  });

  return {
    ok: true,
    data: {
      ...input,
      case: normalizedCase,
      description: trimmedDescription,
      refs,
      dedupHash,
      warnings,
    },
  };
}

