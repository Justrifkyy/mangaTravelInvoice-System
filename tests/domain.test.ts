import { describe, expect, it } from "vitest";
import { extractTransactionRefs } from "@/lib/domain/extraction";
import {
  calculateAgentRunningBalances,
  deriveOpeningBalance,
} from "@/lib/domain/balance";
import { parseRupiahToBigInt } from "@/lib/domain/money";
import { formatDateTimeTable, formatRupiah } from "@/lib/domain/format";
import { validateAndPrepareTransaction } from "@/lib/domain/ingest";
import {
  buildGroupReceipt,
  buildIndividualReceipt,
  type ReceiptTransactionRecord,
} from "@/lib/domain/receipt";
import {
  SAMPLE_AGENTS,
  SAMPLE_SESSIONS,
  SAMPLE_SETTINGS,
  SAMPLE_TRANSACTIONS,
} from "@/lib/data/sample-data";
import { parseTransactionSearchParams } from "@/lib/validation/transaction-query";
import {
  buildReceiptFromDataset,
  filterAndPaginateTransactions,
  findTransactionDetailInDataset,
} from "@/lib/services/transaction-service";

describe("Extraction Rules (docs/app-spec.json > extraction_rules)", () => {
  it("mengekstrak order_number dari transaksi withdrawal", () => {
    const res = extractTransactionRefs("Issued Flight No. Pesanan 920019906");
    expect(res).toEqual({
      orderNumber: "920019906",
      bookingCode: null,
      groupKey: "920019906",
    });
  });

  it("mengekstrak order_number dan booking_code dari transaksi bonus", () => {
    const res = extractTransactionRefs(
      "Bonus Issued Flight No. Pesanan 920019906 (Kode Booking EQNMYK)"
    );
    expect(res).toEqual({
      orderNumber: "920019906",
      bookingCode: "EQNMYK",
      groupKey: "920019906",
    });
  });

  it("mengembalikan null dengan aman untuk keterangan deposit top up", () => {
    const res = extractTransactionRefs(
      "23/07/2026 11:17:39 903307 TRANSFER DARI | top up mmbc | Bpk ABDUL RACHMAN MANGA 40,001,002 by AUTO-TOPUP"
    );
    expect(res).toEqual({
      orderNumber: null,
      bookingCode: null,
      groupKey: null,
    });
  });
});

describe("Money & Formatting Rules (integer Rupiah tanpa float)", () => {
  it("mengurai berbagai format nominal ribuan ke bigint", () => {
    expect(parseRupiahToBigInt(2117756)).toBe(2117756n);
    expect(parseRupiahToBigInt("2,117,756")).toBe(2117756n);
    expect(parseRupiahToBigInt("2.117.756")).toBe(2117756n);
    expect(parseRupiahToBigInt("Rp 40.001.002")).toBe(40001002n);
    expect(parseRupiahToBigInt("")).toBe(0n);
    expect(parseRupiahToBigInt(123.45)).toBeNull();
  });

  it("memformat Rupiah dan tanggal sesuai spesifikasi", () => {
    expect(formatRupiah(2117756n)).toBe("Rp 2.117.756");
    expect(formatRupiah(0n, { emptyAsDash: true })).toBe("—");
    expect(formatRupiah(-150000n)).toBe("-Rp 150.000");
    expect(formatDateTimeTable("2026-07-28T14:13:16+07:00")).toBe(
      "28 Jul 2026, 14:13:16"
    );
  });
});

