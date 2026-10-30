import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { SettingsForm } from "@/components/settings/settings-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminSessionUser } from "@/lib/auth/guards";
import { getDataRepository } from "@/lib/db/repository";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Pengaturan">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Skeleton className="h-[580px] w-full max-w-[620px] rounded-lg" />
            <Skeleton className="h-80 w-full lg:w-[340px] rounded-lg" />
          </div>
        </AppShellSkeleton>
      }
    >
      <SettingsDynamicContent />
    </Suspense>
  );
}

async function SettingsDynamicContent() {
  const [session, settings] = await Promise.all([
    requireAdminSessionUser("/settings"),
    getDataRepository().getSettings(),
  ]);

  return (
    <AppShell session={session} pageTitle="Pengaturan">
      <SettingsForm initialSettings={settings} />
    </AppShell>
  );
}

