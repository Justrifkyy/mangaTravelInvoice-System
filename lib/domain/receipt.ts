/**
 * Aturan pembentukan data struk (Individual & Grup).
 * Sumber: docs/app-spec.json > features.F-06 & docs/design-spec.json > receipt & microcopy
 */

import { getTransactionCaseMeta } from "./cases";

export type ReceiptMode = "individual" | "group";
export type ReceiptPaperSize = "58" | "80" | "a4";

export interface ReceiptTransactionRecord {
  id: string;
  agentId: string;
  agentCode: string;
  agentName: string;
  transactionAt: string; // ISO string
  case: string;
  description: string;
  debit: string; // serialized bigint
  credit: string; // serialized bigint
  balance: string; // serialized bigint
  orderNumber: string | null;
  bookingCode: string | null;
  groupKey: string | null;
  source: "manual" | "import" | "api";
}

export interface ReceiptBusinessSettings {
  businessName: string;
  logoPath: string;
  contactPersonName: string;
  contactPersonPhone: string;
  address: string | null;
  receiptFooterNote: string | null;
  showBalanceOnReceipt: boolean;
  showThermalLogo: boolean;
}

export interface ReceiptLineItem {
  id: string;
  label: string;
  case: string;
  description: string;
  side: "debit" | "credit";
  amount: string; // serialized bigint
}

export interface ReceiptPayload {
  mode: ReceiptMode;
  title: string;
  header: {
    businessName: string;
    logoPath: string;
    contactPersonName: string;
    contactPersonPhone: string;
    address: string | null;
    showThermalLogo: boolean;
  };
  meta: {
    transactionId: string;
    primaryTransactionAt: string;
    agentCode: string;
    agentName: string;
    orderNumber: string | null;
    bookingCode: string | null;
  };
  individual?: {
    caseValue: string;
    caseLabel: string;
    description: string;
    side: "debit" | "credit";
    amount: string;
    balance: string | null;
  };
  group?: {
    groupKey: string;
    items: ReceiptLineItem[];
    totalDebit: string;
    totalCredit: string;
    netCost: string;
    isStandardPair: boolean;
    ticketPrice: string | null;
    bonusAmount: string | null;
    incompleteNote: string | null;
  };
  footer: {
    printedAt: string;
    printedBy: string;
    note: string | null;
  };
}

export type BuildReceiptResult =
  | { ok: true; receipt: ReceiptPayload }
  | {
      ok: false;
      code: "NOT_FOUND" | "GROUP_NOT_AVAILABLE" | "GROUP_NOT_FOUND";
      message: string;
    };

export function buildIndividualReceipt(params: {
  transaction: ReceiptTransactionRecord;
  settings: ReceiptBusinessSettings;
  printedBy: string;
  printedAt: Date;
}): BuildReceiptResult {
  const { transaction, settings, printedBy, printedAt } = params;
  const caseMeta = getTransactionCaseMeta(transaction.case);
  const debit = BigInt(transaction.debit);
  const credit = BigInt(transaction.credit);
  const side: "debit" | "credit" = debit > 0n ? "debit" : "credit";
  const amount = side === "debit" ? debit : credit;

  // Sesuai F-06 > deposit_rule & design-spec > microcopy.receipt_titles
  const title =
    transaction.case === "deposit" ? "BUKTI TOP UP" : "STRUK TRANSAKSI";

  return {
    ok: true,
    receipt: {
      mode: "individual",
      title,
      header: {
        businessName: settings.businessName,
        logoPath: settings.logoPath,
        contactPersonName: settings.contactPersonName,
        contactPersonPhone: settings.contactPersonPhone,
        address: settings.address,
        showThermalLogo: settings.showThermalLogo,
      },
      meta: {
        transactionId: transaction.id,
        primaryTransactionAt: transaction.transactionAt,
        agentCode: transaction.agentCode,
        agentName: transaction.agentName,
        orderNumber: transaction.orderNumber,
        bookingCode: transaction.bookingCode,
      },
      individual: {
        caseValue: transaction.case,
        caseLabel: caseMeta.label,
        description: transaction.description,
        side,
        amount: amount.toString(),
        balance: settings.showBalanceOnReceipt ? transaction.balance : null,
      },
      footer: {
        printedAt: printedAt.toISOString(),
        printedBy,
        note: settings.receiptFooterNote,
      },
    },
  };
}

