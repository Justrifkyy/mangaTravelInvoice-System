import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { SettingsPageSkeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <AppShellSkeleton pageTitle="Pengaturan">
      <SettingsPageSkeleton />
    </AppShellSkeleton>
  );
}

