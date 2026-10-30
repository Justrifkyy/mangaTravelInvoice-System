import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { TransactionsPageSkeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <AppShellSkeleton pageTitle="Transaksi">
      <TransactionsPageSkeleton />
    </AppShellSkeleton>
  );
}

