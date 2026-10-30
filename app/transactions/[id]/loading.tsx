import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { Skeleton, TransactionDetailSkeleton } from "@/components/ui/skeleton";

export default function TransactionDetailLoading() {
  return (
    <AppShellSkeleton pageTitle="Detail Transaksi">
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-44" />
        <div className="rounded-lg border border-surface-border bg-surface-card p-6 shadow-card">
          <TransactionDetailSkeleton />
        </div>
      </div>
    </AppShellSkeleton>
  );
}