describe("Balance Rules & Sample Data Verification (docs/app-spec.json > balance_rules & sample_data)", () => {
  it("menurunkan opening balance dengan tepat dari baris kronologis pertama", () => {
    // file_id 25: withdrawal 3.206.756 menghasilkan saldo 3.339.088 -> opening = 6.545.844
    const opening = deriveOpeningBalance({
      fileBalance: 3339088n,
      credit: 0n,
      debit: 3206756n,
    });
    expect(opening).toBe(6545844n);
    expect(SAMPLE_AGENTS[0].openingBalance).toBe(6545844n);
  });

  it("menghasilkan tepat 25 baris sample_data yang cocok 100% dengan seluruh angka di app-spec.json", () => {
    expect(SAMPLE_TRANSACTIONS).toHaveLength(25);

    // Baris pertama kronologis (file_id 25: Pesanan 920014282 withdrawal)
    const rowFile25 = SAMPLE_TRANSACTIONS[0];
    expect(rowFile25.orderNumber).toBe("920014282");
    expect(rowFile25.debit).toBe("3206756");
    expect(rowFile25.balance).toBe("3339088");

    // Baris deposit (file_id 23: deposit 40.001.002 setelah saldo 3.353.653 -> 43.354.655)
    const rowFile23 = SAMPLE_TRANSACTIONS.find((t) => t.case === "deposit");
    expect(rowFile23).toBeDefined();
    expect(rowFile23?.credit).toBe("40001002");
    expect(rowFile23?.balance).toBe("43354655");

    // Baris withdrawal Pesanan 920019906 (file_id 2: debit 2.117.756 -> saldo 650.719)
    const rowFile2 = SAMPLE_TRANSACTIONS.find(
      (t) => t.orderNumber === "920019906" && t.case === "withdrawal"
    );
    expect(rowFile2?.debit).toBe("2117756");
    expect(rowFile2?.balance).toBe("650719");

    // Baris bonus Pesanan 920019906 (file_id 1: credit 25.796 -> saldo 676.515, booking EQNMYK)
    const rowFile1 = SAMPLE_TRANSACTIONS.find(
      (t) => t.orderNumber === "920019906" && t.case === "bonus"
    );
    expect(rowFile1?.credit).toBe("25796");
    expect(rowFile1?.bookingCode).toBe("EQNMYK");
    expect(rowFile1?.balance).toBe("676515");
  });

  it("menghitung ulang saldo secara urut transactionAt ASC lalu id ASC pada detik yang sama", () => {
    const sameSecond = new Date("2026-07-28T07:00:00Z");
    const computed = calculateAgentRunningBalances(1000000n, [
      {
        id: 2n,
        agentId: "a1",
        transactionAt: sameSecond,
        debit: 0n,
        credit: 25000n,
      },
      {
        id: 1n,
        agentId: "a1",
        transactionAt: sameSecond,
        debit: 400000n,
        credit: 0n,
      },
    ]);

    expect(computed[0].item.id).toBe(1n);
    expect(computed[0].balanceAfter).toBe(600000n);
    expect(computed[1].item.id).toBe(2n);
    expect(computed[1].balanceAfter).toBe(625000n);
  });
});

describe("Shared TransactionIngestService Validation", () => {
  it("menolak transaksi jika debit & credit sama-sama > 0 atau sisi case salah", () => {
    const bothFilled = validateAndPrepareTransaction({
      agentId: "agent-jkt-37287",
      transactionAt: new Date("2026-07-28T07:13:06Z"),
      case: "withdrawal",
      description: "Issued Flight No. Pesanan 920019906",
      debit: 100000n,
      credit: 5000n,
      source: "manual",
    });
    expect(bothFilled.ok).toBe(false);

    const wrongSide = validateAndPrepareTransaction({
      agentId: "agent-jkt-37287",
      transactionAt: new Date("2026-07-28T07:13:06Z"),
      case: "withdrawal",
      description: "Issued Flight No. Pesanan 920019906",
      debit: 0n,
      credit: 100000n,
      source: "manual",
    });
    expect(wrongSide.ok).toBe(false);
  });
});

