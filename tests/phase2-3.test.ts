import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  checkLoginRateLimit,
  clearFailedLoginAttempts,
  recordFailedLoginAttempt,
} from "@/lib/auth/rate-limit";
import {
  createSessionToken,
  SESSION_IDLE_TIMEOUT_MS,
  verifySessionToken,
} from "@/lib/auth/session-token";
import {
  parseAndValidateImportBuffer,
  type ImportAgentLookup,
} from "@/lib/domain/excel-parser";

describe("Authentication Session Token & Rate Limit (F-01)", () => {
  it("menandatangani dan memverifikasi token sesi HMAC-SHA256 serta mendeteksi kedaluwarsa 8 jam", async () => {
    const now = 1_760_000_000_000;
    const token = await createSessionToken({
      userId: "user-admin-1",
      role: "admin",
      nowMs: now,
    });

    const validCheck = await verifySessionToken(token, now + 60_000);
    expect(validCheck.status).toBe("valid");
    if (validCheck.status === "valid") {
      expect(validCheck.payload.userId).toBe("user-admin-1");
      expect(validCheck.payload.role).toBe("admin");
    }

    // Lewati 8 jam tidak aktif -> expired
    const expiredCheck = await verifySessionToken(
      token,
      now + SESSION_IDLE_TIMEOUT_MS + 1
    );
    expect(expiredCheck.status).toBe("expired");

    // Token dimodifikasi -> invalid
    const tampered = `${token.slice(0, -3)}abc`;
    const tamperedCheck = await verifySessionToken(tampered, now + 1000);
    expect(tamperedCheck.status).toBe("invalid");
  });

  it("membatasi 5 percobaan login gagal berturut-turut dan membuka kembali setelah reset", () => {
    const key = "127.0.0.1:testuser";
    clearFailedLoginAttempts(key);
    const t0 = 1_760_000_000_000;

    for (let i = 0; i < 5; i++) {
      expect(checkLoginRateLimit(key, t0).allowed).toBe(true);
      recordFailedLoginAttempt(key, t0);
    }

    const blocked = checkLoginRateLimit(key, t0 + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    clearFailedLoginAttempts(key);
    expect(checkLoginRateLimit(key, t0 + 1000).allowed).toBe(true);
  });
});

describe("Excel & CSV Import Parser (F-08)", () => {
  const sampleAgents = new Map<string, ImportAgentLookup>([
    [
      "JKT-37287",
      {
        id: "agent-jkt-37287",
        code: "JKT-37287",
        name: "Manga' Travel",
        isActive: true,
        openingBalance: 10_000_000n,
        currentBalance: 10_000_000n,
        hasPriorTransactions: true,
        latestTransactionAt: new Date("2026-07-28T07:13:16.000Z"),
      },
    ],
  ]);

  it("mendeteksi header dinamis pada .xlsx, mendeteksi duplikat, warning selisih saldo, dan error baris", () => {
    const rows = [
      ["LAPORAN CASHFLOW USER: eman - Periode 2026-07-29 s/d 2026-07-30"],
      [], // Baris kosong di atas header
      [
        "ID",
        "TANGGAL",
        "KODE AGEN",
        "CASE",
        "KETERANGAN",
        "DEBET",
        "KREDIT",
        "SALDO",
      ],
      // Baris 1 (terbaru): Bonus valid tetapi kolom SALDO file sengaja selisih 100 -> WARNING
      [
        "4",
        "2026-07-29 10:15:10",
        "JKT-37287",
        "Bonus",
        "Bonus Issued Flight No. Pesanan 920030001 (Kode Booking XYZZ99)",
        "",
        "Rp 25.000",
        "8.025.100",
      ],
      // Baris 2: Withdrawal valid (10.000.000 - 2.000.000 = 8.000.000)
      [
        "3",
        "2026-07-29 10:15:00",
        "JKT-37287",
        "Withdrawal",
        "Issued Flight No. Pesanan 920030001",
        "2,000,000",
        "",
        "8,000,000",
      ],
      // Baris 3: Duplikat persis dengan baris 2 di dalam file yang sama -> DUPLICATE
      [
        "2",
        "2026-07-29 10:15:00",
        "JKT-37287",
        "Withdrawal",
        "Issued Flight No. Pesanan 920030001",
        "2,000,000",
        "",
        "8,000,000",
      ],
      // Baris 4: Kode agen belum terdaftar -> ERROR
      [
        "1",
        "2026-07-29 09:00:00",
        "SUB-99999",
        "Deposit",
        "Top up agen tidak terdaftar",
        "",
        "5000000",
        "5000000",
      ],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Cashflow");
    const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const outcome = parseAndValidateImportBuffer({
      buffer: xlsxBuf,
      fileName: "LAPORAN-CASHFLOW-TEST.xlsx",
      agentsByCode: sampleAgents,
      existingDedupHashes: new Set(),
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.reportTitle).toContain("LAPORAN CASHFLOW USER: eman");
      expect(outcome.totalRows).toBe(4);
      expect(outcome.validRows).toBe(2); // 1 valid + 1 warning (warning tetap diimpor)
      expect(outcome.warningRows).toBe(1);
      expect(outcome.duplicateRows).toBe(1);
      expect(outcome.errorRows).toBe(1);

      const bonusRow = outcome.rows[0];
      expect(bonusRow.status).toBe("warning");
      expect(bonusRow.prepared?.bookingCode).toBe("XYZZ99");
      expect(bonusRow.prepared?.projectedBalance).toBe("8025000");

      const withdrawalRow = outcome.rows[1];
      expect(withdrawalRow.status).toBe("valid");
      expect(withdrawalRow.prepared?.projectedBalance).toBe("8000000");

      expect(outcome.rows[2].status).toBe("duplicate");
      expect(outcome.rows[3].status).toBe("error");
    }
  });

  it("mengembalikan pesan ramah sesuai spesifikasi saat file .xls rusak / tidak terbaca", () => {
    // Header OLE2 Compound Document yang sengaja dipotong/rusak (simulasi known_quirks .xls)
    const corruptOleBuffer = Buffer.from([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0xff, 0x00,
    ]);

    const outcome = parseAndValidateImportBuffer({
      buffer: corruptOleBuffer,
      fileName: "LAPORAN-CASHFLOW-20260722-20260728.xls",
      agentsByCode: sampleAgents,
      existingDedupHashes: new Set(),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.message).toBe(
        "File tidak dapat dibaca. Simpan ulang sebagai .xlsx atau .csv lalu coba lagi."
      );
    }
  });
});

