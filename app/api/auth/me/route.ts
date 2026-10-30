import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/api-error";
import { requireApiSession } from "@/lib/auth/api-guards";

export async function GET() {
  try {
    const auth = await requireApiSession();
    if (!auth.ok) return auth.response;

    return NextResponse.json({ user: auth.session });
  } catch (err) {
    return handleApiError(err, { context: "GET /api/auth/me" });
  }
}
