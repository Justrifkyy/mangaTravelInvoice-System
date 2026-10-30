import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  AppApiError,
  handleApiError,
  zodErrorToApiResponse,
} from "@/lib/api/api-error";

describe("Centralized API Error Handling (lib/api/api-error.ts)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mengonversi ZodError menjadi HTTP 400 dengan peta field pertama per kolom", async () => {
    const schema = z.object({
      username: z.string().min(3, "Username minimal 3 karakter."),
      password: z.string().min(6, "Password minimal 6 karakter."),
    });

    const parsed = schema.safeParse({ username: "ab", password: "123" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const res = zodErrorToApiResponse(parsed.error);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({
      code: "VALIDATION_ERROR",
      message: "Username minimal 3 karakter.",
      fields: {
        username: "Username minimal 3 karakter.",
        password: "Password minimal 6 karakter.",
      },
    });
  });

  it("menghormati status, code, dan fields dari AppApiError", async () => {
    const err = new AppApiError({
      code: "CUSTOM_FORBIDDEN",
      message: "Tindakan tidak diizinkan.",
      status: 403,
      fields: { role: "Peran tidak mencukupi." },
    });

    const res = handleApiError(err);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      code: "CUSTOM_FORBIDDEN",
      message: "Tindakan tidak diizinkan.",
      fields: { role: "Peran tidak mencukupi." },
    });
  });

  it("memetakan gangguan koneksi Prisma/MySQL (P1001 / ECONNREFUSED) ke HTTP 503 DATABASE_UNAVAILABLE", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const prismaConnErr = Object.assign(
      new Error("Can't reach database server at `localhost:3306`"),
      { code: "P1001" }
    );

    const res = handleApiError(prismaConnErr, {
      context: "GET /api/transactions",
    });
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.code).toBe("DATABASE_UNAVAILABLE");
    expect(body.message).toContain("Layanan database sedang tidak terjangkau");
    expect(body.message).not.toContain("localhost:3306");
    expect(body.errorId).toMatch(/^ERR-[A-Z0-9]+$/);
  });

  it("memetakan pelanggaran unik Prisma P2002 ke HTTP 409 dan P2025 ke HTTP 404", async () => {
    const dupErr = Object.assign(
      new Error("Unique constraint failed on the constraint: `users_username_key`"),
      { code: "P2002" }
    );
    const dupRes = handleApiError(dupErr);
    expect(dupRes.status).toBe(409);
    const dupBody = await dupRes.json();
    expect(dupBody.code).toBe("DUPLICATE_ENTRY");
    expect(dupBody.message).not.toContain("users_username_key");

    const notFoundErr = Object.assign(new Error("Record to update not found."), {
      code: "P2025",
    });
    const nfRes = handleApiError(notFoundErr);
    expect(nfRes.status).toBe(404);
    await expect(nfRes.json()).resolves.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("meneruskan pesan error aturan bisnis domain berbahasa Indonesia yang aman dengan status semantik", async () => {
    const conflictRes = handleApiError(
      new Error("Kode agen JKT-37287 sudah terdaftar."),
      { defaultCode: "CREATE_AGENT_FAILED" }
    );
    expect(conflictRes.status).toBe(409);
    await expect(conflictRes.json()).resolves.toEqual({
      code: "CONFLICT",
      message: "Kode agen JKT-37287 sudah terdaftar.",
    });

    const notFoundRes = handleApiError(new Error("Batch impor tidak ditemukan."));
    expect(notFoundRes.status).toBe(404);
    await expect(notFoundRes.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Batch impor tidak ditemukan.",
    });

    const domainRes = handleApiError(
      new Error("Agen nonaktif tidak dapat menerima transaksi baru."),
      { defaultCode: "CREATE_FAILED" }
    );
    expect(domainRes.status).toBe(400);
    await expect(domainRes.json()).resolves.toEqual({
      code: "CREATE_FAILED",
      message: "Agen nonaktif tidak dapat menerima transaksi baru.",
    });
  });

  it("menyembunyikan detail teknis SQL/Prisma/stack trace pada HTTP 500 dengan kode referensi ERR-", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const rawSqlError = new Error(
      "Invalid `prisma.transaction.findMany()` invocation:\nRaw query failed. Code: `1064`. SQLSTATE[42000]: Syntax error near 'SELECT * FROM users'"
    );
    rawSqlError.name = "PrismaClientKnownRequestError";

    const res = handleApiError(rawSqlError, {
      context: "GET /api/transactions",
    });
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.errorId).toMatch(/^ERR-[A-Z0-9]+$/);
    expect(body.message).toContain(body.errorId);
    expect(body.message).not.toContain("prisma.transaction");
    expect(body.message).not.toContain("SQLSTATE");
    expect(body.message).not.toContain("SELECT * FROM users");
  });
});

