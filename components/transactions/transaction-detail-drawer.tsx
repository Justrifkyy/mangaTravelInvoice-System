"use client";

import Link from "next/link";
import { ArrowRight, Printer, Users } from "lucide-react";
import { CaseBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTimeTable, formatRupiah } from "@/lib/domain/format";
import type { ReceiptTransactionRecord } from "@/lib/domain/receipt";
import type { TransactionDetailResult } from "@/lib/services/transaction-service";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<ReceiptTransactionRecord["source"], string> = {
  import: "Impor Excel",
  manual: "Input Manual",
  api: "Integrasi API",
};

export function TransactionDetailBody({
  detail,
  onSelectRelated,
}: {
  detail: TransactionDetailResult;
  onSelectRelated?: (relatedId: string) => void;
}) {
  const { transaction, relatedTransactions } = detail;
  const debit = BigInt(transaction.debit);
  const credit = BigInt(transaction.credit);
  const balance = BigInt(transaction.balance);

  return (
    <div className="space-y-6">
      {/* Blok nominal utama */}
      <div className="rounded-lg border border-surface-border bg-neutral-25 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-neutral-500">
            {debit > 0n ? "Nominal Debet (Keluar)" : "Nominal Kredit (Masuk)"}
          </span>
          <CaseBadge caseValue={transaction.case} />
        </div>
        <p
          className={cn(
            "tabular-nums mt-1.5 text-2xl font-bold leading-8",
            debit > 0n ? "text-debit-text" : "text-credit-text"
          )}
        >
          {debit > 0n
            ? formatRupiah(debit, { signDisplay: "debit" })
            : formatRupiah(credit, { signDisplay: "credit" })}
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-2.5 text-xs">
          <span className="text-neutral-500">Saldo setelah transaksi</span>
          <span
            className={cn(
              "tabular-nums font-semibold",
              balance < 0n ? "text-debit-text" : "text-neutral-900"
            )}
          >
            {formatRupiah(balance)}
          </span>
        </div>
      </div>

      {/* Pasangan Label - Nilai */}
      <dl className="divide-y divide-surface-border text-sm">
        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-neutral-500">ID Transaksi</dt>
          <dd className="font-mono font-semibold text-neutral-900">
            #{transaction.id}
          </dd>
        </div>

        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-neutral-500">Tanggal &amp; Jam</dt>
          <dd className="tabular-nums font-medium text-neutral-900">
            {formatDateTimeTable(transaction.transactionAt)}
          </dd>
        </div>

        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-neutral-500">Kode Agen</dt>
          <dd className="font-medium text-neutral-900">
            {transaction.agentCode}
          </dd>
        </div>

        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-neutral-500">Debet</dt>
          <dd
            className={cn(
              "tabular-nums font-medium",
              debit > 0n ? "text-debit-text" : "text-neutral-400"
            )}
          >
            {formatRupiah(debit, { emptyAsDash: true })}
          </dd>
        </div>

        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-neutral-500">Kredit</dt>
          <dd
            className={cn(
              "tabular-nums font-medium",
              credit > 0n ? "text-credit-text" : "text-neutral-400"
            )}
          >
            {formatRupiah(credit, { emptyAsDash: true })}
          </dd>
        </div>

        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-neutral-500">No. Pesanan</dt>
          <dd className="font-mono font-medium text-neutral-900">
            {transaction.orderNumber ?? "—"}
          </dd>
        </div>

        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-neutral-500">Kode Booking</dt>
          <dd className="font-mono font-medium text-neutral-900">
            {transaction.bookingCode ?? "—"}
          </dd>
        </div>

        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-neutral-500">Sumber Data</dt>
          <dd className="font-medium text-neutral-900">
            {SOURCE_LABELS[transaction.source]}
          </dd>
        </div>

        <div className="py-3">
          <dt className="mb-1.5 text-neutral-500">Keterangan Lengkap</dt>
          <dd className="rounded-md bg-neutral-25 p-3 text-sm leading-relaxed text-neutral-900 break-words">
            {transaction.description}
          </dd>
        </div>
      </dl>

      {/* Blok Transaksi Terkait (group_key sama) */}
      {transaction.groupKey && (
        <section className="space-y-2.5 border-t border-surface-border pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">
              Transaksi Terkait (No. Pesanan {transaction.groupKey})
            </h3>
            <span className="text-xs text-neutral-500">
              {relatedTransactions.length} lainnya
            </span>
          </div>

          {relatedTransactions.length === 0 ? (
            <p className="rounded-md border border-warning-bg bg-warning-bg px-3 py-2 text-xs text-warning-text">
              Belum ada pasangan transaksi lain untuk nomor pesanan ini.
            </p>
          ) : (
            <ul className="space-y-2">
              {relatedTransactions.map((rel) => {
                const relDebit = BigInt(rel.debit);
                const relCredit = BigInt(rel.credit);
                return (
                  <li key={rel.id}>
                    {onSelectRelated ? (
                      <button
                        type="button"
                        onClick={() => onSelectRelated(rel.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-surface-border bg-neutral-0 p-3 text-left transition-colors hover:border-primary-200 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <CaseBadge caseValue={rel.case} />
                            <span className="font-mono text-xs text-neutral-500">
                              #{rel.id}
                            </span>
                          </div>
                          <p className="truncate text-xs text-neutral-700">
                            {rel.description}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              "tabular-nums text-xs font-semibold",
                              relDebit > 0n
                                ? "text-debit-text"
                                : "text-credit-text"
                            )}
                          >
                            {relDebit > 0n
                              ? formatRupiah(relDebit, { signDisplay: "debit" })
                              : formatRupiah(relCredit, {
                                  signDisplay: "credit",
                                })}
                          </span>
                          <ArrowRight
                            className="h-4 w-4 text-neutral-400"
                            aria-hidden="true"
                          />
                        </div>
                      </button>
                    ) : (
                      <Link
                        href={`/transactions/${rel.id}`}
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-surface-border bg-neutral-0 p-3 text-left transition-colors hover:border-primary-200 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <CaseBadge caseValue={rel.case} />
                            <span className="font-mono text-xs text-neutral-500">
                              #{rel.id}
                            </span>
                          </div>
                          <p className="truncate text-xs text-neutral-700">
                            {rel.description}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "tabular-nums shrink-0 text-xs font-semibold",
                            relDebit > 0n
                              ? "text-debit-text"
                              : "text-credit-text"
                          )}
                        >
                          {relDebit > 0n
                            ? formatRupiah(relDebit, { signDisplay: "debit" })
                            : formatRupiah(relCredit, {
                                signDisplay: "credit",
                              })}
                        </span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export function TransactionDetailFooterActions({
  transaction,
}: {
  transaction: ReceiptTransactionRecord;
}) {
  const hasGroup = Boolean(transaction.groupKey);

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
      <Button
        asChild
        variant={hasGroup ? "secondary" : "primary"}
        className="w-full sm:w-auto"
      >
        <Link href={`/transactions/${transaction.id}/receipt?mode=individual`}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          Cetak Struk Individual
        </Link>
      </Button>

      {/* Sembunyikan tombol Cetak Struk Grup jika transaksi tidak punya group_key (F-06 > deposit_rule) */}
      {hasGroup && (
        <Button asChild variant="primary" className="w-full sm:w-auto">
          <Link href={`/transactions/${transaction.id}/receipt?mode=group`}>
            <Users className="h-4 w-4" aria-hidden="true" />
            Cetak Struk Grup
          </Link>
        </Button>
      )}
    </div>
  );
}

export interface TransactionDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: TransactionDetailResult | null;
  notFoundId?: string | null;
  onSelectRelated: (relatedId: string) => void;
}

export function TransactionDetailDrawer({
  open,
  onOpenChange,
  detail,
  notFoundId,
  onSelectRelated,
}: TransactionDetailDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Detail Transaksi"
      headerBadge={
        detail ? (
          <CaseBadge caseValue={detail.transaction.case} />
        ) : undefined
      }
      footer={
        detail ? (
          <TransactionDetailFooterActions transaction={detail.transaction} />
        ) : undefined
      }
    >
      {detail ? (
        <TransactionDetailBody
          detail={detail}
          onSelectRelated={onSelectRelated}
        />
      ) : notFoundId ? (
        <EmptyState
          variant="no_results"
          title="Transaksi tidak ditemukan."
          description="Transaksi yang Anda pilih tidak tersedia atau berada di luar lingkup akses Anda."
        />
      ) : null}
    </Drawer>
  );
}

