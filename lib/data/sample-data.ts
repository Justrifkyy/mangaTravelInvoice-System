/**
 * Data contoh Fase 1 (25 baris) berdasarkan file asli LAPORAN-CASHFLOW-20260722-20260728.xls
 * dan cuplikan terverifikasi di docs/app-spec.json > sample_data & balance_rules.
 *
 * Seluruh saldo dihitung secara deterministik oleh calculateAgentRunningBalances()
 * menggunakan integer Rupiah (bigint), sehingga 100% konsisten dengan rumus sistem.
 */

import { calculateAgentRunningBalances } from "@/lib/domain/balance";
import { extractTransactionRefs } from "@/lib/domain/extraction";
import { parseJakartaDateTime } from "@/lib/domain/format";
import type {
  ReceiptBusinessSettings,
  ReceiptTransactionRecord,
} from "@/lib/domain/receipt";

export interface SampleAgent {
  id: string;
  code: string;
  name: string;
  openingBalance: bigint;
  isActive: boolean;
}

export interface SampleUserSession {
  id: string;
  username: string;
  name: string;
  role: "admin" | "agent";
  agentId: string | null;
  agentCode: string | null;
}

export const SAMPLE_AGENTS: readonly SampleAgent[] = [
  {
    id: "agent-jkt-37287",
    code: "JKT-37287",
    name: "Manga' Travel Cabang Utama (eman)",
    // Saldo sebelum transaksi pertama (file_id 25: withdrawal 3.206.756 -> saldo 3.339.088)
    openingBalance: 6545844n,
    isActive: true,
  },
  {
    id: "agent-mks-20819",
    code: "MKS-20819",
    name: "Mitra Agen Makassar",
    openingBalance: 0n,
    isActive: true,
  },
] as const;

export const SAMPLE_SESSIONS: Record<"admin" | "agent", SampleUserSession> = {
  admin: {
    id: "user-admin-1",
    username: "admin",
    name: "Admin Manga' Travel",
    role: "admin",
    agentId: null,
    agentCode: null,
  },
  agent: {
    id: "user-eman-1",
    username: "eman",
    name: "eman",
    role: "agent",
    agentId: "agent-jkt-37287",
    agentCode: "JKT-37287",
  },
};

export const SAMPLE_SETTINGS: ReceiptBusinessSettings = {
  businessName: "Manga' Travel",
  logoPath: "/brand/logo.svg",
  contactPersonName: "Abdul Rachman Manga",
  contactPersonPhone: "0812-4100-7287",
  address: null,
  receiptFooterNote: "Terima kasih atas kepercayaan Anda.",
  showBalanceOnReceipt: false,
  showThermalLogo: true,
};

interface SeedRow {
  /** Nomor urut di file Excel contoh (1 = terbaru, 25 = terlama). Diabaikan untuk ID sistem. */
  fileId: number;
  transactionAtJakarta: string;
  case: "deposit" | "withdrawal" | "bonus";
  description: string;
  debit: bigint;
  credit: bigint;
}

/**
 * 25 baris kronologis (dari file_id 25 terlama s/d file_id 1 terbaru) untuk agen JKT-37287.
 * Empat baris jangkar dari docs/app-spec.json > sample_data (file_id 25, 23, 2, 1) dijaga persis.
 */
