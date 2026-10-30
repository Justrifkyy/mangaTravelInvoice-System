import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireApiAdmin } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";
import {
  MAX_IMPORT_FILE_BYTES,
  parseAndValidateImportBuffer,
  type ImportAgentLookup,
} from "@/lib/domain/excel-parser";

const ALLOWED_EXTENSIONS = [".xls", ".xlsx", ".csv"];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    if (!auth.ok) return auth.response;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          code: "INVALID_MULTIPART",
          message: "Permintaan unggah file tidak valid.",
        },
        { status: 400 }
      );
    }

    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        {
          code: "FILE_REQUIRED",
          message: "Pilih file .xls, .xlsx, atau .csv terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    const lowerName = fileEntry.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      return NextResponse.json(
        {
          code: "UNSUPPORTED_FILE_TYPE",
          message:
            "Format berkas tidak didukung. Gunakan file dengan ekstensi .xls, .xlsx, atau .csv.",
        },
        { status: 400 }
      );
    }

    if (fileEntry.size === 0) {
      return NextResponse.json(
        {
          code: "EMPTY_FILE",
          message: "Berkas yang dipilih kosong (0 byte).",
        },
        { status: 400 }
      );
    }

    if (fileEntry.size > MAX_IMPORT_FILE_BYTES) {
      return NextResponse.json(
        {
          code: "FILE_TOO_LARGE",
          message: "Ukuran file melebihi batas maksimum 10 MB.",
        },
        { status: 400 }
      );
    }

    const arrayBuf = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const repo = getDataRepository();
    const [agents, allTransactions, existingDedupHashes] = await Promise.all([
      repo.listAgents(),
      repo.listAllTransactionsForScope(auth.session),
      repo.listExistingDedupHashes(),
    ]);

    const latestTxByAgentId = new Map<string, Date>();
    for (const tx of allTransactions) {
      const dt = new Date(tx.transactionAt);
      const prev = latestTxByAgentId.get(tx.agentId);
      if (!prev || dt.getTime() > prev.getTime()) {
        latestTxByAgentId.set(tx.agentId, dt);
      }
    }

    const agentsByCode = new Map<string, ImportAgentLookup>();
    for (const a of agents) {
      agentsByCode.set(a.code.toUpperCase(), {
        id: a.id,
        code: a.code,
        name: a.name,
        isActive: a.isActive,
        openingBalance: BigInt(a.openingBalance),
        currentBalance: BigInt(a.currentBalance),
        hasPriorTransactions: a.transactionCount > 0,
        latestTransactionAt: latestTxByAgentId.get(a.id) ?? null,
      });
    }

    const outcome = parseAndValidateImportBuffer({
      buffer,
      fileName: fileEntry.name,
      agentsByCode,
      existingDedupHashes,
    });

    if (!outcome.ok) {
      return NextResponse.json(
        {
          code: "IMPORT_PARSE_ERROR",
          message: outcome.message,
        },
        { status: 400 }
      );
    }

    const batch = await repo.createImportBatchPreview({
      fileName: fileEntry.name,
      uploadedBy: auth.session.id,
      reportTitle: outcome.reportTitle,
      totalRows: outcome.totalRows,
      validRows: outcome.validRows,
      warningRows: outcome.warningRows,
      errorRows: outcome.errorRows,
      duplicateRows: outcome.duplicateRows,
      rows: outcome.rows,
    });

    return NextResponse.json({ batch });
  } catch (err) {
    return handleApiError(err, { context: "POST /api/imports/preview" });
  }
}
