/**
 * Parser & Validator Impor Excel / CSV.
 * Sumber: docs/app-spec.json > features.F-08 & docs/design-spec.json > microcopy.empty_and_errors
 *
 * Fitur:
 * - Mendukung .xls, .xlsx, .csv melalui SheetJS (xlsx)
 * - Fallback pesan ramah jika file .xls rusak (known_quirks)
 * - Deteksi baris header dinamis ('TANGGAL' dan 'KODE AGEN') tanpa hardcode nomor baris
 * - Memakai TransactionIngestService (validateAndPrepareTransaction) bersama
 * - Deteksi duplikat terhadap database maupun antarbaris di dalam file yang sama (idempoten)
 * - Verifikasi kolom SALDO file vs hitungan sistem (ditandai sebagai WARNING, bukan error)
 */

import * as XLSX from "xlsx";
import {
  calculateAgentRunningBalances,
  deriveOpeningBalance,
} from "./balance";
import { formatRupiah, parseJakartaDateTime } from "./format";
import { validateAndPrepareTransaction } from "./ingest";
import { parseRupiahToBigInt } from "./money";

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export type ImportRowStatusType = "valid" | "warning" | "error" | "duplicate";

export interface ImportAgentLookup {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  openingBalance: bigint;
  currentBalance: bigint;
  hasPriorTransactions: boolean;
  latestTransactionAt: Date | null;
}

export interface ParsedImportPreviewRow {
  rowNumber: number; // Nomor baris pada sheet asli (1-based)
  rawTanggal: string;
  rawAgentCode: string;
  rawCase: string;
  rawDescription: string;
  rawDebit: string;
  rawCredit: string;
  rawFileBalance: string;
  status: ImportRowStatusType;
  messages: string[];
  // Data siap simpan (hanya terisi untuk baris valid / warning)
  prepared?: {
    agentId: string;
    agentCode: string;
    transactionAtIso: string;
    case: string;
    description: string;
    debit: string;
    credit: string;
    projectedBalance: string;
    fileBalance: string | null;
    derivedOpeningBalance: string | null;
    orderNumber: string | null;
    bookingCode: string | null;
    groupKey: string | null;
    dedupHash: string;
  };
}

export interface ParseImportFileResult {
  ok: true;
  reportTitle: string | null;
  totalRows: number;
  validRows: number; // Termasuk baris dengan status 'valid' maupun 'warning' (karena warning tidak memblokir)
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  rows: ParsedImportPreviewRow[];
}

export type ParseImportFileOutcome =
  | ParseImportFileResult
  | { ok: false; message: string };

const FILE_UNREADABLE_MSG =
  "File tidak dapat dibaca. Simpan ulang sebagai .xlsx atau .csv lalu coba lagi.";

function normalizeHeaderCell(cell: unknown): string {
  return String(cell ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/**
 * Mengurai string tanggal dari Excel/CSV dalam timezone Asia/Jakarta:
 * - "YYYY-MM-DD HH:mm:ss" / "YYYY-MM-DD HH:mm" / "YYYY-MM-DD"
 * - "DD/MM/YYYY HH:mm:ss" / "DD-MM-YYYY HH:mm:ss"
 */
export function parseFlexibleImportDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isoAttempt = parseJakartaDateTime(trimmed);
  if (isoAttempt) return isoAttempt;

  const dmyMatch = trimmed.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmyMatch) {
    const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = dmyMatch;
    const normalized = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")} ${hh.padStart(2, "0")}:${min}:${ss}`;
    return parseJakartaDateTime(normalized);
  }

  return null;
}

