import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-guards";

export async function GET() {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  return NextResponse.json({ user: auth.session });
}

