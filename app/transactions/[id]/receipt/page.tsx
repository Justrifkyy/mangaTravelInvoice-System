import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { ReceiptWorkspace } from "@/components/receipts/receipt-workspace";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ReceiptPageSkeleton } from "@/components/ui/skeleton";
import { requireSessionUser } from "@/lib/auth/guards";
import type { ReceiptMode, ReceiptPaperSize } from "@/lib/domain/receipt";
import {
  getReceiptForSession,
  getTransactionDetailForSession,
} from "@/lib/services/transaction-service";

export default function TransactionReceiptPage(
  props: PageProps<"/transactions/[id]/receipt">
) {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton pageTitle="Cetak Struk">
          <ReceiptPageSkeleton />
        </AppShellSkeleton>
      }
    >
      <ReceiptDynamicContent
        paramsPromise={props.params}
        searchParamsPromise={props.searchParams}
      />
    </Suspense>
  );
}

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

async function ReceiptDynamicContent({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
  searchParamsPromise: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [{ id }, rawSearchParams] = await Promise.all([
    paramsPromise,
    searchParamsPromise,
  ]);
  const session = await requireSessionUser(`/transactions/${id}/receipt`);

  const detail = await getTransactionDetailForSession(session, id);

  if (!detail) {
    return (
      <AppShell session={session} pageTitle="Cetak Struk">
        <EmptyState
          variant="no_results"
          title="Transaksi tidak ditemukan."
          action={
            <Button asChild variant="secondary">
              <Link href="/transactions">Kembali ke Transaksi</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const rawMode = firstParam(rawSearchParams.mode).toLowerCase();
  const requestedMode: ReceiptMode =
    rawMode === "group"
      ? "group"
      : rawMode === "individual"
        ? "individual"
        : "individual";

  const rawSize = firstParam(rawSearchParams.size).toLowerCase();
  const initialSizeFromUrl: ReceiptPaperSize | null =
    rawSize === "58" || rawSize === "80" || rawSize === "a4" ? rawSize : null;

  const receiptResult = await getReceiptForSession({
    session,
    transactionId: id,
    mode: requestedMode,
    printedAt: new Date(),
  });

  return (
    <AppShell
      session={session}
      pageTitle="Cetak Struk"
      breadcrumb={
        <nav aria-label="Breadcrumb" className="text-xs text-neutral-500">
          <Link href="/transactions" className="hover:text-primary-600">
            Transaksi
          </Link>{" "}
          /{" "}
          <Link
            href={`/transactions?detail=${id}`}
            className="hover:text-primary-600"
          >
            #{id}
          </Link>{" "}
          / <span>Struk</span>
        </nav>
      }
    >
      {!receiptResult.ok ? (
        <EmptyState
          variant="no_results"
          title={
            receiptResult.code === "GROUP_NOT_FOUND"
              ? "Grup transaksi tidak ditemukan."
              : receiptResult.message
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="primary">
                <Link href={`/transactions/${id}/receipt?mode=individual`}>
                  Buka Struk Individual
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/transactions">Kembali</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <ReceiptWorkspace
          transactionId={id}
          hasGroupKey={Boolean(detail.transaction.groupKey)}
          activeMode={requestedMode}
          initialSizeFromUrl={initialSizeFromUrl}
          receipt={receiptResult.receipt}
        />
      )}
    </AppShell>
  );
}
