import { Suspense } from "react";
import { ImportWorkspace } from "@/components/imports/import-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminSessionUser } from "@/lib/auth/guards";
import { getDataRepository } from "@/lib/db/repository";

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Impor Excel / CSV">
          <div className="space-y-6">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </AppShellSkeleton>
      }
    >
      <ImportDynamicContent />
    </Suspense>
  );
}

async function ImportDynamicContent() {
  const [session, batches] = await Promise.all([
    requireAdminSessionUser("/import"),
    getDataRepository().listImportBatches(),
  ]);

  return (
    <AppShell session={session} pageTitle="Impor Excel / CSV">
      <ImportWorkspace initialHistory={batches} />
    </AppShell>
  );
}

