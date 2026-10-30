import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-neutral-100", className)}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton pemuatan halaman Transaksi (design-spec.json > components.Skeleton:
 * "Pulse abu pada tabel/kartu saat memuat; hindari spinner layar penuh.")
 */
export function TransactionsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat transaksi">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-surface-border bg-surface-card p-5 shadow-card"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-7 w-36" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full sm:max-w-[420px]" />
        <Skeleton className="h-10 w-28" />
      </div>

      <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-card">
        <div className="border-b border-surface-border bg-surface-table-header px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="divide-y divide-surface-border">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

