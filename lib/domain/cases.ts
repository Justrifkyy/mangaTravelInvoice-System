/**
 * Sumber tunggal daftar jenis transaksi (case).
 * Sesuai docs/app-spec.json > data_model.tables.transactions.case_enum_open:
 * "Simpan daftar case di satu konstanta/tabel referensi agar mudah ditambah,
 *  dan UI filter harus mengambil daftar case dari sana."
 */

export type AmountSide = "debit" | "credit";

export interface TransactionCaseMeta {
  value: string;
  label: string;
  side: AmountSide;
  badgeStyle: "deposit" | "withdrawal" | "bonus" | "unknown";
}

export const TRANSACTION_CASES: readonly TransactionCaseMeta[] = [
  {
    value: "deposit",
    label: "Deposit",
    side: "credit",
    badgeStyle: "deposit",
  },
  {
    value: "withdrawal",
    label: "Withdrawal",
    side: "debit",
    badgeStyle: "withdrawal",
  },
  {
    value: "bonus",
    label: "Bonus",
    side: "credit",
    badgeStyle: "bonus",
  },
] as const;

export type KnownTransactionCase = "deposit" | "withdrawal" | "bonus";

const CASE_MAP = new Map<string, TransactionCaseMeta>(
  TRANSACTION_CASES.map((item) => [item.value, item])
);

export function isKnownTransactionCase(value: string): boolean {
  return CASE_MAP.has(value.trim().toLowerCase());
}

export function getKnownTransactionCase(
  rawCase: string
): TransactionCaseMeta | null {
  return CASE_MAP.get(rawCase.trim().toLowerCase()) ?? null;
}

/**
 * Mengambil metadata case. Jika ada nilai case baru dari sistem eksternal yang
 * belum terdaftar, tampilkan apa adanya dengan huruf kapital di awal (design-spec.json > case_badges.unknown_case).
 */
export function getTransactionCaseMeta(rawCase: string): TransactionCaseMeta {
  const normalized = rawCase.trim().toLowerCase();
  const known = CASE_MAP.get(normalized);
  if (known) {
    return known;
  }

  const label =
    normalized.length > 0
      ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
      : "Lainnya";

  return {
    value: normalized,
    label,
    side: "credit",
    badgeStyle: "unknown",
  };
}