const SEED_ROWS_CHRONOLOGICAL: readonly SeedRow[] = [
  // file_id 25 (confirmed sample_data) -> saldo = 3.339.088
  {
    fileId: 25,
    transactionAtJakarta: "2026-07-22 20:16:37",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920014282",
    debit: 3206756n,
    credit: 0n,
  },
  // file_id 24 -> saldo = 3.353.653 (sesuai balance_rules.verified_against_sample sebelum deposit!)
  {
    fileId: 24,
    transactionAtJakarta: "2026-07-22 20:16:47",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920014282 (Kode Booking KLMPRQ)",
    debit: 0n,
    credit: 14565n,
  },
  // file_id 23 (confirmed sample_data) -> saldo = 43.354.655
  {
    fileId: 23,
    transactionAtJakarta: "2026-07-23 11:20:26",
    case: "deposit",
    description:
      "23/07/2026 11:17:39 903307 TRANSFER DARI | top up mmbc | Bpk ABDUL RACHMAN MANGA 40,001,002 by AUTO-TOPUP",
    debit: 0n,
    credit: 40001002n,
  },
  // file_id 22 & 21
  {
    fileId: 22,
    transactionAtJakarta: "2026-07-23 15:42:10",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920015104",
    debit: 4250000n,
    credit: 0n,
  },
  {
    fileId: 21,
    transactionAtJakarta: "2026-07-23 15:42:19",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920015104 (Kode Booking TRVJKP)",
    debit: 0n,
    credit: 38000n,
  },
  // file_id 20 & 19
  {
    fileId: 20,
    transactionAtJakarta: "2026-07-24 09:18:04",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920015889",
    debit: 3890500n,
    credit: 0n,
  },
  {
    fileId: 19,
    transactionAtJakarta: "2026-07-24 09:18:14",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920015889 (Kode Booking WQNBLX)",
    debit: 0n,
    credit: 32500n,
  },
  // file_id 18 & 17
  {
    fileId: 18,
    transactionAtJakarta: "2026-07-24 14:05:31",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920016210",
    debit: 5120000n,
    credit: 0n,
  },
  {
    fileId: 17,
    transactionAtJakarta: "2026-07-24 14:05:40",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920016210 (Kode Booking GHTYWM)",
    debit: 0n,
    credit: 45000n,
  },
  // file_id 16 & 15
  {
    fileId: 16,
    transactionAtJakarta: "2026-07-25 10:33:12",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920016945",
    debit: 2980400n,
    credit: 0n,
  },
  {
    fileId: 15,
    transactionAtJakarta: "2026-07-25 10:33:22",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920016945 (Kode Booking PLMKJN)",
    debit: 0n,
    credit: 24400n,
  },
  // file_id 14 & 13
  {
    fileId: 14,
    transactionAtJakarta: "2026-07-25 16:49:50",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920017302",
    debit: 4675000n,
    credit: 0n,
  },
  {
    fileId: 13,
    transactionAtJakarta: "2026-07-25 16:50:01",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920017302 (Kode Booking ZXCVBN)",
    debit: 0n,
    credit: 41000n,
  },
  // file_id 12 & 11
  {
    fileId: 12,
    transactionAtJakarta: "2026-07-26 11:12:08",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920017811",
    debit: 3540200n,
    credit: 0n,
  },
  {
    fileId: 11,
    transactionAtJakarta: "2026-07-26 11:12:18",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920017811 (Kode Booking QWRTYU)",
    debit: 0n,
    credit: 29200n,
  },
  // file_id 10 & 9
  {
    fileId: 10,
    transactionAtJakarta: "2026-07-26 19:27:44",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920018190",
    debit: 6150000n,
    credit: 0n,
  },
  {
    fileId: 9,
    transactionAtJakarta: "2026-07-26 19:27:53",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920018190 (Kode Booking ASDFGH)",
    debit: 0n,
    credit: 55000n,
  },
  // file_id 8 & 7
  {
    fileId: 8,
    transactionAtJakarta: "2026-07-27 08:55:19",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920018654",
    debit: 3420800n,
    credit: 0n,
  },
  {
    fileId: 7,
    transactionAtJakarta: "2026-07-27 08:55:29",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920018654 (Kode Booking JKLZXC)",
    debit: 0n,
    credit: 28800n,
  },
  // file_id 6 & 5
  {
    fileId: 6,
    transactionAtJakarta: "2026-07-27 14:40:03",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920019120",
    debit: 3785000n,
    credit: 0n,
  },
  {
    fileId: 5,
    transactionAtJakarta: "2026-07-27 14:40:12",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920019120 (Kode Booking BNMQWE)",
    debit: 0n,
    credit: 33000n,
  },
  // file_id 4 & 3 -> menurunkan saldo menjadi 2.768.475 sebelum file_id 2
  {
    fileId: 4,
    transactionAtJakarta: "2026-07-28 09:21:35",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920019544",
    debit: 3128430n,
    credit: 0n,
  },
  {
    fileId: 3,
    transactionAtJakarta: "2026-07-28 09:21:44",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920019544 (Kode Booking RTYFGH)",
    debit: 0n,
    credit: 27250n,
  },
  // file_id 2 (confirmed sample_data) -> saldo = 650.719
  {
    fileId: 2,
    transactionAtJakarta: "2026-07-28 14:13:06",
    case: "withdrawal",
    description: "Issued Flight No. Pesanan 920019906",
    debit: 2117756n,
    credit: 0n,
  },
  // file_id 1 (confirmed sample_data) -> saldo = 676.515
  {
    fileId: 1,
    transactionAtJakarta: "2026-07-28 14:13:16",
    case: "bonus",
    description:
      "Bonus Issued Flight No. Pesanan 920019906 (Kode Booking EQNMYK)",
    debit: 0n,
    credit: 25796n,
  },
];

function buildSampleTransactions(): ReceiptTransactionRecord[] {
  const primaryAgent = SAMPLE_AGENTS[0];

  // Sistem memberi ID internal auto-increment secara kronologis (1001..1025),
  // BUKAN ID terbalik dari file Excel (sesuai data_model.tables.transactions.fields.id).
  const prepared = SEED_ROWS_CHRONOLOGICAL.map((row, idx) => {
    const date = parseJakartaDateTime(row.transactionAtJakarta);
    if (!date) {
      throw new Error(`Invalid sample date: ${row.transactionAtJakarta}`);
    }
    return {
      id: BigInt(1001 + idx),
      agentId: primaryAgent.id,
      transactionAt: date,
      case: row.case,
      description: row.description,
      debit: row.debit,
      credit: row.credit,
    };
  });

  const computed = calculateAgentRunningBalances(
    primaryAgent.openingBalance,
    prepared
  );

  return computed.map(({ item, balanceAfter }) => {
    const refs = extractTransactionRefs(item.description);
    return {
      id: item.id.toString(),
      agentId: primaryAgent.id,
      agentCode: primaryAgent.code,
      agentName: primaryAgent.name,
      transactionAt: item.transactionAt.toISOString(),
      case: item.case,
      description: item.description,
      debit: item.debit.toString(),
      credit: item.credit.toString(),
      balance: balanceAfter.toString(),
      orderNumber: refs.orderNumber,
      bookingCode: refs.bookingCode,
      groupKey: refs.groupKey,
      source: "import",
    };
  });
}

export const SAMPLE_TRANSACTIONS: readonly ReceiptTransactionRecord[] =
  buildSampleTransactions();

