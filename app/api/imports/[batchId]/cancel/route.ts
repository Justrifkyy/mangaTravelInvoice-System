import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireApiAdmin } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/imports/[batchId]/cancel">
) {
  try {
    const auth = await requireApiAdmin(request);
    if (!auth.ok) return auth.response;

    const { batchId } = await context.params;
    const repo = getDataRepository();
    await repo.cancelImportBatch(batchId, auth.session.id);

    revalidatePath("/import");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, {
      context: "POST /api/imports/[batchId]/cancel",
      defaultCode: "CANCEL_FAILED",
    });
  }
}