export function parseAndValidateImportBuffer(params: {
  buffer: Buffer | Uint8Array;
  fileName: string;
  agentsByCode: ReadonlyMap<string, ImportAgentLookup>;
  existingDedupHashes: ReadonlySet<string>;
}): ParseImportFileOutcome {
  const { buffer, fileName, agentsByCode, existingDedupHashes } = params;

  const lowerName = fileName.toLowerCase();
  if (
    !lowerName.endsWith(".xls") &&
    !lowerName.endsWith(".xlsx") &&
    !lowerName.endsWith(".csv")
  ) {
    return {
      ok: false,
      message: "Format file tidak didukung. Gunakan file .xls, .xlsx, atau .csv.",
    };
  }

  if (buffer.byteLength === 0) {
    return {
      ok: false,
      message: FILE_UNREADABLE_MSG,
    };
  }

  if (buffer.byteLength > MAX_IMPORT_FILE_BYTES) {
    return {
      ok: false,
      message: "Ukuran file melebihi batas maksimum 10 MB.",
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      raw: false,
    });
  } catch {
    return {
      ok: false,
      message: FILE_UNREADABLE_MSG,
    };
  }

  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) {
    return {
      ok: false,
      message: FILE_UNREADABLE_MSG,
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    return {
      ok: false,
      message: FILE_UNREADABLE_MSG,
    };
  }

  let matrix: unknown[][];
  try {
    matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: false,
    });
  } catch {
    return {
      ok: false,
      message: FILE_UNREADABLE_MSG,
    };
  }

  if (!matrix || matrix.length === 0) {
    return {
      ok: false,
      message: "File kosong atau tidak berisi tabel transaksi.",
    };
  }

  // Deteksi baris header secara dinamis: cari baris yang memuat 'TANGGAL' dan 'KODE AGEN'
  let headerRowIdx = -1;
  const colIndex: Record<string, number> = {};

  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const normalizedCells = row.map(normalizeHeaderCell);
    const hasTanggal = normalizedCells.includes("TANGGAL");
    const hasKodeAgen = normalizedCells.includes("KODE AGEN");
    if (hasTanggal && hasKodeAgen) {
      headerRowIdx = i;
      normalizedCells.forEach((colName, idx) => {
        if (colName && colIndex[colName] === undefined) {
          colIndex[colName] = idx;
        }
      });
      break;
    }
  }

  if (headerRowIdx === -1) {
    return {
      ok: false,
      message:
        "Header kolom tidak ditemukan. Pastikan file memiliki kolom TANGGAL, KODE AGEN, CASE, KETERANGAN, DEBET, KREDIT, dan SALDO.",
    };
  }

  // Ambil judul laporan dari baris di atas header (jika ada)
  let reportTitle: string | null = null;
  if (headerRowIdx > 0) {
    const titleCandidate = matrix[0]
      ?.map((c) => String(c ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (titleCandidate) {
      reportTitle = titleCandidate;
    }
  }

  const getCell = (row: unknown[], colName: string): string => {
    const idx = colIndex[colName];
    if (idx === undefined) return "";
    return String(row[idx] ?? "").trim();
  };

  const dataRows = matrix.slice(headerRowIdx + 1);
  const seenHashesInFile = new Set<string>();
  const previewRows: ParsedImportPreviewRow[] = [];

  for (let offset = 0; offset < dataRows.length; offset++) {
    const rawRow = dataRows[offset];
    if (!Array.isArray(rawRow)) continue;

    const rawTanggal = getCell(rawRow, "TANGGAL");
    const rawAgentCode = getCell(rawRow, "KODE AGEN");
    const rawCase = getCell(rawRow, "CASE");
    const rawDescription = getCell(rawRow, "KETERANGAN");
    const rawDebit = getCell(rawRow, "DEBET");
    const rawCredit = getCell(rawRow, "KREDIT");
    const rawFileBalance = getCell(rawRow, "SALDO");

    // Lewati baris yang benar-benar kosong
    if (
      !rawTanggal &&
      !rawAgentCode &&
      !rawCase &&
      !rawDescription &&
      !rawDebit &&
      !rawCredit
    ) {
      continue;
    }

    const sheetRowNumber = headerRowIdx + 2 + offset;
    const rowErrors: string[] = [];

    const parsedDate = parseFlexibleImportDate(rawTanggal);
    if (!parsedDate) {
      rowErrors.push("TANGGAL kosong atau format tidak dikenali.");
    }

    const agentLookup = rawAgentCode
      ? agentsByCode.get(rawAgentCode.toUpperCase())
      : undefined;
    if (!rawAgentCode) {
      rowErrors.push("KODE AGEN kosong.");
    } else if (!agentLookup) {
      rowErrors.push(`KODE AGEN '${rawAgentCode}' belum terdaftar di sistem.`);
    } else if (!agentLookup.isActive) {
      rowErrors.push(`Agen '${rawAgentCode}' berstatus nonaktif.`);
    }

    const parsedDebit = parseRupiahToBigInt(rawDebit, {
      allowNegative: false,
      emptyAsZero: true,
    });
    const parsedCredit = parseRupiahToBigInt(rawCredit, {
      allowNegative: false,
      emptyAsZero: true,
    });

    if (parsedDebit === null) {
      rowErrors.push("Kolom DEBET bukan angka bulat valid atau bernilai negatif.");
    }
    if (parsedCredit === null) {
      rowErrors.push("Kolom KREDIT bukan angka bulat valid atau bernilai negatif.");
    }

    const parsedFileBalance =
      rawFileBalance !== ""
        ? parseRupiahToBigInt(rawFileBalance, {
            allowNegative: true,
            emptyAsZero: false,
          })
        : null;

    if (rowErrors.length > 0 || !parsedDate || !agentLookup || parsedDebit === null || parsedCredit === null) {
      previewRows.push({
        rowNumber: sheetRowNumber,
        rawTanggal,
        rawAgentCode,
        rawCase,
        rawDescription,
        rawDebit,
        rawCredit,
        rawFileBalance,
        status: "error",
        messages: rowErrors,
      });
      continue;
    }

    const ingestCheck = validateAndPrepareTransaction({
      agentId: agentLookup.id,
      transactionAt: parsedDate,
      case: rawCase,
      description: rawDescription,
      debit: parsedDebit,
      credit: parsedCredit,
      source: "import",
    });

    if (!ingestCheck.ok) {
      previewRows.push({
        rowNumber: sheetRowNumber,
        rawTanggal,
        rawAgentCode,
        rawCase,
        rawDescription,
        rawDebit,
        rawCredit,
        rawFileBalance,
        status: "error",
        messages: ingestCheck.errors,
      });
      continue;
    }

    const { data } = ingestCheck;

    // Deteksi duplikat (F-08 > validation.duplicates)
    if (
      existingDedupHashes.has(data.dedupHash) ||
      seenHashesInFile.has(data.dedupHash)
    ) {
      previewRows.push({
        rowNumber: sheetRowNumber,
        rawTanggal,
        rawAgentCode: agentLookup.code,
        rawCase: data.case,
        rawDescription: data.description,
        rawDebit: parsedDebit.toString(),
        rawCredit: parsedCredit.toString(),
        rawFileBalance,
        status: "duplicate",
        messages: ["Duplikat, dilewati."],
      });
      continue;
    }

    seenHashesInFile.add(data.dedupHash);

    const warnings = [...data.warnings];
    previewRows.push({
      rowNumber: sheetRowNumber,
      rawTanggal,
      rawAgentCode: agentLookup.code,
      rawCase: data.case,
      rawDescription: data.description,
      rawDebit: parsedDebit.toString(),
      rawCredit: parsedCredit.toString(),
      rawFileBalance,
      status: warnings.length > 0 ? "warning" : "valid",
      messages: warnings,
      prepared: {
        agentId: agentLookup.id,
        agentCode: agentLookup.code,
        transactionAtIso: parsedDate.toISOString(),
        case: data.case,
        description: data.description,
        debit: parsedDebit.toString(),
        credit: parsedCredit.toString(),
        projectedBalance: "0", // Dihitung pada langkah verifikasi saldo kronologis di bawah
        fileBalance:
          parsedFileBalance !== null ? parsedFileBalance.toString() : null,
        derivedOpeningBalance: null,
        orderNumber: data.refs.orderNumber,
        bookingCode: data.refs.bookingCode,
        groupKey: data.refs.groupKey,
        dedupHash: data.dedupHash,
      },
    });
  }

  // Hitung proyeksi saldo per agen untuk baris yang akan diimpor & verifikasi terhadap kolom SALDO file
  const importableByAgent = new Map<string, ParsedImportPreviewRow[]>();
  for (const row of previewRows) {
    if (!row.prepared) continue;
    const list = importableByAgent.get(row.prepared.agentId) ?? [];
    list.push(row);
    importableByAgent.set(row.prepared.agentId, list);
  }

  for (const [, agentRows] of importableByAgent) {
    const firstPrepared = agentRows[0]?.prepared;
    if (!firstPrepared) continue;
    const agentInfo = agentsByCode.get(firstPrepared.agentCode.toUpperCase());
    if (!agentInfo) continue;

    // Urutkan kronologis (di file contoh baris terbaru di atas, sehingga kita balik urutannya saat tie di detik yang sama)
    const indexed = agentRows.map((r, idx) => ({
      row: r,
      // Karena file terbaru di atas, baris dengan nomor baris lebih besar adalah lebih awal
      syntheticOrder: BigInt(1_000_000 - idx),
      transactionAt: new Date(r.prepared!.transactionAtIso),
      debit: BigInt(r.prepared!.debit),
      credit: BigInt(r.prepared!.credit),
    }));

    indexed.sort((a, b) => {
      const diff = a.transactionAt.getTime() - b.transactionAt.getTime();
      if (diff !== 0) return diff;
      return a.syntheticOrder < b.syntheticOrder ? -1 : 1;
    });

    let baseBalance = agentInfo.currentBalance;
    let derivedOpening: bigint | null = null;

    if (!agentInfo.hasPriorTransactions) {
      const earliest = indexed[0];
      const earliestFileBal = earliest.row.prepared?.fileBalance;
      if (earliestFileBal !== null && earliestFileBal !== undefined) {
        derivedOpening = deriveOpeningBalance({
          fileBalance: BigInt(earliestFileBal),
          credit: earliest.credit,
          debit: earliest.debit,
        });
        baseBalance = derivedOpening;
      } else {
        baseBalance = agentInfo.openingBalance;
      }
    }

    const computed = calculateAgentRunningBalances(
      baseBalance,
      indexed.map((entry, chronoIdx) => ({
        id: BigInt(chronoIdx + 1),
        agentId: agentInfo.id,
        transactionAt: entry.transactionAt,
        debit: entry.debit,
        credit: entry.credit,
      }))
    );

    const isBackdatedAgainstExisting =
      agentInfo.hasPriorTransactions &&
      agentInfo.latestTransactionAt !== null &&
      indexed[0].transactionAt.getTime() <
        agentInfo.latestTransactionAt.getTime();

    computed.forEach(({ balanceAfter }, chronoIdx) => {
      const targetRow = indexed[chronoIdx].row;
      if (!targetRow.prepared) return;

      targetRow.prepared.projectedBalance = balanceAfter.toString();
      if (chronoIdx === 0 && derivedOpening !== null) {
        targetRow.prepared.derivedOpeningBalance = derivedOpening.toString();
      }

      if (
        !isBackdatedAgainstExisting &&
        targetRow.prepared.fileBalance !== null
      ) {
        const fileBal = BigInt(targetRow.prepared.fileBalance);
        if (fileBal !== balanceAfter) {
          const diff = balanceAfter - fileBal;
          const absDiff = diff < 0n ? -diff : diff;
          targetRow.messages.push(
            `Saldo di file (${formatRupiah(fileBal)}) berbeda dengan hitungan sistem (${formatRupiah(balanceAfter)}), selisih ${formatRupiah(absDiff)}.`
          );
          targetRow.status = "warning";
        }
      }
    });
  }

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

  for (const r of previewRows) {
    if (r.status === "valid") {
      validCount += 1;
    } else if (r.status === "warning") {
      validCount += 1;
      warningCount += 1;
    } else if (r.status === "error") {
      errorCount += 1;
    } else if (r.status === "duplicate") {
      duplicateCount += 1;
    }
  }

  return {
    ok: true,
    reportTitle,
    totalRows: previewRows.length,
    validRows: validCount,
    warningRows: warningCount,
    errorRows: errorCount,
    duplicateRows: duplicateCount,
    rows: previewRows,
  };
}

