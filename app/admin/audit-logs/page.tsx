import { Suspense } from "react";
import { AuditLogsViewer } from "@/components/admin/audit-logs-viewer";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AdminTablePageSkeleton } from "@/components/ui/skeleton";
import { requireAdminSessionUser } from "@/lib/auth/guards";
import { getDataRepository } from "@/lib/db/repository";

export default function AdminAuditLogsPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Log Audit">
          <AdminTablePageSkeleton rows={8} />
        </AppShellSkeleton>
      }
    >
      <AdminAuditLogsDynamicContent />
    </Suspense>
  );
}

async function AdminAuditLogsDynamicContent() {
  const [session, logs] = await Promise.all([
    requireAdminSessionUser("/admin/audit-logs"),
    getDataRepository().listAuditLogs(200),
  ]);

  return (
    <AppShell session={session} pageTitle="Log Audit">
      <AuditLogsViewer initialLogs={logs} />
    </AppShell>
  );
}

