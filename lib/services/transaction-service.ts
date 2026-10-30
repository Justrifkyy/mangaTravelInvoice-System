/**
 * Layanan server untuk membaca, menyaring, mencari, merangkum, dan membentuk struk transaksi.
 * Terhubung ke AppDataRepository (otomatis mendukung MySQL XAMPP via Prisma maupun Local Store).
 * WAJIB: Pembatasan data per agen dilakukan di SERVER (docs/app-spec.json > roles.security_rule).
 */

import { getDataRepository } from "@/lib/db/repository";
import type { AppAgentRecord, SessionUser } from "@/lib/db/types";
import { getTransactionCaseMeta } from "@/lib/domain/cases";
import {
  buildGroupReceipt,
  buildIndividualReceipt,
  type BuildReceiptResult,
  type ReceiptBusinessSettings,
  type ReceiptMode,
  type ReceiptTransactionRecord,
} from "@/lib/domain/receipt";
import type { ParsedTransactionQuery } from "@/lib/validation/transaction-query";

export interface TransactionSummaryDto {
  /** Null jika hasil mencakup 0 agen atau > 1 agen (tampilkan '—' sesuai F-02 > summary_cards) */
  latestBalance: string | null;
  totalCredit: string;
  totalDebit: string;
  totalCount: number;
}

export interface TransactionListResult {
  items: ReceiptTransactionRecord[];
  summary: TransactionSummaryDto;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    fromIndex: number;
    toIndex: number;
  };
  emptyReason:
    | null
    | "no_transactions"
    | "filter_no_result"
    | "search_no_result"
    | "validation_error";
  validationError: string | null;
}

export interface TransactionDetailResult {
  transaction: ReceiptTransactionRecord;
  relatedTransactions: ReceiptTransactionRecord[];
}

function filterDatasetForSession(
  session: SessionUser,
  dataset: readonly ReceiptTransactionRecord[]
): ReceiptTransactionRecord[] {
  if (session.role === "agent") {
    return dataset.filter((tx) => tx.agentId === session.agentId);
  }
  return [...dataset];
}

/**
 * Fungsi murni penyaringan & pencarian transaksi (dipakai oleh repository live maupun unit test).
 */
