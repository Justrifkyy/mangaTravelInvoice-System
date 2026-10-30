import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { TransactionsClient } from "@/components/transactions/transactions-client";
import { TransactionsPageSkeleton } from "@/components/ui/skeleton";
import { requireSessionUser } from "@/lib/auth/guards";
import {
  getTransactionDetailForSession,
  listAvailableAgentsForSession,
  queryTransactionsForSession,
} from "@/lib/services/transaction-service";
import { parseTransactionSearchParams } from "@/lib/validation/transaction-query";

export default function TransactionsPage(props: PageProps<"/transactions">) {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Transaksi">
          <TransactionsPageSkeleton />
        </AppShellSkeleton>
      }
    >
      <TransactionsDynamicContent searchParamsPromise={props.searchParams} />
    </Suspense>
  );
}

async function TransactionsDynamicContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, rawSearchParams] = await Promise.all([
    requireSessionUser("/transactions"),
    searchParamsPromise,
  ]);

  const parsed = parseTransactionSearchParams(rawSearchParams);
  const [result, availableAgents, initialDetail] = await Promise.all([
    queryTransactionsForSession(session, parsed),
    listAvailableAgentsForSession(session),
    parsed.query.detailId
      ? getTransactionDetailForSession(session, parsed.query.detailId)
      : Promise.resolve(null),
  ]);

  return (
    <AppShell session={session} pageTitle="Transaksi">
      <TransactionsClient
        session={session}
        availableAgents={availableAgents}
        query={parsed.query}
        activeFilterCount={parsed.activeFilterCount}
        result={result}
        initialDetail={initialDetail}
      />
    </AppShell>
  );
}
