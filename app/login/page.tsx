import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getOptionalSessionUser } from "@/lib/auth/guards";
import { getDataRepository } from "@/lib/db/repository";

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-surface-app px-4 py-12">
      {/* Dekorasi belah ketupat lime transparan sangat halus (design-spec.json > layout.login_page) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rotate-45 rounded-xl bg-accent-lime-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-28 h-96 w-96 rotate-45 rounded-xl bg-primary-600/5"
      />

      <div className="relative z-10 flex w-full justify-center">
        <Suspense
          fallback={
            <div className="w-full max-w-[400px] rounded-lg border border-surface-border bg-surface-card p-8 shadow-card space-y-5">
              <Skeleton className="mx-auto h-14 w-40" />
              <Skeleton className="mx-auto h-7 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          }
        >
          <LoginDynamicContent searchParamsPromise={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

async function LoginDynamicContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ user }, rawSearchParams, settings] = await Promise.all([
    getOptionalSessionUser(),
    searchParamsPromise,
    getDataRepository().getSettings(),
  ]);

  if (user) {
    redirect("/transactions");
  }

  const expired = firstParam(rawSearchParams.expired) === "1";
  const nextPath = firstParam(rawSearchParams.next) || "/transactions";

  return (
    <LoginForm
      expired={expired}
      nextPath={nextPath}
      businessName={settings.businessName}
      logoPath={settings.logoPath}
    />
  );
}

