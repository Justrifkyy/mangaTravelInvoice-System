import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { ReceiptPageSkeleton } from "@/components/ui/skeleton";

export default function TransactionReceiptLoading() {
  return (
    <AppShellSkeleton pageTitle="Cetak Struk">
      <ReceiptPageSkeleton />
    </AppShellSkeleton>
  );
}

