import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingsPageSkeleton } from "@/components/ui/skeleton";
import { requireAdminSessionUser } from "@/lib/auth/guards";
import { getDataRepository } from "@/lib/db/repository";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Pengaturan">
          <SettingsPageSkeleton />
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

