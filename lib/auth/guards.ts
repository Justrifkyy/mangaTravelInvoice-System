/**
 * Penjaga otentikasi & otorisasi di sisi server (Server Components, Server Actions, Route Handlers).
 * Sumber: docs/app-spec.json > roles.security_rule & features.F-01
 */

import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { getDataRepository } from "@/lib/db/repository";
import type { SessionUser } from "@/lib/db/types";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session-token";

export async function getOptionalSessionUser(): Promise<{
  user: SessionUser | null;
  expired: boolean;
}> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return { user: null, expired: false };
  }

  const verified = await verifySessionToken(rawToken);
  if (verified.status === "expired") {
    return { user: null, expired: true };
  }
  if (verified.status !== "valid") {
    return { user: null, expired: false };
  }

  const repo = getDataRepository();
  const dbUser = await repo.findUserById(verified.payload.userId);
  if (!dbUser || !dbUser.isActive) {
    return { user: null, expired: false };
  }

  return {
    user: {
      id: dbUser.id,
      username: dbUser.username,
      name: dbUser.name,
      role: dbUser.role,
      agentId: dbUser.agentId,
      agentCode: dbUser.agentCode,
    },
    expired: false,
  };
}

export async function requireSessionUser(
  returnPath?: string
): Promise<SessionUser> {
  const { user, expired } = await getOptionalSessionUser();
  if (!user) {
    const params = new URLSearchParams();
    if (expired) params.set("expired", "1");
    if (returnPath && returnPath.startsWith("/")) {
      params.set("next", returnPath);
    }
    const qs = params.toString();
    redirect(qs ? `/login?${qs}` : "/login");
  }
  return user;
}

export async function requireAdminSessionUser(
  returnPath?: string
): Promise<SessionUser> {
  const user = await requireSessionUser(returnPath);
  if (user.role !== "admin") {
    forbidden();
  }
  return user;
}

