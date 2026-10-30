import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireApiSession,
  verifySameOriginWrite,
} from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: z
      .string()
      .min(6, "Password baru minimal 6 karakter.")
      .max(100, "Password baru maksimal 100 karakter."),
    confirmPassword: z.string().min(1, "Konfirmasi password baru wajib diisi."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password baru tidak sama.",
  });

export async function POST(request: NextRequest) {
  const csrfError = verifySameOriginWrite(request);
  if (csrfError) return csrfError;

  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Format permintaan tidak valid." },
      { status: 400 }
    );
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Data tidak valid.",
        fields,
      },
      { status: 400 }
    );
  }

  const repo = getDataRepository();
  const dbUser = await repo.findUserById(auth.session.id);
  if (!dbUser || !dbUser.isActive) {
    return NextResponse.json(
      { code: "USER_NOT_FOUND", message: "Akun pengguna tidak ditemukan." },
      { status: 404 }
    );
  }

  const matches = await bcrypt.compare(
    parsed.data.currentPassword,
    dbUser.passwordHash
  );
  if (!matches) {
    return NextResponse.json(
      {
        code: "INVALID_CURRENT_PASSWORD",
        message: "Password saat ini tidak sesuai.",
        fields: { currentPassword: "Password saat ini tidak sesuai." },
      },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await repo.updateUser({
    id: dbUser.id,
    passwordHash,
    actorUserId: dbUser.id,
  });

  await repo.writeAuditLog({
    userId: dbUser.id,
    action: "change_own_password",
    entity: "users",
    entityId: dbUser.id,
  });

  return NextResponse.json({ ok: true });
}

