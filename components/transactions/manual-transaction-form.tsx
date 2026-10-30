"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calculator, Loader2, Sparkles } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { CaseBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client/api-client";
import type { AppAgentRecord, ManualBalancePreview } from "@/lib/db/types";
import { getKnownTransactionCase, TRANSACTION_CASES } from "@/lib/domain/cases";
import { extractTransactionRefs } from "@/lib/domain/extraction";
import { formatRupiah } from "@/lib/domain/format";
import { parseRupiahToBigInt } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

export interface ManualTransactionFormProps {
  agents: AppAgentRecord[];
  defaultJakartaDateTimeLocal: string;
}

export function ManualTransactionForm({
  agents,
  defaultJakartaDateTimeLocal,
}: ManualTransactionFormProps) {
  const router = useRouter();
  const toast = useToast();

  const activeAgents = React.useMemo(
    () => agents.filter((a) => a.isActive),
    [agents]
  );

  const [agentId, setAgentId] = React.useState<string>(
    activeAgents[0]?.id ?? ""
  );
  const [transactionAt, setTransactionAt] = React.useState<string>(
    defaultJakartaDateTimeLocal
  );
  const [caseValue, setCaseValue] = React.useState<string>("withdrawal");
  const [amountRaw, setAmountRaw] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [serverPreviewState, setServerPreviewState] = React.useState<{
    key: string;
    data: ManualBalancePreview;
  } | null>(null);
  const [previewFailedKey, setPreviewFailedKey] = React.useState<string | null>(
    null
  );

  const selectedAgent =
    activeAgents.find((a) => a.id === agentId) ?? null;
  const caseMeta = getKnownTransactionCase(caseValue);

  const parsedAmount =
    amountRaw.trim() !== ""
      ? parseRupiahToBigInt(amountRaw, {
          allowNegative: false,
          emptyAsZero: false,
        })
      : null;

  const validAmount =
    parsedAmount !== null && parsedAmount > 0n ? parsedAmount : 0n;
  const debitBig = caseMeta?.side === "debit" ? validAmount : 0n;
  const creditBig = caseMeta?.side === "credit" ? validAmount : 0n;

  const extractedRefs = React.useMemo(
    () => extractTransactionRefs(description),
    [description]
  );

  const missingOrderWarning =
    description.trim().length > 0 &&
    (caseValue === "withdrawal" || caseValue === "bonus") &&
    !extractedRefs.orderNumber;

  const previewRequestKey = `${agentId}|${transactionAt}|${caseValue}|${validAmount.toString()}`;
  const isPreviewResolved =
    serverPreviewState?.key === previewRequestKey ||
    previewFailedKey === previewRequestKey;
  const isPreviewLoading =
    Boolean(agentId && transactionAt) && !isPreviewResolved;

  React.useEffect(() => {
    if (!agentId || !transactionAt) return;
    const abortCtrl = new AbortController();

    const timer = window.setTimeout(async () => {
      const res = await apiFetch<{ preview?: ManualBalancePreview }>(
        "/api/transactions/preview-balance",
        {
          method: "POST",
          body: {
            agentId,
            transactionAt,
            case: caseValue,
            amount: validAmount.toString(),
          },
          signal: abortCtrl.signal,
          timeoutMs: 10_000,
        }
      );

      if (abortCtrl.signal.aborted) return;

      if (!res.ok) {
        if (res.code !== "ABORTED") {
          setPreviewFailedKey(previewRequestKey);
        }
        return;
      }

      if (res.data.preview) {
        setServerPreviewState({
          key: previewRequestKey,
          data: res.data.preview,
        });
      } else {
        setPreviewFailedKey(previewRequestKey);
      }
    }, 250);

    return () => {
      abortCtrl.abort();
      window.clearTimeout(timer);
    };
  }, [agentId, transactionAt, caseValue, validAmount, previewRequestKey]);

  const activePreview: ManualBalancePreview | null = React.useMemo(() => {
    if (
      serverPreviewState &&
      serverPreviewState.key === previewRequestKey
    ) {
      return serverPreviewState.data;
    }
    if (!selectedAgent) return null;
    const before = BigInt(selectedAgent.currentBalance);
    const after = before + creditBig - debitBig;
    return {
      agentCode: selectedAgent.code,
      agentName: selectedAgent.name,
      balanceBefore: before.toString(),
      balanceAfter: after.toString(),
      isBackdated: false,
      affectedSubsequentCount: 0,
    };
  }, [
    serverPreviewState,
    previewRequestKey,
    selectedAgent,
    creditBig,
    debitBig,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const nextErrors: Record<string, string> = {};

    if (!agentId) {
      nextErrors.agentId = "Pilih agen terlebih dahulu.";
    }
    if (!transactionAt.trim()) {
      nextErrors.transactionAt = "Tanggal & jam transaksi wajib diisi.";
    }
    if (!caseMeta) {
      nextErrors.case = "Pilih jenis transaksi.";
    }
    if (parsedAmount === null || parsedAmount <= 0n) {
      nextErrors.amount = "Masukkan nominal bulat positif (> Rp 0).";
    }
    if (!description.trim()) {
      nextErrors.description = "Keterangan transaksi wajib diisi.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      toast.warning("Periksa kembali kolom yang wajib diisi.");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const res = await apiFetch<{
      transaction?: { id: string };
      warnings?: string[];
    }>("/api/transactions", {
      method: "POST",
      body: {
        agentId,
        transactionAt,
        case: caseValue,
        amount: parsedAmount!.toString(),
        description: description.trim(),
      },
      fallbackErrorMessage: "Gagal menyimpan transaksi. Silakan coba lagi.",
    });

    if (!res.ok) {
      if (res.fields) {
        setFieldErrors(res.fields);
      }
      setFormError(res.message);
      toast.error(res.message);
      setIsSubmitting(false);
      return;
    }

    toast.success("Transaksi berhasil disimpan.", {
      description: activePreview?.isBackdated
        ? `Saldo pada ${activePreview.affectedSubsequentCount} transaksi berikutnya telah dihitung ulang.`
        : undefined,
    });
    router.push("/transactions");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/transactions">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke Daftar Transaksi
          </Link>
        </Button>
      </div>

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        {/* Form Satu Kolom dalam Kartu, maks lebar 560px (design-spec.json > pages["/transactions/new"]) */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="w-full max-w-[560px] rounded-lg border border-surface-border bg-surface-card p-6 shadow-card space-y-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Data Transaksi Baru
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Saldo tidak perlu diinput; sistem menghitung mutasi dan saldo
              berjalan secara otomatis.
            </p>
          </div>

          {activeAgents.length === 0 && (
            <AlertBanner variant="warning" title="Belum ada agen aktif">
              Tambahkan atau aktifkan agen terlebih dahulu di menu{" "}
              <Link href="/admin/agents" className="underline font-semibold">
                Agen
              </Link>
              .
            </AlertBanner>
          )}

          {/* 1. Agen */}
          <div>
            <label
              htmlFor="manual-agent"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Agen <span className="text-danger">*</span>
            </label>
            <select
              id="manual-agent"
              disabled={isSubmitting}
              value={agentId}
              onChange={(e) => {
                setAgentId(e.target.value);
                setFieldErrors((prev) => ({ ...prev, agentId: "" }));
              }}
              aria-invalid={Boolean(fieldErrors.agentId)}
              aria-describedby={
                fieldErrors.agentId ? "manual-agent-error" : undefined
              }
              className={cn(
                "h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50",
                fieldErrors.agentId ? "border-danger" : "border-neutral-200"
              )}
            >
              {activeAgents.length === 0 && (
                <option value="">— Tidak ada agen aktif —</option>
              )}
              {activeAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
            {fieldErrors.agentId && (
              <p
                id="manual-agent-error"
                role="alert"
                className="mt-1 text-xs text-danger"
              >
                {fieldErrors.agentId}
              </p>
            )}
          </div>

          {/* 2. Tanggal & Jam Transaksi */}
          <div>
            <label
              htmlFor="manual-datetime"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Tanggal &amp; Jam Transaksi (WIB){" "}
              <span className="text-danger">*</span>
            </label>
            <input
              id="manual-datetime"
              type="datetime-local"
              step={1}
              disabled={isSubmitting}
              value={transactionAt}
              onChange={(e) => {
                setTransactionAt(e.target.value);
                setFieldErrors((prev) => ({ ...prev, transactionAt: "" }));
              }}
              aria-invalid={Boolean(fieldErrors.transactionAt)}
              aria-describedby={
                fieldErrors.transactionAt ? "manual-datetime-error" : undefined
              }
              className={cn(
                "tabular-nums h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50",
                fieldErrors.transactionAt
                  ? "border-danger"
                  : "border-neutral-200"
              )}
            />
            {fieldErrors.transactionAt && (
              <p
                id="manual-datetime-error"
                role="alert"
                className="mt-1 text-xs text-danger"
              >
                {fieldErrors.transactionAt}
              </p>
            )}
          </div>

          {/* 3. Jenis Transaksi (Case) */}
          <div>
            <label
              htmlFor="manual-case"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Jenis Transaksi (Case) <span className="text-danger">*</span>
            </label>
            <select
              id="manual-case"
              disabled={isSubmitting}
              value={caseValue}
              onChange={(e) => {
                setCaseValue(e.target.value);
                setFieldErrors((prev) => ({ ...prev, case: "" }));
              }}
              aria-invalid={Boolean(fieldErrors.case)}
              aria-describedby={
                fieldErrors.case ? "manual-case-error" : undefined
              }
              className={cn(
                "h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50",
                fieldErrors.case ? "border-danger" : "border-neutral-200"
              )}
            >
              {TRANSACTION_CASES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} (
                  {item.side === "debit"
                    ? "Debet / Uang Keluar"
                    : "Kredit / Uang Masuk"}
                  )
                </option>
              ))}
            </select>
            {fieldErrors.case && (
              <p
                id="manual-case-error"
                role="alert"
                className="mt-1 text-xs text-danger"
              >
                {fieldErrors.case}
              </p>
            )}
          </div>

          {/* 4. Nominal (Rp) */}
          <div>
            <label
              htmlFor="manual-amount"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Nominal (Rp) <span className="text-danger">*</span>
            </label>
            <input
              id="manual-amount"
              type="text"
              inputMode="numeric"
              disabled={isSubmitting}
              value={amountRaw}
              onChange={(e) => {
                setAmountRaw(e.target.value);
                setFieldErrors((prev) => ({ ...prev, amount: "" }));
              }}
              placeholder="Contoh: 2117756 atau 2.117.756"
              aria-invalid={Boolean(fieldErrors.amount)}
              aria-describedby={
                fieldErrors.amount
                  ? "manual-amount-error"
                  : "manual-amount-hint"
              }
              className={cn(
                "tabular-nums h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50",
                fieldErrors.amount ? "border-danger" : "border-neutral-200"
              )}
            />
            {fieldErrors.amount ? (
              <p
                id="manual-amount-error"
                role="alert"
                className="mt-1 text-xs text-danger"
              >
                {fieldErrors.amount}
              </p>
            ) : (
              <p
                id="manual-amount-hint"
                className="mt-1 text-xs text-neutral-500"
              >
                {validAmount > 0n ? (
                  <>
                    Dicatat sebagai{" "}
                    <strong
                      className={cn(
                        caseMeta?.side === "debit"
                          ? "text-debit-text"
                          : "text-credit-text"
                      )}
                    >
                      {caseMeta?.side === "debit" ? "DEBET" : "KREDIT"}{" "}
                      {formatRupiah(validAmount)}
                    </strong>
                  </>
                ) : (
                  "Masukkan angka bulat Rupiah tanpa desimal."
                )}
              </p>
            )}
          </div>

          {/* 5. Keterangan */}
          <div>
            <label
              htmlFor="manual-description"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Keterangan <span className="text-danger">*</span>
            </label>
            <textarea
              id="manual-description"
              rows={3}
              disabled={isSubmitting}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFieldErrors((prev) => ({ ...prev, description: "" }));
              }}
              placeholder="Contoh: Issued Flight No. Pesanan 920019906 atau Bonus Issued Flight No. Pesanan 920019906 (Kode Booking EQNMYK)"
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={
                fieldErrors.description
                  ? "manual-description-error"
                  : undefined
              }
              className={cn(
                "w-full rounded-md border bg-neutral-0 p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50",
                fieldErrors.description ? "border-danger" : "border-neutral-200"
              )}
            />
            {fieldErrors.description && (
              <p
                id="manual-description-error"
                role="alert"
                className="mt-1 text-xs text-danger"
              >
                {fieldErrors.description}
              </p>
            )}
          </div>

          {formError && (
            <AlertBanner
              variant="error"
              onDismiss={() => setFormError(null)}
            >
              {formError}
            </AlertBanner>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-surface-border pt-4">
            <Button asChild variant="secondary">
              <Link href="/transactions">Batal</Link>
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={activeAgents.length === 0}
            >
              Simpan
            </Button>
          </div>
        </form>

        {/* Kartu Pratinjau Saldo di Sampingnya (Desktop) */}
        <aside
          aria-label="Pratinjau saldo dan ekstraksi"
          className="w-full max-w-[560px] lg:w-[380px] lg:shrink-0 space-y-4"
        >
          <div className="rounded-lg border border-surface-border bg-surface-card p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <Calculator
                  className="h-4 w-4 text-primary-600"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-semibold text-neutral-900">
                  Pratinjau Saldo Hasil
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {isPreviewLoading && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500"
                    aria-live="polite"
                  >
                    <Loader2
                      className="h-3 w-3 animate-spin text-primary-600"
                      aria-hidden="true"
                    />
                    <span>Menghitung...</span>
                  </span>
                )}
                <CaseBadge caseValue={caseValue} />
              </div>
            </div>

            {activePreview ? (
              <dl
                className={cn(
                  "space-y-3 text-sm transition-opacity",
                  isPreviewLoading && "opacity-75"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">Agen</dt>
                  <dd className="font-semibold text-neutral-900 text-right">
                    {activePreview.agentCode} — {activePreview.agentName}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">Saldo Sebelumnya</dt>
                  <dd className="tabular-nums font-medium text-neutral-700">
                    {formatRupiah(activePreview.balanceBefore)}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">
                    Mutasi ({caseMeta?.side === "debit" ? "Debet" : "Kredit"})
                  </dt>
                  <dd
                    className={cn(
                      "tabular-nums font-semibold",
                      caseMeta?.side === "debit"
                        ? "text-debit-text"
                        : "text-credit-text"
                    )}
                  >
                    {validAmount > 0n
                      ? caseMeta?.side === "debit"
                        ? formatRupiah(validAmount, { signDisplay: "debit" })
                        : formatRupiah(validAmount, { signDisplay: "credit" })
                      : "Rp 0"}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-surface-border pt-3">
                  <dt className="font-semibold text-neutral-900">
                    Saldo Setelah Simpan
                  </dt>
                  <dd
                    className={cn(
                      "tabular-nums text-lg font-bold",
                      BigInt(activePreview.balanceAfter) < 0n
                        ? "text-debit-text"
                        : "text-primary-800"
                    )}
                  >
                    {formatRupiah(activePreview.balanceAfter)}
                  </dd>
                </div>

                {activePreview.isBackdated && (
                  <AlertBanner variant="info" title="Transaksi Berwaktu Mundur">
                    Sistem otomatis menghitung ulang saldo berjalan pada{" "}
                    <strong>{activePreview.affectedSubsequentCount}</strong>{" "}
                    transaksi setelah waktu ini.
                  </AlertBanner>
                )}

                {previewFailedKey === previewRequestKey && (
                  <AlertBanner variant="warning">
                    Menggunakan estimasi saldo lokal sementara karena server
                    belum merespons.
                  </AlertBanner>
                )}
              </dl>
            ) : (
              <p className="text-xs text-neutral-500">
                Pilih agen untuk melihat pratinjau saldo.
              </p>
            )}
          </div>

          {/* Kartu Ekstraksi Otomatis No. Pesanan & Kode Booking */}
          <div className="rounded-lg border border-surface-border bg-surface-card p-5 shadow-card space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles
                className="h-4 w-4 text-primary-600"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-neutral-900">
                Ekstraksi Otomatis Keterangan
              </h3>
            </div>

            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-md bg-neutral-25 px-3 py-2">
                <dt className="text-neutral-500">No. Pesanan (Kunci Grup)</dt>
                <dd className="font-mono font-semibold text-neutral-900">
                  {extractedRefs.orderNumber ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-md bg-neutral-25 px-3 py-2">
                <dt className="text-neutral-500">Kode Booking</dt>
                <dd className="font-mono font-semibold text-neutral-900">
                  {extractedRefs.bookingCode ?? "—"}
                </dd>
              </div>
            </dl>

            {missingOrderWarning && (
              <AlertBanner variant="warning">
                Pola <code>No. Pesanan &lt;angka&gt;</code> belum terdeteksi.
                Transaksi tetap dapat disimpan tetapi tidak akan tergabung ke
                Struk Grup.
              </AlertBanner>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
