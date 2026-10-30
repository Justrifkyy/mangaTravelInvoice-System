import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import {
  TransactionDetailBody,
  TransactionDetailFooterActions,
} from "@/components/transactions/transaction-detail-drawer";
import { CaseBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSessionUser } from "@/lib/auth/guards";
import { getTransactionDetailForSession } from "@/lib/services/transaction-service";

export default function TransactionDetailPage(
  props: PageProps<"/transactions/[id]">
) {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Detail Transaksi">
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        </AppShellSkeleton>
      }
    >
      <TransactionDetailDynamicContent paramsPromise={props.params} />
    </Suspense>
  );
}

async function TransactionDetailDynamicContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = await paramsPromise;
  const session = await requireSessionUser(`/transactions/${id}`);
  const detail = await getTransactionDetailForSession(session, id);

  return (
    <AppShell
      session={session}
      pageTitle="Detail Transaksi"
      breadcrumb={
        <nav aria-label="Breadcrumb" className="text-xs text-neutral-500">
          <Link href="/transactions" className="hover:text-primary-600">
            Transaksi
          </Link>{" "}
          / <span>#{id}</span>
        </nav>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/transactions">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali ke Daftar Transaksi
            </Link>
          </Button>
        </div>

        {!detail ? (
          <EmptyState
            variant="no_results"
            title="Transaksi tidak ditemukan."
            description="Transaksi yang Anda cari tidak ada atau berada di luar lingkup akses Anda."
            action={
              <Button asChild variant="secondary">
                <Link href="/transactions">Ke Daftar Transaksi</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-card">
            <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
              <h2 className="text-lg font-semibold text-neutral-900">
                Transaksi #{detail.transaction.id}
              </h2>
              <CaseBadge caseValue={detail.transaction.case} />
            </div>

            <div className="p-6">
              <TransactionDetailBody detail={detail} />
            </div>

            <div className="border-t border-surface-border bg-neutral-25 px-6 py-4">
              <TransactionDetailFooterActions
                transaction={detail.transaction}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
