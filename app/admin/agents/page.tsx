import { Suspense } from "react";
import { AgentsManager } from "@/components/admin/agents-manager";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AdminTablePageSkeleton } from "@/components/ui/skeleton";
import { requireAdminSessionUser } from "@/lib/auth/guards";
import { getDataRepository } from "@/lib/db/repository";

export default function AdminAgentsPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Kelola Agen">
          <AdminTablePageSkeleton />
        </AppShellSkeleton>
      }
    >
      <AdminAgentsDynamicContent />
    </Suspense>
  );
}

async function AdminAgentsDynamicContent() {
  const [session, agents] = await Promise.all([
    requireAdminSessionUser("/admin/agents"),
    getDataRepository().listAgents(),
  ]);

  return (
    <AppShell session={session} pageTitle="Kelola Agen">
      <AgentsManager initialAgents={agents} />
    </AppShell>
  );
}