export function buildGroupReceipt(params: {
  anchorTransaction: ReceiptTransactionRecord;
  groupMembers: ReceiptTransactionRecord[];
  settings: ReceiptBusinessSettings;
  printedBy: string;
  printedAt: Date;
}): BuildReceiptResult {
  const { anchorTransaction, groupMembers, settings, printedBy, printedAt } =
    params;

  if (!anchorTransaction.groupKey) {
    return {
      ok: false,
      code: "GROUP_NOT_AVAILABLE",
      message:
        "Transaksi ini tidak memiliki nomor pesanan sehingga hanya dapat dicetak secara individual.",
    };
  }

  // Pastikan hanya anggota dengan groupKey & agentId yang sama (F-06 > group_rules.key)
  const validMembers = groupMembers.filter(
    (m) =>
      m.groupKey === anchorTransaction.groupKey &&
      m.agentId === anchorTransaction.agentId
  );

  if (validMembers.length === 0) {
    return {
      ok: false,
      code: "GROUP_NOT_FOUND",
      message: "Grup transaksi tidak ditemukan.",
    };
  }

  // Urutkan kronologis (withdrawal biasanya lebih dulu dari bonus)
  const sorted = [...validMembers].sort((a, b) => {
    const diff =
      new Date(a.transactionAt).getTime() - new Date(b.transactionAt).getTime();
    if (diff !== 0) return diff;
    return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
  });

  const withdrawals = sorted.filter((m) => m.case === "withdrawal");
  const bonuses = sorted.filter((m) => m.case === "bonus");

  // Waktu utama = waktu withdrawal pertama; fallback ke anggota paling awal
  const primaryTx = withdrawals[0] ?? sorted[0];

  // Kode booking biasanya ada pada baris bonus
  const bookingCode =
    sorted.find((m) => Boolean(m.bookingCode))?.bookingCode ?? null;

  let totalDebit = 0n;
  let totalCredit = 0n;

  const items: ReceiptLineItem[] = sorted.map((m) => {
    const d = BigInt(m.debit);
    const c = BigInt(m.credit);
    totalDebit += d;
    totalCredit += c;

    const side: "debit" | "credit" = d > 0n ? "debit" : "credit";
    const amount = side === "debit" ? d : c;

    let label = getTransactionCaseMeta(m.case).label;
    if (m.case === "withdrawal") label = "Harga tiket";
    else if (m.case === "bonus") label = "Bonus";

    return {
      id: m.id,
      label,
      case: m.case,
      description: m.description,
      side,
      amount: amount.toString(),
    };
  });

  const netCost = totalDebit - totalCredit;

  const isStandardPair =
    sorted.length === 2 && withdrawals.length === 1 && bonuses.length === 1;

  let incompleteNote: string | null = null;
  if (withdrawals.length > 0 && bonuses.length === 0) {
    incompleteNote = "Catatan: bonus belum tercatat untuk pesanan ini.";
  } else if (withdrawals.length === 0 && bonuses.length > 0) {
    incompleteNote =
      "Catatan: transaksi harga tiket (withdrawal) belum tercatat untuk pesanan ini.";
  }

  return {
    ok: true,
    receipt: {
      mode: "group",
      title: "STRUK GRUP TRANSAKSI",
      header: {
        businessName: settings.businessName,
        logoPath: settings.logoPath,
        contactPersonName: settings.contactPersonName,
        contactPersonPhone: settings.contactPersonPhone,
        address: settings.address,
        showThermalLogo: settings.showThermalLogo,
      },
      meta: {
        transactionId: primaryTx.id,
        primaryTransactionAt: primaryTx.transactionAt,
        agentCode: anchorTransaction.agentCode,
        agentName: anchorTransaction.agentName,
        orderNumber: anchorTransaction.groupKey,
        bookingCode,
      },
      group: {
        groupKey: anchorTransaction.groupKey,
        items,
        totalDebit: totalDebit.toString(),
        totalCredit: totalCredit.toString(),
        netCost: netCost.toString(),
        isStandardPair,
        ticketPrice:
          withdrawals.length === 1 ? withdrawals[0].debit : null,
        bonusAmount: bonuses.length === 1 ? bonuses[0].credit : null,
        incompleteNote,
      },
      footer: {
        printedAt: printedAt.toISOString(),
        printedBy,
        note: settings.receiptFooterNote,
      },
    },
  };
}

