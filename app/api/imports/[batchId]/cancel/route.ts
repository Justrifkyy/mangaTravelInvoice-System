import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/imports/[batchId]/cancel">
) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;
  try {
    const repo = getDataRepository();
    await repo.cancelImportBatch(batchId, auth.session.id);

    revalidatePath("/import");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan. Silakan coba lagi.";
    return NextResponse.json(
      { code: "CANCEL_FAILED", message },
      { status: 400 }
    );
  }
}

