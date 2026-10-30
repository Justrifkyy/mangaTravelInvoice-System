import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AdminTablePageSkeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <AppShellSkeleton pageTitle="Administrasi">
      <AdminTablePageSkeleton />
    </AppShellSkeleton>
  );
}

