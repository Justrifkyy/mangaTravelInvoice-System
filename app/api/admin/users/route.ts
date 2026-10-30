import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";
import type { AppUserRecord } from "@/lib/db/types";

export type SafeUserDto = Omit<AppUserRecord, "passwordHash">;

export function toSafeUserDto(user: AppUserRecord): SafeUserDto {
  const { passwordHash: _omitted, ...safe } = user;
  void _omitted;
  return safe;
}

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  const repo = getDataRepository();
  const users = await repo.listUsers();
  return NextResponse.json({ users: users.map(toSafeUserDto) });
}

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(50, "Username maksimal 50 karakter.")
    .regex(
      /^[A-Za-z0-9_.-]+$/,
      "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung."
    ),
  name: z
    .string()
    .trim()
    .min(1, "Nama lengkap wajib diisi.")
    .max(120, "Nama lengkap maksimal 120 karakter."),
  password: z
    .string()
    .min(6, "Password minimal 6 karakter.")
    .max(100, "Password maksimal 100 karakter."),
  role: z.enum(["admin", "agent"]),
  agentId: z.string().trim().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin(request);
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

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ?? "Data pengguna tidak valid.",
        fields,
      },
      { status: 400 }
    );
  }

  const resolvedAgentId =
    parsed.data.role === "agent"
      ? (parsed.data.agentId?.trim() || null)
      : null;

  if (parsed.data.role === "agent" && !resolvedAgentId) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "Pengguna dengan peran Agen wajib ditautkan ke agen.",
        fields: { agentId: "Pilih agen yang akan ditautkan." },
      },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const repo = getDataRepository();
    const created = await repo.createUser({
      username: parsed.data.username.toLowerCase(),
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
      agentId: resolvedAgentId,
      actorUserId: auth.session.id,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/agents");

    return NextResponse.json({ user: toSafeUserDto(created) }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan. Silakan coba lagi.";
    return NextResponse.json(
      { code: "CREATE_USER_FAILED", message },
      { status: 400 }
    );
  }
}

const updateUserSchema = z.object({
  id: z.string().trim().min(1, "ID pengguna wajib diisi."),
  name: z
    .string()
    .trim()
    .min(1, "Nama lengkap wajib diisi.")
    .max(120, "Nama lengkap maksimal 120 karakter.")
    .optional(),
  role: z.enum(["admin", "agent"]).optional(),
  agentId: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
  newPassword: z
    .string()
    .min(6, "Password baru minimal 6 karakter.")
    .max(100, "Password baru maksimal 100 karakter.")
    .optional(),
});

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAdmin(request);
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

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ?? "Data pengguna tidak valid.",
        fields,
      },
      { status: 400 }
    );
  }

  if (parsed.data.id === auth.session.id && parsed.data.isActive === false) {
    return NextResponse.json(
      {
        code: "SELF_DEACTIVATION_FORBIDDEN",
        message: "Admin tidak boleh menonaktifkan dirinya sendiri.",
      },
      { status: 400 }
    );
  }

  if (parsed.data.id === auth.session.id && parsed.data.role === "agent") {
    return NextResponse.json(
      {
        code: "SELF_ROLE_DEMOTION_FORBIDDEN",
        message: "Admin tidak boleh menurunkan peran akunnya sendiri.",
      },
      { status: 400 }
    );
  }

  try {
    const passwordHash = parsed.data.newPassword
      ? await bcrypt.hash(parsed.data.newPassword, 10)
      : undefined;

    const repo = getDataRepository();
    const updated = await repo.updateUser({
      id: parsed.data.id,
      name: parsed.data.name,
      role: parsed.data.role,
      agentId:
        parsed.data.role === "admin"
          ? null
          : parsed.data.agentId !== undefined
            ? (parsed.data.agentId?.trim() || null)
            : undefined,
      isActive: parsed.data.isActive,
      passwordHash,
      actorUserId: auth.session.id,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/agents");

    return NextResponse.json({ user: toSafeUserDto(updated) });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan. Silakan coba lagi.";
    return NextResponse.json(
      { code: "UPDATE_USER_FAILED", message },
      { status: 400 }
    );
  }
}

