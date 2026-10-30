import { Suspense } from "react";
import { connection } from "next/server";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { ManualTransactionForm } from "@/components/transactions/manual-transaction-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminSessionUser } from "@/lib/auth/guards";
import { getDataRepository } from "@/lib/db/repository";
import { DEFAULT_APP_TIMEZONE } from "@/lib/domain/format";

export default function NewTransactionPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Input Manual Transaksi">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Skeleton className="h-[520px] w-full max-w-[560px] rounded-lg" />
            <Skeleton className="h-72 w-full lg:w-[380px] rounded-lg" />
          </div>
        </AppShellSkeleton>
      }
    >
      <NewTransactionDynamicContent />
    </Suspense>
  );
}

function formatNowJakartaForInput(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DEFAULT_APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hour = map.hour === "24" ? "00" : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}:${map.second}`;
}

async function NewTransactionDynamicContent() {
  await connection();
  const [session, agents] = await Promise.all([
    requireAdminSessionUser("/transactions/new"),
    getDataRepository().listAgents(),
  ]);

  const defaultJakartaDateTimeLocal = formatNowJakartaForInput(new Date());

  return (
    <AppShell session={session} pageTitle="Input Manual Transaksi">
      <ManualTransactionForm
        agents={agents}
        defaultJakartaDateTimeLocal={defaultJakartaDateTimeLocal}
      />
    </AppShell>
  );
}