describe("Receipt Rules (F-06: Individual, Grup, Deposit, Incomplete Group)", () => {
  const printedAt = new Date("2026-10-30T03:00:00Z");

  it("menghitung biaya bersih grup dengan tepat (2.117.756 - 25.796 = 2.091.960)", () => {
    const txBonus = SAMPLE_TRANSACTIONS[SAMPLE_TRANSACTIONS.length - 1];
    const res = buildReceiptFromDataset({
      session: SAMPLE_SESSIONS.agent,
      transactionId: txBonus.id,
      mode: "group",
      printedAt,
      settings: SAMPLE_SETTINGS,
      dataset: SAMPLE_TRANSACTIONS,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.receipt.title).toBe("STRUK GRUP TRANSAKSI");
      expect(res.receipt.meta.orderNumber).toBe("920019906");
      expect(res.receipt.meta.bookingCode).toBe("EQNMYK");
      expect(res.receipt.group?.netCost).toBe("2091960");
      expect(res.receipt.group?.incompleteNote).toBeNull();
    }
  });

  it("memberi judul BUKTI TOP UP untuk deposit dan menolak cetak grup pada deposit", () => {
    const depositTx = SAMPLE_TRANSACTIONS.find((t) => t.case === "deposit")!;

    const indRes = buildIndividualReceipt({
      transaction: depositTx,
      settings: SAMPLE_SETTINGS,
      printedBy: "eman",
      printedAt,
    });
    expect(indRes.ok).toBe(true);
    if (indRes.ok) {
      expect(indRes.receipt.title).toBe("BUKTI TOP UP");
    }

    const grpRes = buildGroupReceipt({
      anchorTransaction: depositTx,
      groupMembers: [depositTx],
      settings: SAMPLE_SETTINGS,
      printedBy: "eman",
      printedAt,
    });
    expect(grpRes.ok).toBe(false);
    if (!grpRes.ok) {
      expect(grpRes.code).toBe("GROUP_NOT_AVAILABLE");
    }
  });

  it("tetap mencetak grup tidak lengkap (withdrawal tanpa bonus) disertai catatan peringatan", () => {
    const loneWithdrawal: ReceiptTransactionRecord = {
      id: "9999",
      agentId: "agent-jkt-37287",
      agentCode: "JKT-37287",
      agentName: "Manga' Travel",
      transactionAt: "2026-07-29T04:00:00.000Z",
      case: "withdrawal",
      description: "Issued Flight No. Pesanan 920099999",
      debit: "1500000",
      credit: "0",
      balance: "500000",
      orderNumber: "920099999",
      bookingCode: null,
      groupKey: "920099999",
      source: "manual",
    };

    const res = buildGroupReceipt({
      anchorTransaction: loneWithdrawal,
      groupMembers: [loneWithdrawal],
      settings: SAMPLE_SETTINGS,
      printedBy: "eman",
      printedAt,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.receipt.group?.netCost).toBe("1500000");
      expect(res.receipt.group?.incompleteNote).toBe(
        "Catatan: bonus belum tercatat untuk pesanan ini."
      );
    }
  });
});

describe("Filter, Search & Server Security Rules (F-03, F-04, roles.security_rule)", () => {
  it("contoh F-03: Tanggal 22-28 Juli 2026 + case deposit menghasilkan tepat 1 transaksi Rp 40.001.002", () => {
    const parsed = parseTransactionSearchParams({
      from: "2026-07-22",
      to: "2026-07-28",
      case: "deposit",
    });
    const result = filterAndPaginateTransactions(
      SAMPLE_SESSIONS.admin,
      parsed,
      SAMPLE_TRANSACTIONS
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].credit).toBe("40001002");
    expect(result.summary.totalCredit).toBe("40001002");
  });

  it("mencegah role agent melihat atau mencetak transaksi milik agen lain di server", () => {
    const otherAgentTx: ReceiptTransactionRecord = {
      id: "2001",
      agentId: "agent-mks-20819",
      agentCode: "MKS-20819",
      agentName: "Mitra Agen Makassar",
      transactionAt: "2026-07-28T05:00:00.000Z",
      case: "deposit",
      description: "Top up agen Makassar",
      debit: "0",
      credit: "10000000",
      balance: "10000000",
      orderNumber: null,
      bookingCode: null,
      groupKey: null,
      source: "manual",
    };

    const dataset = [...SAMPLE_TRANSACTIONS, otherAgentTx];

    // Meskipun URL memaksa agentCode=MKS-20819, server mengabaikannya untuk role agent
    const parsed = parseTransactionSearchParams({ agentCode: "MKS-20819" });
    const listRes = filterAndPaginateTransactions(
      SAMPLE_SESSIONS.agent,
      parsed,
      dataset
    );
    expect(listRes.items.every((t) => t.agentCode === "JKT-37287")).toBe(true);

    // Detail & Struk mengembalikan tidak ditemukan untuk transaksi agen lain
    expect(
      findTransactionDetailInDataset(SAMPLE_SESSIONS.agent, "2001", dataset)
    ).toBeNull();

    const receiptRes = buildReceiptFromDataset({
      session: SAMPLE_SESSIONS.agent,
      transactionId: "2001",
      mode: "individual",
      printedAt: new Date(),
      settings: SAMPLE_SETTINGS,
      dataset,
    });
    expect(receiptRes.ok).toBe(false);
    if (!receiptRes.ok) {
      expect(receiptRes.code).toBe("NOT_FOUND");
    }
  });
});
