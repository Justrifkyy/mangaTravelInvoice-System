/**
 * Penanganan error terpusat untuk seluruh Internal API Route Handlers.
 * Menjamin semua respons galat berbentuk JSON konsisten, ramah pengguna (id-ID),
 * dan tidak pernah membocorkan detail SQL/stack trace internal ke klien.
 */

import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
  errorId?: string;
}

export class AppApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(options: {
    code: string;
    message: string;
    status?: number;
    fields?: Record<string, string>;
  }) {
    super(options.message);
    this.name = "AppApiError";
    this.code = options.code;
    this.status = options.status ?? 400;
    this.fields = options.fields;
  }
}

export function zodErrorToApiResponse(
  zodError: ZodError,
  fallbackMessage = "Data yang dikirim tidak valid. Periksa kembali isian Anda."
): NextResponse<ApiErrorBody> {
  const fields: Record<string, string> = {};
  for (const issue of zodError.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fields[key]) {
      fields[key] = issue.message;
    }
  }

  return NextResponse.json(
    {
      code: "VALIDATION_ERROR",
      message: zodError.issues[0]?.message ?? fallbackMessage,
      fields,
    },
    { status: 400 }
  );
}

const PRISMA_CONNECTION_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1008",
  "P1017",
]);

function extractErrorCode(err: unknown): string | null {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
  ) {
    return (err as { code: string }).code;
  }
  return null;
}

function isDatabaseConnectivityError(err: unknown): boolean {
  const code = extractErrorCode(err);
  if (code && PRISMA_CONNECTION_CODES.has(code)) {
    return true;
  }
  if (!(err instanceof Error)) return false;
  if (err.name === "PrismaClientInitializationError") return true;

  const msg = err.message.toLowerCase();
  return (
    msg.includes("can't reach database server") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("connection refused") ||
    msg.includes("server has closed the connection")
  );
}

/**
 * Mengecek apakah Error merupakan pesan aturan bisnis yang sengaja dilempar
 * dari lapisan repositori/domain (berbahasa Indonesia & tidak mengandung jejak teknis).
 */
function isSafeDomainErrorMessage(err: unknown): err is Error {
  if (!(err instanceof Error)) return false;
  if (err.name.startsWith("PrismaClient")) return false;

  const msg = err.message.trim();
  if (!msg || msg.length > 220 || msg.includes("\n")) return false;

  const technicalPatterns = [
    /prisma\./i,
    /invocation/i,
    /sqlstate/i,
    /foreign key constraint/i,
    /unique constraint failed/i,
    /syntax error/i,
    /at\s+[A-Za-z0-9_$.]+\s*\(/,
    /ECONN|ENOTFOUND|EACCES|ENOENT/,
  ];

  return !technicalPatterns.some((pattern) => pattern.test(msg));
}

function generateErrorId(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `ERR-${ts}${rand}`;
}

export function handleApiError(
  err: unknown,
  options?: {
    context?: string;
    defaultCode?: string;
    fallbackMessage?: string;
  }
): NextResponse<ApiErrorBody> {
  // Jangan pernah menangkap exception kontrol internal Next.js 16 (cookies/headers prerender bailout, redirect, forbidden, notFound)
  unstable_rethrow(err);

  if (err instanceof AppApiError) {
    return NextResponse.json(
      {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
      { status: err.status }
    );
  }

  if (isDatabaseConnectivityError(err)) {
    const errorId = generateErrorId();
    console.error(
      `[${errorId}] Database connectivity failure${options?.context ? ` (${options.context})` : ""}:`,
      err
    );
    return NextResponse.json(
      {
        code: "DATABASE_UNAVAILABLE",
        message:
          "Layanan database sedang tidak terjangkau. Pastikan MySQL aktif lalu coba lagi.",
        errorId,
      },
      { status: 503 }
    );
  }

  const prismaCode = extractErrorCode(err);
  if (prismaCode === "P2002") {
    return NextResponse.json(
      {
        code: "DUPLICATE_ENTRY",
        message: "Data dengan kode atau identitas tersebut sudah terdaftar.",
      },
      { status: 409 }
    );
  }

  if (prismaCode === "P2025") {
    return NextResponse.json(
      {
        code: "NOT_FOUND",
        message: "Data yang diminta tidak ditemukan atau telah dihapus.",
      },
      { status: 404 }
    );
  }

  if (isSafeDomainErrorMessage(err)) {
    const lower = err.message.toLowerCase();
    const isNotFound = lower.includes("tidak ditemukan");
    const isDuplicate =
      lower.includes("sudah digunakan") ||
      lower.includes("sudah terdaftar") ||
      lower.includes("duplikat");

    return NextResponse.json(
      {
        code: isNotFound
          ? "NOT_FOUND"
          : isDuplicate
            ? "CONFLICT"
            : (options?.defaultCode ?? "DOMAIN_ERROR"),
        message: err.message,
      },
      { status: isNotFound ? 404 : isDuplicate ? 409 : 400 }
    );
  }

  const errorId = generateErrorId();
  console.error(
    `[${errorId}] Unexpected API error${options?.context ? ` (${options.context})` : ""}:`,
    err
  );

  const baseMessage =
    options?.fallbackMessage ?? "Terjadi kesalahan pada server. Silakan coba lagi.";

  return NextResponse.json(
    {
      code: "INTERNAL_SERVER_ERROR",
      message: `${baseMessage} (Ref: ${errorId})`,
      errorId,
    },
    { status: 500 }
  );
}

