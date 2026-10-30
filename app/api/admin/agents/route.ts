import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, zodErrorToApiResponse } from "@/lib/api/api-error";
import { requireApiAdmin } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";
import { parseRupiahToBigInt } from "@/lib/domain/money";

export async function GET() {
  try {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;

    const repo = getDataRepository();
    const agents = await repo.listAgents();
    return NextResponse.json({ agents });
  } catch (err) {
    return handleApiError(err, { context: "GET /api/admin/agents" });
  }
}

const createAgentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kode agen minimal 2 karakter.")
    .max(32, "Kode agen maksimal 32 karakter.")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Kode agen hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_)."
    ),
  name: z
    .string()
    .trim()
    .min(1, "Nama agen wajib diisi.")
    .max(120, "Nama agen maksimal 120 karakter."),
  openingBalance: z.union([z.string(), z.number()]).optional(),
});

export async function POST(request: NextRequest) {
  try {
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

    const parsed = createAgentSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorToApiResponse(parsed.error, "Data agen tidak valid.");
    }

    const openingBig =
      parsed.data.openingBalance !== undefined &&
      String(parsed.data.openingBalance).trim() !== ""
        ? parseRupiahToBigInt(parsed.data.openingBalance, {
            allowNegative: true,
            emptyAsZero: true,
          })
        : 0n;

    if (openingBig === null) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Saldo awal harus berupa angka bulat Rupiah yang valid.",
          fields: {
            openingBalance:
              "Saldo awal harus berupa angka bulat Rupiah yang valid.",
          },
        },
        { status: 400 }
      );
    }

    const repo = getDataRepository();
    const agent = await repo.createAgent({
      code: parsed.data.code.toUpperCase(),
      name: parsed.data.name,
      openingBalance: openingBig,
      actorUserId: auth.session.id,
    });

    revalidatePath("/admin/agents");
    revalidatePath("/admin/users");
    revalidatePath("/transactions");
    revalidatePath("/transactions/new");

    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    return handleApiError(err, {
      context: "POST /api/admin/agents",
      defaultCode: "CREATE_AGENT_FAILED",
    });
  }
}

const updateAgentSchema = z.object({
  id: z.string().trim().min(1, "ID agen wajib diisi."),
  code: z
    .string()
    .trim()
    .min(2, "Kode agen minimal 2 karakter.")
    .max(32, "Kode agen maksimal 32 karakter.")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Kode agen hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_)."
    )
    .optional(),
  name: z
    .string()
    .trim()
    .min(1, "Nama agen wajib diisi.")
    .max(120, "Nama agen maksimal 120 karakter.")
    .optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
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

    const parsed = updateAgentSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorToApiResponse(parsed.error, "Data agen tidak valid.");
    }

    const repo = getDataRepository();
    const agent = await repo.updateAgent({
      id: parsed.data.id,
      code: parsed.data.code?.toUpperCase(),
      name: parsed.data.name,
      isActive: parsed.data.isActive,
      actorUserId: auth.session.id,
    });

    revalidatePath("/admin/agents");
    revalidatePath("/admin/users");
    revalidatePath("/transactions");
    revalidatePath("/transactions/new");

    return NextResponse.json({ agent });
  } catch (err) {
    return handleApiError(err, {
      context: "PATCH /api/admin/agents",
      defaultCode: "UPDATE_AGENT_FAILED",
    });
  }
}