export function filterAndPaginateTransactions(
  session: SessionUser,
  parsed: ParsedTransactionQuery,
  dataset: readonly ReceiptTransactionRecord[]
): TransactionListResult {
  const scoped = filterDatasetForSession(session, dataset);

  const effectiveAgentCode =
    session.role === "admin" ? parsed.query.agentCode : "";
  const effectiveFilterCount =
    parsed.activeFilterCount -
    (session.role === "agent" && parsed.query.agentCode ? 1 : 0);

  if (parsed.validationError) {
    return {
      items: [],
      summary: {
        latestBalance: null,
        totalCredit: "0",
        totalDebit: "0",
        totalCount: 0,
      },
      pagination: {
        page: 1,
        pageSize: parsed.query.pageSize,
        totalItems: 0,
        totalPages: 0,
        fromIndex: 0,
        toIndex: 0,
      },
      emptyReason: "validation_error",
      validationError: parsed.validationError,
    };
  }

  if (scoped.length === 0) {
    return {
      items: [],
      summary: {
        latestBalance: null,
        totalCredit: "0",
        totalDebit: "0",
        totalCount: 0,
      },
      pagination: {
        page: 1,
        pageSize: parsed.query.pageSize,
        totalItems: 0,
        totalPages: 0,
        fromIndex: 0,
        toIndex: 0,
      },
      emptyReason: "no_transactions",
      validationError: null,
    };
  }

  const fromTimestamp = parsed.query.from
    ? new Date(`${parsed.query.from}T00:00:00.000+07:00`).getTime()
    : null;
  const toTimestamp = parsed.query.to
    ? new Date(`${parsed.query.to}T23:59:59.999+07:00`).getTime()
    : null;

  const caseSet =
    parsed.query.cases.length > 0 ? new Set(parsed.query.cases) : null;
  const normalizedAgentFilter = effectiveAgentCode.toLowerCase();
  const normalizedDescFilter = parsed.query.desc.toLowerCase();

  const qRaw = parsed.query.q.trim();
  const qLower = qRaw.toLowerCase();
  const qIsNumeric = /^\d+$/.test(qRaw);

  const filtered = scoped.filter((tx) => {
    const txTime = new Date(tx.transactionAt).getTime();

    if (fromTimestamp !== null && txTime < fromTimestamp) return false;
    if (toTimestamp !== null && txTime > toTimestamp) return false;

    if (caseSet && !caseSet.has(tx.case.toLowerCase())) return false;

    const debit = BigInt(tx.debit);
    const credit = BigInt(tx.credit);
    const balance = BigInt(tx.balance);
    const activeNominal = debit > 0n ? debit : credit;

    if (parsed.query.type === "debit" && debit <= 0n) return false;
    if (parsed.query.type === "credit" && credit <= 0n) return false;

    if (
      normalizedAgentFilter &&
      tx.agentCode.toLowerCase() !== normalizedAgentFilter
    ) {
      return false;
    }

    if (
      parsed.amountMinBigInt !== null &&
      activeNominal < parsed.amountMinBigInt
    ) {
      return false;
    }
    if (
      parsed.amountMaxBigInt !== null &&
      activeNominal > parsed.amountMaxBigInt
    ) {
      return false;
    }

    if (
      parsed.balanceMinBigInt !== null &&
      balance < parsed.balanceMinBigInt
    ) {
      return false;
    }
    if (
      parsed.balanceMaxBigInt !== null &&
      balance > parsed.balanceMaxBigInt
    ) {
      return false;
    }

    if (
      normalizedDescFilter &&
      !tx.description.toLowerCase().includes(normalizedDescFilter)
    ) {
      return false;
    }

    if (qLower) {
      const caseLabel = getTransactionCaseMeta(tx.case).label.toLowerCase();
      const matchesId = qIsNumeric && tx.id === qRaw;
      const matchesOrder =
        tx.orderNumber?.toLowerCase().includes(qLower) ?? false;
      const matchesBooking =
        tx.bookingCode?.toLowerCase().includes(qLower) ?? false;
      const matchesAgent = tx.agentCode.toLowerCase().includes(qLower);
      const matchesCase =
        tx.case.toLowerCase().includes(qLower) || caseLabel.includes(qLower);
      const matchesDesc = tx.description.toLowerCase().includes(qLower);

      if (
        !matchesId &&
        !matchesOrder &&
        !matchesBooking &&
        !matchesAgent &&
        !matchesCase &&
        !matchesDesc
      ) {
        return false;
      }
    }

    return true;
  });

  let totalCredit = 0n;
  let totalDebit = 0n;
  const agentIdsInResult = new Set<string>();
  let newestTx: ReceiptTransactionRecord | null = null;

  for (const tx of filtered) {
    totalCredit += BigInt(tx.credit);
    totalDebit += BigInt(tx.debit);
    agentIdsInResult.add(tx.agentId);

    if (!newestTx) {
      newestTx = tx;
    } else {
      const currTime = new Date(tx.transactionAt).getTime();
      const newestTime = new Date(newestTx.transactionAt).getTime();
      if (
        currTime > newestTime ||
        (currTime === newestTime && BigInt(tx.id) > BigInt(newestTx.id))
      ) {
        newestTx = tx;
      }
    }
  }

  const latestBalance =
    agentIdsInResult.size === 1 && newestTx ? newestTx.balance : null;

  const sorted = [...filtered].sort((a, b) => {
    const diff =
      new Date(a.transactionAt).getTime() - new Date(b.transactionAt).getTime();
    const idDiff =
      BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0;
    const ascResult = diff !== 0 ? diff : idDiff;
    return parsed.query.sort === "date_asc" ? ascResult : -ascResult;
  });

  const totalItems = sorted.length;
  const pageSize = parsed.query.pageSize;
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0;
  const safePage =
    totalPages > 0 ? Math.min(parsed.query.page, totalPages) : 1;

  const startIdx = (safePage - 1) * pageSize;
  const pagedItems = sorted.slice(startIdx, startIdx + pageSize);

  let emptyReason: TransactionListResult["emptyReason"] = null;
  if (totalItems === 0) {
    emptyReason =
      effectiveFilterCount > 0 ? "filter_no_result" : "search_no_result";
  }

  return {
    items: pagedItems,
    summary: {
      latestBalance,
      totalCredit: totalCredit.toString(),
      totalDebit: totalDebit.toString(),
      totalCount: totalItems,
    },
    pagination: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
      fromIndex: totalItems > 0 ? startIdx + 1 : 0,
      toIndex: totalItems > 0 ? startIdx + pagedItems.length : 0,
    },
    emptyReason,
    validationError: null,
  };
}

