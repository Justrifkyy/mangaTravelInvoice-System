import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { ImportPageSkeleton } from "@/components/ui/skeleton";

export default function ImportLoading() {
  return (
    <AppShellSkeleton pageTitle="Impor Excel / CSV">
      <ImportPageSkeleton />
    </AppShellSkeleton>
  );
}

