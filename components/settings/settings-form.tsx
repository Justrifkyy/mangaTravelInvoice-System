"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ImagePlus, RotateCcw } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ReceiptBusinessSettings } from "@/lib/domain/receipt";
import { cn } from "@/lib/utils";

const DEFAULT_LOGO_PATH = "/brand/logo.svg";
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export interface SettingsFormProps {
  initialSettings: ReceiptBusinessSettings;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const router = useRouter();
  const toast = useToast();
  const logoInputRef = React.useRef<HTMLInputElement | null>(null);

  const [businessName, setBusinessName] = React.useState(
    initialSettings.businessName
  );
  const [logoPath, setLogoPath] = React.useState(initialSettings.logoPath);
  const [contactPersonName, setContactPersonName] = React.useState(
    initialSettings.contactPersonName
  );
  const [contactPersonPhone, setContactPersonPhone] = React.useState(
    initialSettings.contactPersonPhone
  );
  const [address, setAddress] = React.useState(initialSettings.address ?? "");
  const [receiptFooterNote, setReceiptFooterNote] = React.useState(
    initialSettings.receiptFooterNote ?? ""
  );
  const [showBalanceOnReceipt, setShowBalanceOnReceipt] = React.useState(
    initialSettings.showBalanceOnReceipt
  );
  const [showThermalLogo, setShowThermalLogo] = React.useState(
    initialSettings.showThermalLogo
  );

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ];
    if (!allowedTypes.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        logoPath: "Format gambar harus PNG, JPEG, WebP, atau SVG.",
      }));
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setFieldErrors((prev) => ({
        ...prev,
        logoPath: "Ukuran file logo maksimum 2 MB.",
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoPath(reader.result);
        setFieldErrors((prev) => ({ ...prev, logoPath: "" }));
      }
    };
    reader.onerror = () => {
      setFieldErrors((prev) => ({
        ...prev,
        logoPath: "Gagal membaca file gambar.",
      }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!businessName.trim()) {
      nextErrors.businessName = "Nama usaha wajib diisi.";
    }
    if (!contactPersonName.trim()) {
      nextErrors.contactPersonName = "Nama contact person wajib diisi.";
    }
    if (!contactPersonPhone.trim()) {
      nextErrors.contactPersonPhone =
        "Nomor telepon contact person wajib diisi.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          logoPath: logoPath || DEFAULT_LOGO_PATH,
          contactPersonName: contactPersonName.trim(),
          contactPersonPhone: contactPersonPhone.trim(),
          address: address.trim() || null,
          receiptFooterNote: receiptFooterNote.trim() || null,
          showBalanceOnReceipt,
          showThermalLogo,
        }),
      });

      const data = (await res.json()) as {
        message?: string;
        fields?: Record<string, string>;
      };

      if (!res.ok) {
        if (data.fields) setFieldErrors(data.fields);
        setFormError(
          data.message ?? "Terjadi kesalahan. Silakan coba lagi."
        );
        setIsSaving(false);
        return;
      }

      setIsSaving(false);
      toast.success("Pengaturan berhasil disimpan.");
      router.refresh();
    } catch {
      setFormError("Terjadi kesalahan. Silakan coba lagi.");
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row">
      {/* Form Kartu Pengaturan */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-[620px] rounded-lg border border-surface-border bg-surface-card p-6 shadow-card space-y-6"
      >
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            Profil Usaha &amp; Kop Struk
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Informasi di bawah ini ditampilkan pada setiap cetakan struk thermal
            58mm, 80mm, maupun dokumen A4.
          </p>
        </div>

        {/* Unggah Logo */}
        <section className="space-y-3 border-b border-surface-border pb-5">
          <span className="block text-sm font-medium text-neutral-700">
            Logo Usaha
          </span>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-44 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-25 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPath || DEFAULT_LOGO_PATH}
                alt="Pratinjau logo usaha"
                className="max-h-16 max-w-full object-contain"
              />
            </div>

            <div className="space-y-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoSelect}
                className="sr-only"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                  Unggah Logo
                </Button>
                {logoPath !== DEFAULT_LOGO_PATH && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoPath(DEFAULT_LOGO_PATH)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Logo Bawaan
                  </Button>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                Format PNG, JPEG, WebP, atau SVG (maks. 2 MB). Disarankan latar
                transparan.
              </p>
              {fieldErrors.logoPath && (
                <p role="alert" className="text-xs text-danger">
                  {fieldErrors.logoPath}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Nama Usaha */}
        <div>
          <label
            htmlFor="settings-business-name"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Nama Usaha <span className="text-danger">*</span>
          </label>
          <input
            id="settings-business-name"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.businessName)}
            className={cn(
              "h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500",
              fieldErrors.businessName ? "border-danger" : "border-neutral-200"
            )}
          />
          {fieldErrors.businessName && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {fieldErrors.businessName}
            </p>
          )}
        </div>

        {/* Contact Person: Nama & Nomor Telepon */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="settings-cp-name"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Nama Contact Person <span className="text-danger">*</span>
            </label>
            <input
              id="settings-cp-name"
              type="text"
              value={contactPersonName}
              onChange={(e) => setContactPersonName(e.target.value)}
              placeholder="Contoh: Layanan Manga' Travel"
              aria-invalid={Boolean(fieldErrors.contactPersonName)}
              className={cn(
                "h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500",
                fieldErrors.contactPersonName
                  ? "border-danger"
                  : "border-neutral-200"
              )}
            />
            {fieldErrors.contactPersonName && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {fieldErrors.contactPersonName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="settings-cp-phone"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Nomor Telepon Contact Person <span className="text-danger">*</span>
            </label>
            <input
              id="settings-cp-phone"
              type="tel"
              value={contactPersonPhone}
              onChange={(e) => setContactPersonPhone(e.target.value)}
              placeholder="Contoh: 0812-0000-0000"
              aria-invalid={Boolean(fieldErrors.contactPersonPhone)}
              className={cn(
                "tabular-nums h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500",
                fieldErrors.contactPersonPhone
                  ? "border-danger"
                  : "border-neutral-200"
              )}
            />
            {fieldErrors.contactPersonPhone && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {fieldErrors.contactPersonPhone}
              </p>
            )}
          </div>
        </div>

        {/* Alamat (Opsional) */}
        <div>
          <label
            htmlFor="settings-address"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Alamat Usaha (Opsional)
          </label>
          <textarea
            id="settings-address"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Kosongkan jika alamat tidak ingin ditampilkan pada struk"
            className="w-full rounded-md border border-neutral-200 bg-neutral-0 p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Catatan Footer Struk */}
        <div>
          <label
            htmlFor="settings-footer-note"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Catatan Footer Struk (Opsional)
          </label>
          <input
            id="settings-footer-note"
            type="text"
            value={receiptFooterNote}
            onChange={(e) => setReceiptFooterNote(e.target.value)}
            placeholder="Contoh: Terima kasih atas kepercayaan Anda."
            className="h-10 w-full rounded-md border border-neutral-200 bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Opsi Toggle Struk */}
        <section className="space-y-3 border-t border-surface-border pt-5">
          <span className="block text-sm font-semibold text-neutral-900">
            Opsi Tampilan Struk
          </span>

          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-surface-border bg-neutral-25 p-3.5">
            <div>
              <span className="block text-sm font-medium text-neutral-900">
                Tampilkan saldo di struk
              </span>
              <span className="block text-xs text-neutral-500">
                Jika diaktifkan, struk individual menampilkan saldo berjalan
                setelah transaksi. Matikan bila struk diberikan ke penumpang
                akhir.
              </span>
            </div>
            <input
              type="checkbox"
              checked={showBalanceOnReceipt}
              onChange={(e) => setShowBalanceOnReceipt(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded-xs accent-primary-600"
            />
          </label>

          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-surface-border bg-neutral-25 p-3.5">
            <div>
              <span className="block text-sm font-medium text-neutral-900">
                Tampilkan logo pada struk thermal (default)
              </span>
              <span className="block text-xs text-neutral-500">
                Menampilkan logo hitam-putih (grayscale) pada kertas thermal
                58mm dan 80mm.
              </span>
            </div>
            <input
              type="checkbox"
              checked={showThermalLogo}
              onChange={(e) => setShowThermalLogo(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded-xs accent-primary-600"
            />
          </label>
        </section>

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-debit-bg bg-debit-bg px-3.5 py-2.5 text-xs font-medium text-debit-text"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <div className="flex justify-end border-t border-surface-border pt-4">
          <Button type="submit" variant="primary" isLoading={isSaving}>
            Simpan
          </Button>
        </div>
      </form>

      {/* Pratinjau Kop Struk Live */}
      <aside
        aria-label="Pratinjau kop struk"
        className="w-full max-w-[620px] lg:w-[340px] lg:shrink-0 space-y-3"
      >
        <div className="rounded-lg border border-surface-border bg-surface-card p-5 shadow-card space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              Pratinjau Kop Struk Thermal
            </h3>
            <p className="text-xs text-neutral-500">
              Simulasi tampilan kop &amp; footer pada kertas 80mm.
            </p>
          </div>

          <div className="mx-auto w-full max-w-[270px] rounded-sm border border-neutral-200 bg-neutral-0 p-4 font-mono text-[11px] leading-4 text-neutral-900 shadow-2xs">
            <div className="text-center space-y-1">
              {showThermalLogo && (
                <div className="mx-auto mb-1 w-1/2">
                  <BrandLogo
                    variant="thermal"
                    logoSrc={logoPath || DEFAULT_LOGO_PATH}
                    businessName={businessName || "Manga' Travel"}
                  />
                </div>
              )}
              <p className="font-bold text-xs">
                {businessName.trim() || "Nama Usaha"}
              </p>
              <p className="break-words">
                CP: {contactPersonName.trim() || "—"} -{" "}
                {contactPersonPhone.trim() || "—"}
              </p>
              {address.trim() && (
                <p className="break-words">{address.trim()}</p>
              )}
            </div>

            <div className="my-2 border-t border-dashed border-neutral-900" />
            <p className="text-center font-bold">STRUK TRANSAKSI</p>
            <div className="my-2 border-t border-dashed border-neutral-900" />

            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>DEBET</span>
                <span className="tabular-nums font-bold">Rp 2.117.756</span>
              </div>
              {showBalanceOnReceipt && (
                <div className="flex justify-between text-neutral-700">
                  <span>Saldo</span>
                  <span className="tabular-nums">Rp 650.719</span>
                </div>
              )}
            </div>

            <div className="my-2 border-t border-dashed border-neutral-900" />
            <div className="text-center space-y-0.5">
              <p>Oleh: Admin</p>
              {receiptFooterNote.trim() && (
                <p className="pt-1 font-medium break-words">
                  {receiptFooterNote.trim()}
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

