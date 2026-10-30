import { Suspense } from "react";
import { redirect } from "next/navigation";
import { toSafeUserDto } from "@/app/api/admin/users/route";
import { AccountProfile } from "@/components/account/account-profile";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AccountPageSkeleton } from "@/components/ui/skeleton";
import { requireSessionUser } from "@/lib/auth/guards";
import { getDataRepository } from "@/lib/db/repository";

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Profil & Keamanan Akun">
          <AccountPageSkeleton />
        </AppShellSkeleton>
      }
    >
      <AccountDynamicContent />
    </Suspense>
  );
}

async function AccountDynamicContent() {
  const session = await requireSessionUser("/account");
  const repo = getDataRepository();
  const dbUser = await repo.findUserById(session.id);

  if (!dbUser) {
    redirect("/login");
  }

  const linkedAgent = dbUser.agentId
    ? await repo.findAgentById(dbUser.agentId)
    : null;

  return (
    <AppShell session={session} pageTitle="Profil & Keamanan Akun">
      <AccountProfile user={toSafeUserDto(dbUser)} linkedAgent={linkedAgent} />
    </AppShell>
  );
}

