"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Check, Link2, Loader2, Printer } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Button } from "@/components/ui/button";
import { IndeterminateProgressBar } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client/api-client";
import {
  formatDateTimeReceipt,
  formatDateTimeTable,
  formatRupiah,
} from "@/lib/domain/format";
import type {
  ReceiptMode,
  ReceiptPaperSize,
  ReceiptPayload,
} from "@/lib/domain/receipt";
import { cn } from "@/lib/utils";

const RECEIPT_SIZE_STORAGE_KEY = "manga_receipt_paper_size";
const RECEIPT_SIZE_CHANGE_EVENT = "manga-receipt-size-change";

function subscribeReceiptSize(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(RECEIPT_SIZE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(RECEIPT_SIZE_CHANGE_EVENT, callback);
  };
}

function getStoredReceiptSize(): ReceiptPaperSize {
  const saved = window.localStorage.getItem(RECEIPT_SIZE_STORAGE_KEY);
  if (saved === "58" || saved === "80" || saved === "a4") {
    return saved;
  }
  return "80";
}

function getServerReceiptSize(): ReceiptPaperSize {
  return "80";
}

export interface ReceiptWorkspaceProps {
  transactionId: string;
  hasGroupKey: boolean;
  activeMode: ReceiptMode;
  initialSizeFromUrl: ReceiptPaperSize | null;
  receipt: ReceiptPayload;
}

