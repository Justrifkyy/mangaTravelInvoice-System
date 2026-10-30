import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminSessionUser } from "@/lib/auth/guards";

export default function AdminIndexPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Administrasi">
          <Skeleton className="h-64 w-full rounded-lg" />
        </AppShellSkeleton>
      }
    >
      <AdminIndexRedirect />
    </Suspense>
  );
}

async function AdminIndexRedirect(): Promise<never> {
  await requireAdminSessionUser("/admin");
  return redirect("/admin/users");
}
