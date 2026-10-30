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
 * Bar indikator pemuatan tipis (indeterminate) untuk transisi rute,
 * pemfilteran tabel, atau penyegaran data tanpa menutupi konten utama.
 */
export function IndeterminateProgressBar({
  label = "Memuat data...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-busy="true"
      className={cn(
        "no-print relative h-0.5 w-full overflow-hidden bg-primary-100",
        className
      )}
    >
      <div className="animate-indeterminate h-full w-1/3 rounded-full bg-primary-600" />
    </div>
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
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
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

/**
 * Skeleton untuk isi Detail Transaksi (baik di dalam Drawer maupun halaman /transactions/[id]).
 */
export function TransactionDetailSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Memuat rincian transaksi"
    >
      <div className="rounded-lg border border-surface-border bg-neutral-25 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-8 w-44" />
        <div className="flex items-center justify-between border-t border-surface-border pt-2.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      <div className="divide-y divide-surface-border">
        {Array.from({ length: 7 }).map((_, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-4 py-3"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    </div>
  );
}

export function ReceiptPageSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      aria-busy="true"
      aria-label="Memuat pratinjau struk"
    >
      <div className="rounded-lg border border-surface-border bg-surface-card p-5 shadow-card space-y-5 lg:col-span-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2.5 pt-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="flex justify-center rounded-lg border border-surface-border bg-neutral-100/70 p-6 sm:p-8 lg:col-span-8">
        <div className="w-full max-w-[320px] rounded-sm bg-neutral-0 p-6 shadow-card space-y-4">
          <Skeleton className="mx-auto h-10 w-28" />
          <Skeleton className="mx-auto h-4 w-40" />
          <Skeleton className="h-px w-full" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
          <Skeleton className="h-px w-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManualTransactionPageSkeleton() {
  return (
    <div
      className="space-y-4"
      aria-busy="true"
      aria-label="Memuat formulir input manual"
    >
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="w-full max-w-[560px] rounded-lg border border-surface-border bg-surface-card p-6 shadow-card space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-72" />
          </div>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>

        <div className="w-full max-w-[560px] lg:w-[380px] space-y-4">
          <div className="rounded-lg border border-surface-border bg-surface-card p-5 shadow-card space-y-4">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
          <div className="rounded-lg border border-surface-border bg-surface-card p-5 shadow-card space-y-3">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImportPageSkeleton() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="Memuat halaman impor"
    >
      <div className="rounded-lg border border-surface-border bg-surface-card px-5 py-3.5 shadow-card">
        <Skeleton className="h-6 w-64" />
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-card p-6 shadow-card space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3.5 w-80" />
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-card divide-y divide-surface-border">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminTablePageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="space-y-5"
      aria-busy="true"
      aria-label="Memuat daftar data"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full sm:max-w-xs" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-card">
        <div className="border-b border-surface-border bg-surface-table-header px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="divide-y divide-surface-border">
          {Array.from({ length: rows }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div
      className="flex flex-col items-start gap-6 lg:flex-row"
      aria-busy="true"
      aria-label="Memuat pengaturan"
    >
      <div className="w-full max-w-[620px] rounded-lg border border-surface-border bg-surface-card p-6 shadow-card space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <div className="flex items-center gap-4 border-b border-surface-border pb-5">
          <Skeleton className="h-20 w-44" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3.5 w-full" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="w-full max-w-[620px] lg:w-[340px] rounded-lg border border-surface-border bg-surface-card p-5 shadow-card space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mx-auto h-64 w-full max-w-[270px]" />
      </div>
    </div>
  );
}

export function AccountPageSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      aria-busy="true"
      aria-label="Memuat profil akun"
    >
      <div className="rounded-lg border border-surface-border bg-surface-card p-6 shadow-card space-y-5 lg:col-span-5">
        <div className="flex items-center gap-3 border-b border-surface-border pb-4">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-card p-6 shadow-card space-y-5 lg:col-span-7">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="space-y-2 max-w-md">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-44" />
      </div>
    </div>
  );
}

export function LoginCardSkeleton() {
  return (
    <div
      className="w-full max-w-[400px] rounded-lg border border-surface-border bg-surface-card p-8 shadow-card space-y-5"
      aria-busy="true"
      aria-label="Memuat halaman masuk"
    >
      <Skeleton className="mx-auto h-14 w-40" />
      <Skeleton className="mx-auto h-7 w-24" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
