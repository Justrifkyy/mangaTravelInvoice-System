import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AccountPageSkeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <AppShellSkeleton pageTitle="Akun Saya">
      <AccountPageSkeleton />
    </AppShellSkeleton>
  );
}

