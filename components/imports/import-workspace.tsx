"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { CaseBadge, ImportBatchStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { IndeterminateProgressBar } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client/api-client";
import type {
  ImportBatchDetailRecord,
  ImportBatchSummaryRecord,
} from "@/lib/db/types";
import type {
  ImportRowStatusType,
  ParsedImportPreviewRow,
} from "@/lib/domain/excel-parser";
import { formatDateTimeTable, formatRupiah } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

type ImportStep = 1 | 2 | 3;

const ALLOWED_FILE_EXTENSIONS = [".xls", ".xlsx", ".csv"];
const CLIENT_MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ImportWorkspaceProps {
  initialHistory: ImportBatchSummaryRecord[];
}

export function ImportWorkspace({ initialHistory }: ImportWorkspaceProps) {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [step, setStep] = React.useState<ImportStep>(1);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const [previewBatch, setPreviewBatch] =
    React.useState<ImportBatchDetailRecord | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | ImportRowStatusType
  >("all");
  const [confirmModalOpen, setConfirmModalOpen] = React.useState(false);
  const [isCommitting, setIsCommitting] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const [commitResult, setCommitResult] = React.useState<{
    fileName: string;
    importedCount: number;
    duplicateSkippedCount: number;
  } | null>(null);

  const [history, setHistory] =
    React.useState<ImportBatchSummaryRecord[]>(initialHistory);
  const [isRefreshingHistory, setIsRefreshingHistory] = React.useState(false);

  async function refreshHistory(manual = false) {
    if (manual) setIsRefreshingHistory(true);
    const res = await apiFetch<{ batches?: ImportBatchSummaryRecord[] }>(
      "/api/imports"
    );
    if (res.ok && res.data.batches) {
      setHistory(res.data.batches);
      if (manual) {
        toast.info("Riwayat impor diperbarui.");
      }
    } else if (manual && !res.ok) {
      toast.error(res.message);
    }
    if (manual) setIsRefreshingHistory(false);
  }

  async function processSelectedFile(file: File) {
    setUploadError(null);

    const lowerName = file.name.toLowerCase();
    if (!ALLOWED_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      const msg =
        "Format berkas tidak didukung. Gunakan file dengan ekstensi .xls, .xlsx, atau .csv.";
      setUploadError(msg);
      toast.error(msg);
      return;
    }

    if (file.size === 0) {
      const msg = "Berkas yang dipilih kosong (0 byte).";
      setUploadError(msg);
      toast.error(msg);
      return;
    }

    if (file.size > CLIENT_MAX_IMPORT_BYTES) {
      const msg = "Ukuran file melebihi batas maksimum 10 MB.";
      setUploadError(msg);
      toast.error(msg);
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiFetch<{ batch?: ImportBatchDetailRecord }>(
      "/api/imports/preview",
      {
        method: "POST",
        body: formData,
        timeoutMs: 45_000,
        fallbackErrorMessage:
          "File tidak dapat dibaca. Simpan ulang sebagai .xlsx atau .csv lalu coba lagi.",
      }
    );

    if (!res.ok || !res.data.batch) {
      const msg = !res.ok
        ? res.message
        : "File tidak dapat dibaca. Simpan ulang sebagai .xlsx atau .csv lalu coba lagi.";
      setUploadError(msg);
      toast.error(msg);
      setIsUploading(false);
      return;
    }

    const batch = res.data.batch;
    setPreviewBatch(batch);
    setStatusFilter("all");
    setStep(2);
    setIsUploading(false);

    if (batch.validRows === 0) {
      toast.warning("Tidak ada baris baru yang valid untuk diimpor.", {
        description: `${batch.duplicateRows} duplikat, ${batch.errorRows} error dari total ${batch.totalRows} baris.`,
      });
    } else if (batch.errorRows > 0 || batch.warningRows > 0) {
      toast.warning(
        `Pratinjau selesai: ${batch.validRows} dari ${batch.totalRows} baris siap diimpor.`,
        {
          description: `${batch.warningRows} peringatan, ${batch.errorRows} error, ${batch.duplicateRows} duplikat.`,
        }
      );
    } else {
      toast.success(
        `Pratinjau selesai: ${batch.validRows} baris siap diimpor.`
      );
    }

    void refreshHistory(false);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  }

  async function handleConfirmCommit() {
    if (!previewBatch || isCommitting) return;
    setIsCommitting(true);

    const res = await apiFetch<{
      importedCount?: number;
      duplicateSkippedCount?: number;
    }>(`/api/imports/${previewBatch.id}/commit`, {
      method: "POST",
      timeoutMs: 45_000,
      fallbackErrorMessage: "Gagal menyimpan batch impor. Silakan coba lagi.",
    });

    if (!res.ok || res.data.importedCount === undefined) {
      toast.error(!res.ok ? res.message : "Gagal menyimpan batch impor.");
      setIsCommitting(false);
      setConfirmModalOpen(false);
      return;
    }

    const importedCount = res.data.importedCount;
    const duplicateSkippedCount = res.data.duplicateSkippedCount ?? 0;

    setCommitResult({
      fileName: previewBatch.fileName,
      importedCount,
      duplicateSkippedCount,
    });
    setConfirmModalOpen(false);
    setIsCommitting(false);
    setStep(3);
    toast.success(`${importedCount} transaksi berhasil diimpor.`, {
      description:
        duplicateSkippedCount > 0
          ? `${duplicateSkippedCount} baris duplikat dilewati otomatis.`
          : `Sumber berkas: ${previewBatch.fileName}`,
    });
    void refreshHistory(false);
    router.refresh();
  }

  async function handleCancelPreview() {
    if (!previewBatch || isCancelling) return;
    setIsCancelling(true);

    const res = await apiFetch(`/api/imports/${previewBatch.id}/cancel`, {
      method: "POST",
    });

    if (!res.ok) {
      toast.warning(
        "Batch pratinjau ditutup, namun status pembatalan gagal diperbarui di server."
      );
    } else {
      toast.info("Pratinjau impor dibatalkan.");
    }

    setPreviewBatch(null);
    setStep(1);
    setIsCancelling(false);
    void refreshHistory(false);
  }

  function handleDownloadTemplateCsv() {
    const csvLines = [
      '"LAPORAN CASHFLOW USER: eman - Periode Contoh Impor"',
      '"ID","TANGGAL","KODE AGEN","CASE","KETERANGAN","DEBET","KREDIT","SALDO"',
      '"2","2026-07-29 10:15:10","JKT-37287","Bonus","Bonus Issued Flight No. Pesanan 920025501 (Kode Booking MNGTRV)","","25000",""',
      '"1","2026-07-29 10:15:00","JKT-37287","Withdrawal","Issued Flight No. Pesanan 920025501","1850000","",""',
    ];
    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "CONTOH-LAPORAN-CASHFLOW.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.info("Contoh berkas CSV berhasil diunduh.");
  }

  const filteredPreviewRows = React.useMemo(() => {
    if (!previewBatch) return [];
    if (statusFilter === "all") return previewBatch.rows;
    return previewBatch.rows.filter((r) => r.status === statusFilter);
  }, [previewBatch, statusFilter]);

  return (
    <div className="space-y-8">
      {/* Indikator Langkah: 1 Unggah > 2 Pratinjau > 3 Selesai */}
      <nav
        aria-label="Langkah impor file"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-surface-border bg-surface-card px-5 py-3.5 shadow-card text-sm"
      >
        {(
          [
            { num: 1, label: "Unggah" },
            { num: 2, label: "Pratinjau" },
            { num: 3, label: "Selesai" },
          ] as const
        ).map((item, idx) => {
          const isCurrent = step === item.num;
          const isCompleted = step > item.num;
          return (
            <React.Fragment key={item.num}>
              {idx > 0 && (
                <ChevronRight
                  className="h-4 w-4 text-neutral-400"
                  aria-hidden="true"
                />
              )}
              <div
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 font-medium",
                  isCurrent
                    ? "text-primary-700 font-semibold"
                    : isCompleted
                      ? "text-credit-text"
                      : "text-neutral-400"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    isCurrent
                      ? "bg-primary-600 text-neutral-0"
                      : isCompleted
                        ? "bg-credit-bg text-credit-text"
                        : "bg-neutral-100 text-neutral-500"
                  )}
                >
                  {item.num}
                </span>
                <span>{item.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </nav>

      {/* LANGKAH 1: UNGGAH FILE */}
      {step === 1 && (
        <section className="relative overflow-hidden rounded-lg border border-surface-border bg-surface-card p-6 shadow-card space-y-5">
          {isUploading && (
            <IndeterminateProgressBar
              label="Membaca dan memvalidasi berkas..."
              className="absolute inset-x-0 top-0"
            />
          )}

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                Unggah Laporan Cashflow
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Sistem mendeteksi baris header <code>TANGGAL</code> dan{" "}
                <code>KODE AGEN</code> secara otomatis serta memeriksa duplikat
                dan konsistensi saldo sebelum menyimpan.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isUploading}
              onClick={handleDownloadTemplateCsv}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Unduh Contoh .CSV
            </Button>
          </div>

          {/* FileDropzone (design-spec.json > components.FileDropzone) */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Tarik file ke sini atau pilih file. Format .xls, .xlsx, .csv"
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isUploading) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isUploading) setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer",
              isDragOver
                ? "border-primary-500 bg-primary-50"
                : uploadError
                  ? "border-danger bg-debit-bg/30"
                  : "border-neutral-200 bg-neutral-25 hover:border-primary-500 hover:bg-primary-50/40",
              isUploading && "pointer-events-none opacity-75"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.csv"
              onChange={handleFileInputChange}
              className="sr-only"
              tabIndex={-1}
            />

            {isUploading ? (
              <>
                <Loader2
                  className="h-10 w-10 animate-spin text-primary-600"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-semibold text-neutral-900">
                  Membaca dan memvalidasi baris transaksi...
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Belum ada data yang disimpan ke database pada tahap ini.
                </p>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <FileUp className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-semibold text-neutral-900">
                  Tarik file ke sini atau pilih file. Format .xls, .xlsx, .csv
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Ukuran file maksimum 10 MB • Kolom wajib: TANGGAL, KODE AGEN,
                  CASE, KETERANGAN, DEBET, KREDIT, SALDO
                </p>
              </>
            )}
          </div>

          {uploadError && (
            <AlertBanner
              variant="error"
              title="Unggahan Ditolak"
              onDismiss={() => setUploadError(null)}
            >
              {uploadError}
            </AlertBanner>
          )}
        </section>
      )}

      {/* LANGKAH 2: PRATINJAU & VALIDASI */}
      {step === 2 && previewBatch && (
        <section className="space-y-5">
          <div className="relative overflow-hidden flex flex-col justify-between gap-4 rounded-lg border border-surface-border bg-surface-card p-5 shadow-card sm:flex-row sm:items-center">
            {(isCommitting || isCancelling) && (
              <IndeterminateProgressBar
                label="Memproses batch impor..."
                className="absolute inset-x-0 top-0"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet
                  className="h-5 w-5 shrink-0 text-primary-600"
                  aria-hidden="true"
                />
                <h2 className="truncate text-base font-semibold text-neutral-900">
                  {previewBatch.fileName}
                </h2>
              </div>
              {previewBatch.reportTitle && (
                <p className="mt-1 text-xs text-neutral-500">
                  Judul laporan: <strong>{previewBatch.reportTitle}</strong>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Button
                type="button"
                variant="secondary"
                isLoading={isCancelling}
                disabled={isCommitting}
                onClick={handleCancelPreview}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={previewBatch.validRows === 0 || isCancelling}
                onClick={() => setConfirmModalOpen(true)}
              >
                Impor {previewBatch.validRows} baris valid
              </Button>
            </div>
          </div>

          {previewBatch.validRows === 0 && (
            <AlertBanner
              variant="warning"
              title="Tidak ada baris yang dapat diimpor"
            >
              Seluruh baris pada berkas ini berstatus duplikat (
              {previewBatch.duplicateRows} baris) atau memiliki galat validasi (
              {previewBatch.errorRows} baris). Klik <strong>Batal</strong> untuk
              mengunggah berkas lain.
            </AlertBanner>
          )}

          {/* 5 Kartu Ringkasan Kecil: Total, Valid, Peringatan, Error, Duplikat */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                {
                  key: "all",
                  label: "Total Baris",
                  count: previewBatch.totalRows,
                  color: "text-neutral-900",
                },
                {
                  key: "valid",
                  label: "Valid (Siap Impor)",
                  count: previewBatch.validRows,
                  color: "text-credit-text",
                },
                {
                  key: "warning",
                  label: "Peringatan",
                  count: previewBatch.warningRows,
                  color: "text-warning-text",
                },
                {
                  key: "error",
                  label: "Error (Ditolak)",
                  count: previewBatch.errorRows,
                  color: "text-debit-text",
                },
                {
                  key: "duplicate",
                  label: "Duplikat (Dilewati)",
                  count: previewBatch.duplicateRows,
                  color: "text-neutral-700",
                },
              ] as const
            ).map((card) => {
              const active = statusFilter === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setStatusFilter(card.key)}
                  className={cn(
                    "rounded-lg border bg-surface-card p-3.5 text-left shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer",
                    active
                      ? "border-primary-500 ring-1 ring-primary-500"
                      : "border-surface-border hover:bg-neutral-25"
                  )}
                >
                  <p className="text-xs font-medium text-neutral-500">
                    {card.label}
                  </p>
                  <p
                    className={cn(
                      "tabular-nums mt-1 text-xl font-bold",
                      card.color
                    )}
                  >
                    {card.count}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Tabel Pratinjau Baris */}
          <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-card">
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-surface-border bg-surface-table-header">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-neutral-500">
                      Baris
                    </th>
                    <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-neutral-500">
                      Status
                    </th>
                    <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-neutral-500">
                      Tanggal
                    </th>
                    <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-neutral-500">
                      Agen
                    </th>
                    <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-neutral-500">
                      Case
                    </th>
                    <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-neutral-500">
                      Keterangan
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider text-neutral-500">
                      Debet
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider text-neutral-500">
                      Kredit
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider text-neutral-500">
                      Proyeksi Saldo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredPreviewRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-neutral-500"
                      >
                        Tidak ada baris pada kategori status ini.
                      </td>
                    </tr>
                  ) : (
                    filteredPreviewRows.map((row) => (
                      <PreviewRowItem key={row.rowNumber} row={row} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Konfirmasi Commit Impor */}
          <Modal
            open={confirmModalOpen}
            onOpenChange={setConfirmModalOpen}
            title="Konfirmasi Impor Transaksi"
            description="Seluruh baris valid akan disimpan dalam satu transaksi database dan saldo berjalan agen akan dihitung ulang."
            footer={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isCommitting}
                  onClick={() => setConfirmModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  isLoading={isCommitting}
                  onClick={handleConfirmCommit}
                >
                  Ya, Impor {previewBatch.validRows} Baris
                </Button>
              </>
            }
          >
            <div className="space-y-3 text-sm text-neutral-700">
              <p>
                Anda akan mengimpor{" "}
                <strong className="text-neutral-900">
                  {previewBatch.validRows} baris transaksi valid
                </strong>{" "}
                dari file <strong>{previewBatch.fileName}</strong>.
              </p>
              <ul className="space-y-1 rounded-md border border-surface-border bg-neutral-25 p-3 text-xs">
                <li>
                  • Baris dengan peringatan ({previewBatch.warningRows} baris)
                  tetap ikut diimpor menggunakan saldo hitungan sistem.
                </li>
                {previewBatch.duplicateRows > 0 && (
                  <li>
                    • {previewBatch.duplicateRows} baris duplikat otomatis
                    dilewati.
                  </li>
                )}
                {previewBatch.errorRows > 0 && (
                  <li className="text-debit-text font-medium">
                    • {previewBatch.errorRows} baris error tidak akan diimpor.
                  </li>
                )}
              </ul>
            </div>
          </Modal>
        </section>
      )}

      {/* LANGKAH 3: SELESAI */}
      {step === 3 && commitResult && (
        <section className="rounded-lg border border-surface-border bg-surface-card p-8 text-center shadow-card space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-credit-bg text-credit-text">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-neutral-900">
              {commitResult.importedCount} transaksi berhasil diimpor.
            </h2>
            {commitResult.duplicateSkippedCount > 0 && (
              <p className="text-sm text-neutral-500">
                {commitResult.duplicateSkippedCount} baris duplikat dilewati.
              </p>
            )}
            <p className="text-xs text-neutral-500">
              Sumber file: <strong>{commitResult.fileName}</strong>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPreviewBatch(null);
                setCommitResult(null);
                setStep(1);
              }}
            >
              Impor File Lain
            </Button>
            <Button asChild variant="primary">
              <Link href="/transactions">Lihat Daftar Transaksi</Link>
            </Button>
          </div>
        </section>
      )}

      {/* RIWAYAT IMPOR (F-08 > history) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Riwayat Impor
            </h2>
            <p className="text-xs text-neutral-500">
              Catatan seluruh batch unggahan laporan cashflow.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isRefreshingHistory}
            onClick={() => void refreshHistory(true)}
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                isRefreshingHistory && "animate-spin text-primary-600"
              )}
              aria-hidden="true"
            />
            Muat Ulang
          </Button>
        </div>

        {history.length === 0 ? (
          <EmptyState
            variant="no_data"
            title="Belum ada riwayat impor."
            description="Batch file Excel atau CSV yang Anda unggah akan tercatat di sini."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-card">
            {isRefreshingHistory && (
              <IndeterminateProgressBar label="Memperbarui riwayat impor..." />
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-surface-border bg-surface-table-header">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Nama File
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Waktu
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Pengunggah
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Valid
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Duplikat / Error
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={cn(
                    "divide-y divide-surface-border transition-opacity",
                    isRefreshingHistory && "opacity-65"
                  )}
                >
                  {history.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-table-hover">
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900">
                          {b.fileName}
                        </p>
                        {b.reportTitle && (
                          <p className="text-xs text-neutral-500 truncate max-w-sm">
                            {b.reportTitle}
                          </p>
                        )}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-xs text-neutral-700">
                        {formatDateTimeTable(b.committedAt ?? b.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-700">
                        {b.uploaderName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <ImportBatchStatusBadge status={b.status} />
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-900">
                        {b.totalRows}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right font-semibold text-credit-text">
                        {b.validRows}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right text-xs text-neutral-500">
                        {b.duplicateRows} dup /{" "}
                        <span
                          className={cn(
                            b.errorRows > 0 && "text-debit-text font-semibold"
                          )}
                        >
                          {b.errorRows} err
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Baris tabel pratinjau dengan ImportRowStatus sesuai design-spec.json > components.ImportRowStatus
 */
function PreviewRowItem({ row }: { row: ParsedImportPreviewRow }) {
  const debitVal = row.prepared ? BigInt(row.prepared.debit) : null;
  const creditVal = row.prepared ? BigInt(row.prepared.credit) : null;
  const projectedVal = row.prepared
    ? BigInt(row.prepared.projectedBalance)
    : null;

  return (
    <tr
      className={cn(
        "align-top",
        row.status === "error" && "bg-debit-bg/25",
        row.status === "warning" && "bg-warning-bg/30",
        row.status === "duplicate" && "bg-neutral-25 text-neutral-500"
      )}
    >
      <td className="px-3 py-2.5 font-mono text-neutral-500">
        #{row.rowNumber}
      </td>
      <td className="px-3 py-2.5 min-w-[200px]">
        {row.status === "valid" && (
          <span className="inline-flex items-center gap-1.5 font-medium text-credit-text">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Valid</span>
          </span>
        )}
        {row.status === "warning" && (
          <div className="space-y-1 text-warning-text">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Peringatan</span>
            </span>
            {row.messages.map((msg, i) => (
              <p key={i} className="text-[11px] leading-4">
                {msg}
              </p>
            ))}
          </div>
        )}
        {row.status === "error" && (
          <div className="space-y-1 text-debit-text">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Error</span>
            </span>
            {row.messages.map((msg, i) => (
              <p key={i} className="text-[11px] leading-4">
                {msg}
              </p>
            ))}
          </div>
        )}
        {row.status === "duplicate" && (
          <span className="inline-flex items-center gap-1.5 font-medium text-neutral-500">
            <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Duplikat, dilewati</span>
          </span>
        )}
      </td>
      <td className="tabular-nums whitespace-nowrap px-3 py-2.5">
        {row.rawTanggal || "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 font-medium">
        {row.rawAgentCode || "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        {row.rawCase ? <CaseBadge caseValue={row.rawCase} /> : "—"}
      </td>
      <td className="max-w-xs px-3 py-2.5 break-words">
        {row.rawDescription || "—"}
      </td>
      <td className="tabular-nums whitespace-nowrap px-3 py-2.5 text-right">
        {debitVal !== null
          ? formatRupiah(debitVal, { emptyAsDash: true })
          : row.rawDebit || "—"}
      </td>
      <td className="tabular-nums whitespace-nowrap px-3 py-2.5 text-right">
        {creditVal !== null
          ? formatRupiah(creditVal, { emptyAsDash: true })
          : row.rawCredit || "—"}
      </td>
      <td className="tabular-nums whitespace-nowrap px-3 py-2.5 text-right font-semibold">
        {projectedVal !== null ? formatRupiah(projectedVal) : "—"}
      </td>
    </tr>
  );
}
