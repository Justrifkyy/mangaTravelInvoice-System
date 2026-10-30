import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-guards";
import { getDataRepository } from "@/lib/db/repository";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  const repo = getDataRepository();
  const batches = await repo.listImportBatches();
  return NextResponse.json({ batches });
}

