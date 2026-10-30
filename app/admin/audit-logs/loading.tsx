import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AdminTablePageSkeleton } from "@/components/ui/skeleton";

export default function AdminAuditLogsLoading() {
  return (
    <AppShellSkeleton pageTitle="Log Audit Sistem">
      <AdminTablePageSkeleton rows={8} />
    </AppShellSkeleton>
  );
}