export function findTransactionDetailInDataset(
  session: SessionUser,
  transactionId: string,
  dataset: readonly ReceiptTransactionRecord[]
): TransactionDetailResult | null {
  const scoped = filterDatasetForSession(session, dataset);
  const transaction = scoped.find((tx) => tx.id === transactionId);
  if (!transaction) {
    return null;
  }

  const relatedTransactions = transaction.groupKey
    ? scoped
        .filter(
          (tx) =>
            tx.groupKey === transaction.groupKey &&
            tx.agentId === transaction.agentId &&
            tx.id !== transaction.id
        )
        .sort(
          (a, b) =>
            new Date(a.transactionAt).getTime() -
            new Date(b.transactionAt).getTime()
        )
    : [];

  return {
    transaction,
    relatedTransactions,
  };
}

export function buildReceiptFromDataset(params: {
  session: SessionUser;
  transactionId: string;
  mode: ReceiptMode;
  printedAt: Date;
  settings: ReceiptBusinessSettings;
  dataset: readonly ReceiptTransactionRecord[];
}): BuildReceiptResult {
  const { session, transactionId, mode, printedAt, settings, dataset } = params;
  const scoped = filterDatasetForSession(session, dataset);
  const transaction = scoped.find((tx) => tx.id === transactionId);

  if (!transaction) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Transaksi tidak ditemukan.",
    };
  }

  if (mode === "individual") {
    return buildIndividualReceipt({
      transaction,
      settings,
      printedBy: session.name,
      printedAt,
    });
  }

  const groupMembers = transaction.groupKey
    ? scoped.filter(
        (tx) =>
          tx.groupKey === transaction.groupKey &&
          tx.agentId === transaction.agentId
      )
    : [];

  return buildGroupReceipt({
    anchorTransaction: transaction,
    groupMembers,
    settings,
    printedBy: session.name,
    printedAt,
  });
}

// ============================================================================
// Fungsi Live Async yang membaca dari Repository Aktif (MySQL Prisma / Local Store)
// ============================================================================

export async function listAvailableAgentsForSession(
  session: SessionUser
): Promise<AppAgentRecord[]> {
  const repo = getDataRepository();
  const agents = await repo.listAgents();
  if (session.role === "agent") {
    return agents.filter((a) => a.id === session.agentId);
  }
  return agents;
}

export async function queryTransactionsForSession(
  session: SessionUser,
  parsed: ParsedTransactionQuery
): Promise<TransactionListResult> {
  const repo = getDataRepository();
  const dataset = await repo.listAllTransactionsForScope(session);
  return filterAndPaginateTransactions(session, parsed, dataset);
}

export async function getTransactionDetailForSession(
  session: SessionUser,
  transactionId: string
): Promise<TransactionDetailResult | null> {
  const repo = getDataRepository();
  const dataset = await repo.listAllTransactionsForScope(session);
  return findTransactionDetailInDataset(session, transactionId, dataset);
}

export async function getReceiptForSession(params: {
  session: SessionUser;
  transactionId: string;
  mode: ReceiptMode;
  printedAt: Date;
  recordAudit?: boolean;
}): Promise<BuildReceiptResult> {
  const repo = getDataRepository();
  const [dataset, settings] = await Promise.all([
    repo.listAllTransactionsForScope(params.session),
    repo.getSettings(),
  ]);

  const built = buildReceiptFromDataset({
    session: params.session,
    transactionId: params.transactionId,
    mode: params.mode,
    printedAt: params.printedAt,
    settings,
    dataset,
  });

  if (built.ok && params.recordAudit) {
    await repo.writeAuditLog({
      userId: params.session.id,
      action: "print_receipt",
      entity: "transactions",
      entityId: params.transactionId,
      metadata: { mode: params.mode },
    });
  }

  return built;
}
