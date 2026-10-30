"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Hash,
  Loader2,
  PlusCircle,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { FilterChips } from "@/components/transactions/filter-chips";
import { FilterDrawer } from "@/components/transactions/filter-drawer";
import { TransactionDetailDrawer } from "@/components/transactions/transaction-detail-drawer";
import { CaseBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IndeterminateProgressBar } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import type { AppAgentRecord, SessionUser } from "@/lib/db/types";
import { formatDateTimeTable, formatRupiah } from "@/lib/domain/format";
import type {
  TransactionDetailResult,
  TransactionListResult,
} from "@/lib/services/transaction-service";
import { cn } from "@/lib/utils";
import {
  PAGE_SIZE_OPTIONS,
  serializeTransactionQuery,
  type PageSizeOption,
  type TransactionFilterQuery,
} from "@/lib/validation/transaction-query";

export interface TransactionsClientProps {
  session: SessionUser;
  availableAgents: AppAgentRecord[];
  query: TransactionFilterQuery;
  activeFilterCount: number;
  result: TransactionListResult;
  initialDetail: TransactionDetailResult | null;
}

export function TransactionsClient({
  session,
  availableAgents,
  query,
  activeFilterCount,
  result,
  initialDetail,
}: TransactionsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [isPending, startTransition] = React.useTransition();

  const [searchText, setSearchText] = React.useState(query.q);
  const [prevQueryQ, setPrevQueryQ] = React.useState(query.q);
  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false);

  // Optimistic detailId agar Drawer langsung terbuka dengan Skeleton tanpa jeda jaringan
  const [optimisticDetailId, setOptimisticDetailId] = React.useState<
    string | null
  >(null);
  const [prevDetailId, setPrevDetailId] = React.useState(query.detailId);

  // Sinkronkan input pencarian saat URL query berubah (mis. tombol Back/Forward)
  if (prevQueryQ !== query.q) {
    setPrevQueryQ(query.q);
    setSearchText(query.q);
  }

  if (prevDetailId !== query.detailId) {
    setPrevDetailId(query.detailId);
    setOptimisticDetailId(null);
  }

  const navigateWithPatch = React.useCallback(
    (
      patch: Partial<TransactionFilterQuery>,
      options?: { replace?: boolean }
    ) => {
      const merged: TransactionFilterQuery = {
        ...query,
        ...patch,
      };
      const qs = serializeTransactionQuery(merged);
      const url = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        if (options?.replace) {
          router.replace(url, { scroll: false });
        } else {
          router.push(url, { scroll: false });
        }
      });
    },
    [pathname, query, router]
  );

  // Debounce 300ms untuk pencarian (F-04 > rules: "Debounce input 300 ms; tombol Enter juga memicu pencarian")
  React.useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed === query.q) return;

    const timer = window.setTimeout(() => {
      navigateWithPatch({ q: trimmed, page: 1 }, { replace: true });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchText, query.q, navigateWithPatch]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      navigateWithPatch({ q: searchText.trim(), page: 1 });
    }
  }

  function handleClearSearch() {
    setSearchText("");
    navigateWithPatch({ q: "", page: 1 });
  }

  function handleClearAllFilters() {
    navigateWithPatch({
      from: "",
      to: "",
      cases: [],
      type: "all",
      agentCode: "",
      amountMin: "",
      amountMax: "",
      balanceMin: "",
      balanceMax: "",
      desc: "",
      page: 1,
    });
  }

  function handleRefreshData() {
    startTransition(() => {
      router.refresh();
    });
    toast.info("Data transaksi diperbarui.");
  }

  function handleOpenDetail(txId: string) {
    setOptimisticDetailId(txId);
    navigateWithPatch({ detailId: txId }, { replace: false });
  }

  function handleCloseDetail(open: boolean) {
    if (!open) {
      setOptimisticDetailId("");
      navigateWithPatch({ detailId: "" }, { replace: true });
    }
  }

  function toggleDateSort() {
    navigateWithPatch({
      sort: query.sort === "date_desc" ? "date_asc" : "date_desc",
      page: 1,
    });
  }

  const effectiveFilterCount =
    activeFilterCount -
    (session.role === "agent" && query.agentCode ? 1 : 0);

  const isAdmin = session.role === "admin";
  const isSearchDebouncing = searchText.trim() !== query.q;

  const activeDetailId =
    optimisticDetailId !== null ? optimisticDetailId : query.detailId;
  const detailDrawerOpen = Boolean(activeDetailId);
  const matchingDetail =
    initialDetail && initialDetail.transaction.id === activeDetailId
      ? initialDetail
      : null;
  const isDetailLoading =
    detailDrawerOpen &&
    !matchingDetail &&
    (isPending || optimisticDetailId !== null);

  // Indikator pemuatan tabel (saat memfilter, mengurutkan, atau berpindah halaman)
  const isTableTransitioning = isPending && optimisticDetailId === null;

  return (
    <div className="space-y-6">
      {/* 1. Baris StatCard x4 (F-02 > summary_cards) */}
      <section
        aria-label="Ringkasan transaksi"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Saldo Terakhir"
          value={
            result.summary.latestBalance !== null
              ? formatRupiah(result.summary.latestBalance)
              : "—"
          }
          tone={
            result.summary.latestBalance !== null &&
            BigInt(result.summary.latestBalance) < 0n
              ? "debit"
              : "default"
          }
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Total Kredit"
          value={formatRupiah(result.summary.totalCredit)}
          tone="credit"
          icon={<ArrowDownRight className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Total Debet"
          value={formatRupiah(result.summary.totalDebit)}
          tone="debit"
          icon={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Jumlah Transaksi"
          value={new Intl.NumberFormat("id-ID").format(
            result.summary.totalCount
          )}
          icon={<Hash className="h-4 w-4" aria-hidden="true" />}
        />
      </section>

      {/* 2. Toolbar: SearchInput + Tombol Filter + Muat Ulang */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[420px]">
          {isSearchDebouncing || isTableTransitioning ? (
            <Loader2
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary-600"
              aria-hidden="true"
            />
          ) : (
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
          )}
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Cari transaksi"
            placeholder="Cari ID, No. Pesanan, kode booking, atau keterangan"
            className="h-10 w-full rounded-md border border-neutral-200 bg-surface-card pl-9 pr-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchText.length > 0 && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Kosongkan pencarian"
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={handleRefreshData}
            disabled={isPending}
            title="Muat ulang data transaksi"
            aria-label="Muat ulang data transaksi"
            className="px-3"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                isTableTransitioning && "animate-spin text-primary-600"
              )}
              aria-hidden="true"
            />
            <span className="hidden lg:inline">Muat Ulang</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setFilterDrawerOpen(true)}
            className="flex-1 sm:flex-none"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>Filter</span>
            {effectiveFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-neutral-0">
                {effectiveFilterCount}
              </span>
            )}
          </Button>

          {isAdmin && (
            <>
              <Button
                asChild
                variant="secondary"
                className="flex-1 sm:flex-none"
              >
                <Link href="/import">
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  <span>Impor</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="primary"
                className="w-full sm:w-auto"
              >
                <Link href="/transactions/new">
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  <span>Input Manual</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </section>

      {/* 3. Baris FilterChip (hanya jika ada filter aktif) */}
      <FilterChips
        role={session.role}
        query={query}
        onRemoveChip={(patch) => navigateWithPatch(patch)}
        onClearAll={handleClearAllFilters}
      />

      {/* 4. Tabel / Kartu Mobile / EmptyState */}
      {result.emptyReason === "validation_error" && result.validationError ? (
        <EmptyState
          variant="error"
          title={result.validationError}
          description="Periksa kembali rentang tanggal pada panel filter."
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFilterDrawerOpen(true)}
            >
              Ubah Filter
            </Button>
          }
        />
      ) : result.emptyReason === "no_transactions" ? (
        <EmptyState variant="no_data" title="Belum ada transaksi." />
      ) : result.emptyReason === "filter_no_result" ? (
        <EmptyState
          variant="no_results"
          title="Data tidak ditemukan. Coba ubah atau hapus filter."
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={handleClearAllFilters}
            >
              Hapus semua
            </Button>
          }
        />
      ) : result.emptyReason === "search_no_result" ? (
        <EmptyState
          variant="no_results"
          title="Transaksi tidak ditemukan. Coba kata kunci lain."
          action={
            query.q ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleClearSearch}
              >
                Kosongkan pencarian
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* DataTable Desktop (>= 768px) */}
          <div className="hidden overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-card md:block">
            {isTableTransitioning && (
              <IndeterminateProgressBar label="Memperbarui daftar transaksi..." />
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-surface-border bg-surface-table-header">
                  <tr>
                    <th
                      scope="col"
                      className="w-[72px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      ID
                    </th>
                    <th
                      scope="col"
                      className="w-[184px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      <button
                        type="button"
                        onClick={toggleDateSort}
                        className="inline-flex items-center gap-1 uppercase hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-xs cursor-pointer"
                      >
                        <span>Tanggal</span>
                        {query.sort === "date_desc" ? (
                          <ArrowDown
                            className="h-3.5 w-3.5 text-primary-600"
                            aria-label="Urut terbaru ke terlama"
                          />
                        ) : (
                          <ArrowUp
                            className="h-3.5 w-3.5 text-primary-600"
                            aria-label="Urut terlama ke terbaru"
                          />
                        )}
                      </button>
                    </th>
                    {isAdmin && (
                      <th
                        scope="col"
                        className="w-[120px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
                      >
                        Kode Agen
                      </th>
                    )}
                    <th
                      scope="col"
                      className="w-[120px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      Case
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      Keterangan
                    </th>
                    <th
                      scope="col"
                      className="w-[144px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      Debet
                    </th>
                    <th
                      scope="col"
                      className="w-[144px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      Kredit
                    </th>
                    <th
                      scope="col"
                      className="w-[154px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      Saldo
                    </th>
                    <th
                      scope="col"
                      className="w-[64px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={cn(
                    "divide-y divide-surface-border transition-opacity",
                    isTableTransitioning && "opacity-65"
                  )}
                >
                  {result.items.map((tx) => {
                    const debit = BigInt(tx.debit);
                    const credit = BigInt(tx.credit);
                    const balance = BigInt(tx.balance);
                    const defaultReceiptMode = tx.groupKey
                      ? "group"
                      : "individual";

                    return (
                      <tr
                        key={tx.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Lihat detail transaksi ID ${tx.id}`}
                        onClick={() => handleOpenDetail(tx.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleOpenDetail(tx.id);
                          }
                        }}
                        className="h-[52px] cursor-pointer transition-colors hover:bg-surface-table-hover focus-visible:bg-surface-table-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium text-neutral-500">
                          {tx.id}
                        </td>
                        <td className="tabular-nums whitespace-nowrap px-4 py-3 text-neutral-900">
                          {formatDateTimeTable(tx.transactionAt)}
                        </td>
                        {isAdmin && (
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-700">
                            {tx.agentCode}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-3">
                          <CaseBadge caseValue={tx.case} />
                        </td>
                        <td
                          className="max-w-md px-4 py-3 text-neutral-900"
                          title={tx.description}
                        >
                          <p className="line-clamp-2 leading-5">
                            {tx.description}
                          </p>
                        </td>
                        <td
                          className={cn(
                            "tabular-nums whitespace-nowrap px-4 py-3 text-right font-medium",
                            debit > 0n ? "text-debit-text" : "text-neutral-400"
                          )}
                        >
                          {formatRupiah(debit, { emptyAsDash: true })}
                        </td>
                        <td
                          className={cn(
                            "tabular-nums whitespace-nowrap px-4 py-3 text-right font-medium",
                            credit > 0n
                              ? "text-credit-text"
                              : "text-neutral-400"
                          )}
                        >
                          {formatRupiah(credit, { emptyAsDash: true })}
                        </td>
                        <td
                          className={cn(
                            "tabular-nums whitespace-nowrap px-4 py-3 text-right font-semibold",
                            balance < 0n
                              ? "text-debit-text"
                              : "text-neutral-900"
                          )}
                        >
                          {formatRupiah(balance)}
                        </td>
                        <td
                          className="px-3 py-2 text-right"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/transactions/${tx.id}/receipt?mode=${defaultReceiptMode}`}
                            aria-label="Cetak struk"
                            title="Cetak struk"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          >
                            <Printer className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* TransactionCard Mobile (< 768px) — design-spec.json > components.TransactionCard_mobile */}
          <div
            className={cn(
              "space-y-3 transition-opacity md:hidden",
              isTableTransitioning && "opacity-65"
            )}
          >
            {isTableTransitioning && (
              <IndeterminateProgressBar
                label="Memperbarui daftar transaksi..."
                className="rounded-full"
              />
            )}
            {result.items.map((tx) => {
              const debit = BigInt(tx.debit);
              const credit = BigInt(tx.credit);
              const balance = BigInt(tx.balance);
              const defaultReceiptMode = tx.groupKey ? "group" : "individual";

              return (
                <div
                  key={tx.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Lihat detail transaksi ID ${tx.id}`}
                  onClick={() => handleOpenDetail(tx.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenDetail(tx.id);
                    }
                  }}
                  className="rounded-lg border border-surface-border bg-surface-card p-4 shadow-card transition-colors active:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CaseBadge caseValue={tx.case} />
                      {isAdmin && (
                        <span className="text-xs font-medium text-neutral-500">
                          {tx.agentCode}
                        </span>
                      )}
                    </div>
                    <span className="tabular-nums text-xs text-neutral-500">
                      {formatDateTimeTable(tx.transactionAt)}
                    </span>
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-sm text-neutral-900">
                    {tx.description}
                  </p>

                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-surface-border pt-3">
                    <div>
                      <p
                        className={cn(
                          "tabular-nums text-base font-bold",
                          debit > 0n ? "text-debit-text" : "text-credit-text"
                        )}
                      >
                        {debit > 0n
                          ? formatRupiah(debit, { signDisplay: "debit" })
                          : formatRupiah(credit, { signDisplay: "credit" })}
                      </p>
                      <p className="tabular-nums mt-0.5 text-xs text-neutral-500">
                        Saldo:{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            balance < 0n
                              ? "text-debit-text"
                              : "text-neutral-700"
                          )}
                        >
                          {formatRupiah(balance)}
                        </span>
                      </p>
                    </div>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={`/transactions/${tx.id}/receipt?mode=${defaultReceiptMode}`}
                        aria-label="Cetak struk"
                        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-0 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        <span>Cetak</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 5. Footer Pagination (design-spec.json > DataTable.footer) */}
          <footer className="flex flex-col gap-3 rounded-lg border border-surface-border bg-surface-card px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
              <span>
                Menampilkan{" "}
                <strong className="font-semibold text-neutral-900">
                  {result.pagination.fromIndex}–{result.pagination.toIndex}
                </strong>{" "}
                dari{" "}
                <strong className="font-semibold text-neutral-900">
                  {result.pagination.totalItems}
                </strong>
              </span>

              <div className="flex items-center gap-1.5">
                <label htmlFor="page-size-select" className="text-neutral-500">
                  Baris:
                </label>
                <select
                  id="page-size-select"
                  value={result.pagination.pageSize}
                  disabled={isTableTransitioning}
                  onChange={(e) =>
                    navigateWithPatch({
                      pageSize: Number(e.target.value) as PageSizeOption,
                      page: 1,
                    })
                  }
                  className="h-8 rounded-md border border-neutral-200 bg-neutral-0 px-2 text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 cursor-pointer"
                >
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={result.pagination.page <= 1 || isTableTransitioning}
                onClick={() =>
                  navigateWithPatch({ page: result.pagination.page - 1 })
                }
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Sebelumnya
              </Button>
              <span className="px-2 text-xs font-medium text-neutral-700">
                Hal. {result.pagination.page} /{" "}
                {Math.max(1, result.pagination.totalPages)}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  result.pagination.page >= result.pagination.totalPages ||
                  isTableTransitioning
                }
                onClick={() =>
                  navigateWithPatch({ page: result.pagination.page + 1 })
                }
              >
                Berikutnya
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </footer>
        </>
      )}

      {/* Drawer Filter */}
      <FilterDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        role={session.role}
        availableAgents={availableAgents}
        currentQuery={query}
        onApply={(next) => navigateWithPatch(next)}
        onClearAll={handleClearAllFilters}
      />

      {/* Drawer Detail Transaksi */}
      <TransactionDetailDrawer
        open={detailDrawerOpen}
        onOpenChange={handleCloseDetail}
        detail={matchingDetail}
        isLoading={isDetailLoading}
        notFoundId={
          detailDrawerOpen && !isDetailLoading && !matchingDetail
            ? activeDetailId
            : null
        }
        onSelectRelated={(relId) => handleOpenDetail(relId)}
      />
    </div>
  );
}