export function ReceiptWorkspace({
  transactionId,
  hasGroupKey,
  activeMode,
  initialSizeFromUrl,
  receipt,
}: ReceiptWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [isModePending, startModeTransition] = React.useTransition();
  const [linkCopied, setLinkCopied] = React.useState(false);

  const storedSize = React.useSyncExternalStore(
    subscribeReceiptSize,
    getStoredReceiptSize,
    getServerReceiptSize
  );
  const [manualSize, setManualSize] = React.useState<ReceiptPaperSize | null>(
    initialSizeFromUrl
  );
  const size: ReceiptPaperSize =
    manualSize ?? initialSizeFromUrl ?? storedSize;

  const [showThermalLogo, setShowThermalLogo] = React.useState(
    receipt.header.showThermalLogo
  );

  // Simpan ukuran dari URL ke localStorage (sinkronisasi ke sistem eksternal)
  React.useEffect(() => {
    if (initialSizeFromUrl) {
      window.localStorage.setItem(RECEIPT_SIZE_STORAGE_KEY, initialSizeFromUrl);
    }
  }, [initialSizeFromUrl]);

  function handleSelectSize(nextSize: ReceiptPaperSize) {
    setManualSize(nextSize);
    window.localStorage.setItem(RECEIPT_SIZE_STORAGE_KEY, nextSize);
    window.dispatchEvent(new Event(RECEIPT_SIZE_CHANGE_EVENT));
    const params = new URLSearchParams();
    params.set("mode", activeMode);
    params.set("size", nextSize);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleSelectMode(nextMode: ReceiptMode) {
    if (nextMode === activeMode || isModePending) return;
    const params = new URLSearchParams();
    params.set("mode", nextMode);
    params.set("size", size);
    startModeTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handlePrint() {
    // Catat aksi cetak di audit_logs secara asinkron (F-06 > audit)
    void apiFetch("/api/receipts", {
      method: "POST",
      body: {
        transactionId,
        mode: activeMode,
        size,
      },
      redirectOnUnauthorized: false,
    });
    window.print();
  }

  async function handleCopyReceiptLink() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", activeMode);
      url.searchParams.set("size", size);
      await navigator.clipboard.writeText(url.toString());
      setLinkCopied(true);
      toast.success("Tautan struk disalin ke papan klip.");
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      toast.error("Gagal menyalin tautan struk.");
    }
  }

  const pageCssRule =
    size === "58"
      ? "@media print { @page { size: 58mm auto; margin: 0; } }"
      : size === "80"
        ? "@media print { @page { size: 80mm auto; margin: 0; } }"
        : "@media print { @page { size: A4; margin: 16mm; } }";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Aturan @page dinamis untuk ukuran kertas aktif */}
      <style>{pageCssRule}</style>

      {/* Kolom Kiri: Kontrol (disembunyikan saat cetak) */}
      <aside className="no-print space-y-5 lg:col-span-4">
        <div className="rounded-lg border border-surface-border bg-surface-card p-5 shadow-card space-y-5">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Pengaturan Struk
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Pratinjau di sebelah kanan sama persis dengan hasil cetak.
            </p>
          </div>

          {/* Pilihan Mode: Individual | Grup */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Mode Cetak
            </span>
            {hasGroupKey ? (
              <div
                className="grid grid-cols-2 rounded-md border border-neutral-200 bg-neutral-25 p-1"
                role="group"
                aria-label="Pilih mode struk"
              >
                <button
                  type="button"
                  disabled={isModePending}
                  onClick={() => handleSelectMode("individual")}
                  className={cn(
                    "inline-flex h-9 items-center justify-center gap-1.5 rounded-sm text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60",
                    activeMode === "individual"
                      ? "bg-neutral-0 text-primary-700 font-semibold shadow-2xs"
                      : "text-neutral-700 hover:text-neutral-900"
                  )}
                >
                  {isModePending && activeMode !== "individual" && (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-primary-600"
                      aria-hidden="true"
                    />
                  )}
                  <span>Individual</span>
                </button>
                <button
                  type="button"
                  disabled={isModePending}
                  onClick={() => handleSelectMode("group")}
                  className={cn(
                    "inline-flex h-9 items-center justify-center gap-1.5 rounded-sm text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60",
                    activeMode === "group"
                      ? "bg-neutral-0 text-primary-700 font-semibold shadow-2xs"
                      : "text-neutral-700 hover:text-neutral-900"
                  )}
                >
                  {isModePending && activeMode !== "group" && (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-primary-600"
                      aria-hidden="true"
                    />
                  )}
                  <span>Grup</span>
                </button>
              </div>
            ) : (
              <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                Mode <strong>Individual</strong> (transaksi ini tidak memiliki
                No. Pesanan sehingga tidak memiliki grup).
              </p>
            )}
          </div>

          {/* Pilihan Ukuran: 58mm | 80mm | A4 */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Ukuran Kertas
            </span>
            <div
              className="grid grid-cols-3 rounded-md border border-neutral-200 bg-neutral-25 p-1"
              role="group"
              aria-label="Pilih ukuran kertas struk"
            >
              {(
                [
                  { id: "58", label: "58mm" },
                  { id: "80", label: "80mm" },
                  { id: "a4", label: "A4" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectSize(opt.id)}
                  className={cn(
                    "h-9 rounded-sm text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    size === opt.id
                      ? "bg-neutral-0 text-primary-700 font-semibold shadow-2xs"
                      : "text-neutral-700 hover:text-neutral-900"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opsi Logo Thermal (design-spec.json > D-RECEIPT-LOGO) */}
          {size !== "a4" && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-surface-border bg-neutral-25 px-3 py-2.5 text-xs font-medium text-neutral-700">
              <span>Tampilkan logo pada struk thermal</span>
              <input
                type="checkbox"
                checked={showThermalLogo}
                onChange={(e) => setShowThermalLogo(e.target.checked)}
                className="h-4 w-4 rounded-xs accent-primary-600"
              />
            </label>
          )}

          {receipt.group?.incompleteNote && (
            <AlertBanner variant="warning">
              {receipt.group.incompleteNote}
            </AlertBanner>
          )}

          <div className="flex flex-col gap-2.5 pt-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={isModePending}
              onClick={handlePrint}
              className="w-full"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Cetak
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={handleCopyReceiptLink}
              className="w-full"
            >
              {linkCopied ? (
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <Link2 className="h-4 w-4" aria-hidden="true" />
              )}
              {linkCopied ? "Tautan Tersalin" : "Salin Tautan Struk"}
            </Button>

            <Button asChild variant="ghost" className="w-full">
              <Link href={`/transactions?detail=${transactionId}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Kembali ke Transaksi
              </Link>
            </Button>
          </div>
        </div>
      </aside>

      {/* Kolom Kanan: Kertas Virtual Pratinjau WYSIWYG */}
      <section
        aria-label="Pratinjau struk"
        aria-busy={isModePending}
        className="relative flex justify-center overflow-hidden rounded-lg border border-surface-border bg-neutral-100/70 p-4 sm:p-8 lg:col-span-8 print:block print:border-none print:bg-transparent print:p-0"
      >
        {isModePending && (
          <IndeterminateProgressBar
            label="Memuat mode struk..."
            className="absolute inset-x-0 top-0"
          />
        )}

        <div
          className={cn(
            "w-full flex justify-center transition-opacity print:block",
            isModePending && "opacity-60"
          )}
        >
          {size === "a4" ? (
            <A4ReceiptTemplate receipt={receipt} />
          ) : (
            <ThermalReceiptTemplate
              receipt={receipt}
              paperWidth={size}
              showLogo={showThermalLogo}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Template Struk Thermal 58mm & 80mm (Hitam-putih murni, JetBrains Mono, garis putus-putus).
 */
function ThermalReceiptTemplate({
  receipt,
  paperWidth,
  showLogo,
}: {
  receipt: ReceiptPayload;
  paperWidth: "58" | "80";
  showLogo: boolean;
}) {
  return (
    <article
      className={cn(
        "print-area bg-neutral-0 text-neutral-900 font-mono shadow-card print:text-black",
        paperWidth === "58"
          ? "w-[58mm] px-[5mm] py-[4mm] text-[10px] leading-[14px]"
          : "w-[80mm] px-[4mm] py-[5mm] text-[11px] leading-[16px]"
      )}
    >
      {/* Header Kop */}
      <header className="text-center space-y-1">
        {showLogo && (
          <div
            className={cn(
              "mx-auto mb-1",
              paperWidth === "58" ? "w-[60%]" : "w-[50%]"
            )}
          >
            <BrandLogo
              variant="thermal"
              logoSrc={receipt.header.logoPath}
              businessName={receipt.header.businessName}
            />
          </div>
        )}
        <p className="font-bold text-xs">{receipt.header.businessName}</p>
        <p className="break-words">
          CP: {receipt.header.contactPersonName} -{" "}
          {receipt.header.contactPersonPhone}
        </p>
        {receipt.header.address && (
          <p className="break-words">{receipt.header.address}</p>
        )}
      </header>

      <div className="my-2 border-t border-dashed border-neutral-900" />

      {/* Judul */}
      <h2 className="text-center font-bold tracking-wide">{receipt.title}</h2>

      <div className="my-2 border-t border-dashed border-neutral-900" />

      {/* Metadata */}
      <dl className="space-y-0.5">
        <div className="flex justify-between gap-2">
          <dt className="shrink-0">Tanggal</dt>
          <dd className="tabular-nums text-right">
            {formatDateTimeReceipt(receipt.meta.primaryTransactionAt)}
          </dd>
        </div>
        {receipt.mode === "individual" && (
          <div className="flex justify-between gap-2">
            <dt className="shrink-0">ID</dt>
            <dd className="text-right">#{receipt.meta.transactionId}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="shrink-0">Agen</dt>
          <dd className="text-right">{receipt.meta.agentCode}</dd>
        </div>
        {receipt.meta.orderNumber && (
          <div className="flex justify-between gap-2">
            <dt className="shrink-0">No.Pesanan</dt>
            <dd className="text-right">{receipt.meta.orderNumber}</dd>
          </div>
        )}
        {receipt.meta.bookingCode && (
          <div className="flex justify-between gap-2">
            <dt className="shrink-0">Booking</dt>
            <dd className="text-right font-bold">{receipt.meta.bookingCode}</dd>
          </div>
        )}
      </dl>

      <div className="my-2 border-t border-dashed border-neutral-900" />

      {/* Isi Individual */}
      {receipt.mode === "individual" && receipt.individual && (
        <div className="space-y-1.5">
          <div className="flex justify-between gap-2">
            <span>Jenis</span>
            <span className="font-bold">{receipt.individual.caseLabel}</span>
          </div>
          <div>
            <p className="text-neutral-700 print:text-black">Keterangan:</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words">
              {receipt.individual.description}
            </p>
          </div>
          <div className="my-1.5 border-t border-dashed border-neutral-900" />
          <div className="flex justify-between gap-2 font-bold">
            <span>
              {receipt.individual.side === "debit" ? "DEBET" : "KREDIT"}
            </span>
            <span className="tabular-nums text-right">
              {formatRupiah(receipt.individual.amount)}
            </span>
          </div>
          {receipt.individual.balance !== null && (
            <div className="flex justify-between gap-2">
              <span>Saldo</span>
              <span className="tabular-nums text-right">
                {formatRupiah(receipt.individual.balance)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Isi Grup */}
      {receipt.mode === "group" && receipt.group && (
        <div className="space-y-1">
          {receipt.group.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-2">
              <span className="break-words">{item.label}</span>
              <span className="tabular-nums shrink-0 text-right">
                {formatRupiah(item.amount)}
              </span>
            </div>
          ))}

          <div className="my-2 border-t border-dashed border-neutral-900" />

          <div className="flex justify-between gap-2 font-bold">
            <span>BIAYA BERSIH</span>
            <span className="tabular-nums text-right">
              {formatRupiah(receipt.group.netCost)}
            </span>
          </div>

          {receipt.group.incompleteNote && (
            <p className="mt-1.5 break-words italic">
              * {receipt.group.incompleteNote}
            </p>
          )}
        </div>
      )}

      <div className="my-2 border-t border-dashed border-neutral-900" />

      {/* Footer */}
      <footer className="space-y-0.5 text-center">
        <p className="tabular-nums">
          Dicetak: {formatDateTimeReceipt(receipt.footer.printedAt)}
        </p>
        <p>Oleh: {receipt.footer.printedBy}</p>
        {receipt.footer.note && (
          <p className="pt-1 font-medium break-words">{receipt.footer.note}</p>
        )}
      </footer>
    </article>
  );
}

/**
 * Template Struk A4 (Plus Jakarta Sans 12px, kop kiri-kanan, tabel rincian rapi).
 */
function A4ReceiptTemplate({ receipt }: { receipt: ReceiptPayload }) {
  return (
    <article className="print-area w-full max-w-[210mm] rounded-sm bg-neutral-0 p-8 text-xs leading-5 text-neutral-900 shadow-card sm:p-12 print:max-w-none print:p-0">
      {/* Header A4: Logo kiri atas, info usaha kanan atas */}
      <header className="flex flex-col justify-between gap-4 border-b-2 border-primary-700 pb-6 sm:flex-row sm:items-start">
        <BrandLogo
          variant="horizontal"
          logoSrc={receipt.header.logoPath}
          businessName={receipt.header.businessName}
        />
        <div className="text-left sm:text-right space-y-0.5">
          <p className="text-base font-bold text-primary-800">
            {receipt.header.businessName}
          </p>
          <p className="text-neutral-700">
            Contact Person: {receipt.header.contactPersonName} (
            {receipt.header.contactPersonPhone})
          </p>
          {receipt.header.address && (
            <p className="text-neutral-500">{receipt.header.address}</p>
          )}
        </div>
      </header>

      {/* Judul Dokumen */}
      <div className="my-6 text-center">
        <h2 className="text-lg font-bold tracking-wide text-primary-800 uppercase">
          {receipt.title}
        </h2>
      </div>

      {/* Metadata Dokumen */}
      <div className="mb-6 grid grid-cols-1 gap-3 rounded-md border border-neutral-200 bg-neutral-25 p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="flex justify-between sm:justify-start sm:gap-3">
            <span className="w-32 text-neutral-500">Tanggal Transaksi:</span>
            <span className="tabular-nums font-semibold">
              {formatDateTimeTable(receipt.meta.primaryTransactionAt)}
            </span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-3">
            <span className="w-32 text-neutral-500">Kode Agen:</span>
            <span className="font-semibold">{receipt.meta.agentCode}</span>
          </div>
        </div>

        <div className="space-y-1">
          {receipt.mode === "individual" && (
            <div className="flex justify-between sm:justify-start sm:gap-3">
              <span className="w-32 text-neutral-500">ID Transaksi:</span>
              <span className="font-mono font-semibold">
                #{receipt.meta.transactionId}
              </span>
            </div>
          )}
          {receipt.meta.orderNumber && (
            <div className="flex justify-between sm:justify-start sm:gap-3">
              <span className="w-32 text-neutral-500">No. Pesanan:</span>
              <span className="font-mono font-semibold">
                {receipt.meta.orderNumber}
              </span>
            </div>
          )}
          {receipt.meta.bookingCode && (
            <div className="flex justify-between sm:justify-start sm:gap-3">
              <span className="w-32 text-neutral-500">Kode Booking:</span>
              <span className="font-mono font-bold">
                {receipt.meta.bookingCode}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabel Rincian */}
      {receipt.mode === "individual" && receipt.individual ? (
        <div className="space-y-4">
          <table className="w-full border-collapse border border-neutral-200">
            <thead>
              <tr className="bg-neutral-50 text-left">
                <th className="border-b border-neutral-200 px-4 py-2.5 font-semibold text-neutral-700">
                  Jenis
                </th>
                <th className="border-b border-neutral-200 px-4 py-2.5 font-semibold text-neutral-700">
                  Keterangan
                </th>
                <th className="border-b border-neutral-200 px-4 py-2.5 text-right font-semibold text-neutral-700">
                  {receipt.individual.side === "debit" ? "Debet" : "Kredit"}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b border-neutral-200 px-4 py-3 font-medium align-top">
                  {receipt.individual.caseLabel}
                </td>
                <td className="border-b border-neutral-200 px-4 py-3 break-words align-top">
                  {receipt.individual.description}
                </td>
                <td className="tabular-nums border-b border-neutral-200 px-4 py-3 text-right font-bold align-top whitespace-nowrap">
                  {formatRupiah(receipt.individual.amount)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 rounded-md border border-neutral-200 bg-neutral-25 p-4">
              <div className="flex justify-between font-bold text-sm">
                <span>
                  Total{" "}
                  {receipt.individual.side === "debit" ? "Debet" : "Kredit"}
                </span>
                <span className="tabular-nums">
                  {formatRupiah(receipt.individual.amount)}
                </span>
              </div>
              {receipt.individual.balance !== null && (
                <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-neutral-700">
                  <span>Saldo Setelah Transaksi</span>
                  <span className="tabular-nums font-semibold">
                    {formatRupiah(receipt.individual.balance)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : receipt.group ? (
        <div className="space-y-4">
          <table className="w-full border-collapse border border-neutral-200">
            <thead>
              <tr className="bg-neutral-50 text-left">
                <th className="border-b border-neutral-200 px-4 py-2.5 font-semibold text-neutral-700">
                  ID
                </th>
                <th className="border-b border-neutral-200 px-4 py-2.5 font-semibold text-neutral-700">
                  Rincian
                </th>
                <th className="border-b border-neutral-200 px-4 py-2.5 font-semibold text-neutral-700">
                  Keterangan
                </th>
                <th className="border-b border-neutral-200 px-4 py-2.5 text-right font-semibold text-neutral-700">
                  Nominal
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {receipt.group.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-mono text-neutral-500 align-top">
                    #{item.id}
                  </td>
                  <td className="px-4 py-3 font-medium align-top">
                    {item.label}
                  </td>
                  <td className="px-4 py-3 break-words align-top">
                    {item.description}
                  </td>
                  <td className="tabular-nums px-4 py-3 text-right font-semibold whitespace-nowrap align-top">
                    {item.side === "credit"
                      ? `(${formatRupiah(item.amount)})`
                      : formatRupiah(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {receipt.group.incompleteNote && (
            <p className="rounded-md border border-warning-bg bg-warning-bg px-3 py-2 text-warning-text">
              {receipt.group.incompleteNote}
            </p>
          )}

          {/* Blok Ringkasan Biaya Bersih di kanan bawah */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 rounded-md border border-neutral-200 bg-neutral-25 p-4">
              <div className="flex justify-between text-neutral-700">
                <span>Total Harga Tiket (Debet)</span>
                <span className="tabular-nums">
                  {formatRupiah(receipt.group.totalDebit)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-700">
                <span>Total Bonus (Kredit)</span>
                <span className="tabular-nums">
                  - {formatRupiah(receipt.group.totalCredit)}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-sm font-bold text-primary-800">
                <span>BIAYA BERSIH</span>
                <span className="tabular-nums">
                  {formatRupiah(receipt.group.netCost)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Footer A4 */}
      <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-neutral-200 pt-4 text-[11px] text-neutral-500 sm:flex-row">
        <div>
          {receipt.footer.note && (
            <p className="font-medium text-neutral-700">
              {receipt.footer.note}
            </p>
          )}
        </div>
        <div className="sm:text-right">
          <p className="tabular-nums">
            Waktu cetak: {formatDateTimeTable(receipt.footer.printedAt)}
          </p>
          <p>Dicetak oleh: {receipt.footer.printedBy}</p>
        </div>
      </footer>
    </article>
  );
}
