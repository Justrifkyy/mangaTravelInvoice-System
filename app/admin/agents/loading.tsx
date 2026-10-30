import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AdminTablePageSkeleton } from "@/components/ui/skeleton";

export default function AdminAgentsLoading() {
  return (
    <AppShellSkeleton pageTitle="Kelola Agen">
      <AdminTablePageSkeleton />
    </AppShellSkeleton>
  );
}

