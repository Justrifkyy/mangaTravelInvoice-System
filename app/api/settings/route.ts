import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin, requireApiSession } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";

export async function GET() {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const repo = getDataRepository();
  const settings = await repo.getSettings();
  return NextResponse.json({ settings });
}

const settingsSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "Nama usaha wajib diisi.")
    .max(120, "Nama usaha maksimal 120 karakter."),
  logoPath: z
    .string()
    .trim()
    .min(1)
    .max(3_000_000, "Ukuran data logo terlalu besar (maksimum 2 MB).")
    .refine(
      (val) =>
        val.startsWith("/") ||
        val.startsWith("data:image/png;base64,") ||
        val.startsWith("data:image/jpeg;base64,") ||
        val.startsWith("data:image/webp;base64,") ||
        val.startsWith("data:image/svg+xml;base64,"),
      "Format logo harus berupa gambar PNG, JPEG, WebP, atau SVG."
    ),
  contactPersonName: z
    .string()
    .trim()
    .min(1, "Nama contact person wajib diisi.")
    .max(120, "Nama contact person maksimal 120 karakter."),
  contactPersonPhone: z
    .string()
    .trim()
    .min(5, "Nomor telepon contact person wajib diisi.")
    .max(40, "Nomor telepon terlalu panjang."),
  address: z.string().trim().max(300).nullable().optional(),
  receiptFooterNote: z.string().trim().max(240).nullable().optional(),
  showBalanceOnReceipt: z.boolean(),
  showThermalLogo: z.boolean(),
});

export async function PUT(request: NextRequest) {
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

  const parsed = settingsSchema.safeParse(body);
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
          parsed.error.issues[0]?.message ?? "Data pengaturan tidak valid.",
        fields,
      },
      { status: 400 }
    );
  }

  const repo = getDataRepository();
  const updated = await repo.updateSettings(
    {
      businessName: parsed.data.businessName,
      logoPath: parsed.data.logoPath,
      contactPersonName: parsed.data.contactPersonName,
      contactPersonPhone: parsed.data.contactPersonPhone,
      address: parsed.data.address?.trim() || null,
      receiptFooterNote: parsed.data.receiptFooterNote?.trim() || null,
      showBalanceOnReceipt: parsed.data.showBalanceOnReceipt,
      showThermalLogo: parsed.data.showThermalLogo,
    },
    auth.session.id
  );

  revalidatePath("/settings");
  revalidatePath("/transactions");

  return NextResponse.json({ settings: updated });
}

