import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AdminTablePageSkeleton } from "@/components/ui/skeleton";

export default function AdminUsersLoading() {
  return (
    <AppShellSkeleton pageTitle="Kelola Pengguna">
      <AdminTablePageSkeleton />
    </AppShellSkeleton>
  );
}

