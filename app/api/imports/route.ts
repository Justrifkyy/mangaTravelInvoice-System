import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireApiAdmin } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";

export async function GET() {
  try {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;

    const repo = getDataRepository();
    const batches = await repo.listImportBatches();
    return NextResponse.json({ batches });
  } catch (err) {
    return handleApiError(err, { context: "GET /api/imports" });
  }
}
