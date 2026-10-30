import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireApiAdmin } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/imports/[batchId]/commit">
) {
  try {
    const auth = await requireApiAdmin(request);
    if (!auth.ok) return auth.response;

    const { batchId } = await context.params;
    const repo = getDataRepository();
    const summary = await repo.commitImportBatch(batchId, auth.session.id);

    revalidatePath("/transactions");
    revalidatePath("/import");
    revalidatePath("/admin/agents");

    return NextResponse.json(summary);
  } catch (err) {
    return handleApiError(err, {
      context: "POST /api/imports/[batchId]/commit",
      defaultCode: "COMMIT_FAILED",
    });
  }
}
