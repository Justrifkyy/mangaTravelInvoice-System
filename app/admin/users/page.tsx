import { Suspense } from "react";
import { toSafeUserDto } from "@/app/api/admin/users/route";
import { UsersManager } from "@/components/admin/users-manager";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AdminTablePageSkeleton } from "@/components/ui/skeleton";
import { requireAdminSessionUser } from "@/lib/auth/guards";
import { getDataRepository } from "@/lib/db/repository";

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Kelola Pengguna">
          <AdminTablePageSkeleton />
        </AppShellSkeleton>
      }
    >
      <AdminUsersDynamicContent />
    </Suspense>
  );
}

async function AdminUsersDynamicContent() {
  const repo = getDataRepository();
  const [session, rawUsers, agents] = await Promise.all([
    requireAdminSessionUser("/admin/users"),
    repo.listUsers(),
    repo.listAgents(),
  ]);

  return (
    <AppShell session={session} pageTitle="Kelola Pengguna">
      <UsersManager
        currentUserId={session.id}
        initialUsers={rawUsers.map(toSafeUserDto)}
        agents={agents}
      />
    </AppShell>
  );
}

