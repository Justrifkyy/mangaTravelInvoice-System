import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { ManualTransactionPageSkeleton } from "@/components/ui/skeleton";

export default function NewTransactionLoading() {
  return (
    <AppShellSkeleton pageTitle="Input Manual Transaksi">
      <ManualTransactionPageSkeleton />
    </AppShellSkeleton>
  );
}

