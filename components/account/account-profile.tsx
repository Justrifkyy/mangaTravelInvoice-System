"use client";

import * as React from "react";
import { AlertCircle, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import type { SafeUserDto } from "@/app/api/admin/users/route";
import { ActiveStatusBadge, RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { AppAgentRecord } from "@/lib/db/types";
import { formatDateTimeTable, formatRupiah } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

export interface AccountProfileProps {
  user: SafeUserDto;
  linkedAgent: AppAgentRecord | null;
}

export function AccountProfile({ user, linkedAgent }: AccountProfileProps) {
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!currentPassword) {
      nextErrors.currentPassword = "Password saat ini wajib diisi.";
    }
    if (newPassword.length < 6) {
      nextErrors.newPassword = "Password baru minimal 6 karakter.";
    }
    if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "Konfirmasi password baru tidak sama.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
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

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsSaving(false);
      toast.success("Password Anda berhasil diperbarui.");
    } catch {
      setFormError("Terjadi kesalahan. Silakan coba lagi.");
      setIsSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Kartu Informasi Akun */}
      <section className="rounded-lg border border-surface-border bg-surface-card p-6 shadow-card space-y-5 lg:col-span-5">
        <div className="flex items-center justify-between gap-2 border-b border-surface-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-800 uppercase">
              {user.name.slice(0, 2)}
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">
                {user.name}
              </h2>
              <p className="font-mono text-xs text-neutral-500">
                @{user.username}
              </p>
            </div>
          </div>
          <RoleBadge role={user.role} />
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Status Akun</dt>
            <dd>
              <ActiveStatusBadge isActive={user.isActive} />
            </dd>
          </div>

          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Lingkup Data</dt>
            <dd className="font-medium text-neutral-900 text-right">
              {linkedAgent
                ? `${linkedAgent.code} — ${linkedAgent.name}`
                : "Seluruh Agen (Administrator)"}
            </dd>
          </div>

          {linkedAgent && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">Saldo Agen Saat Ini</dt>
              <dd className="tabular-nums font-bold text-primary-800">
                {formatRupiah(linkedAgent.currentBalance)}
              </dd>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Login Terakhir</dt>
            <dd className="tabular-nums text-xs text-neutral-700">
              {user.lastLoginAt
                ? formatDateTimeTable(user.lastLoginAt)
                : "Sesi aktif saat ini"}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Terdaftar Sejak</dt>
            <dd className="tabular-nums text-xs text-neutral-700">
              {formatDateTimeTable(user.createdAt)}
            </dd>
          </div>
        </dl>

        <div className="flex items-start gap-2.5 rounded-md border border-surface-border bg-neutral-25 p-3 text-xs text-neutral-500">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-primary-600"
            aria-hidden="true"
          />
          <span>
            Sesi login berakhir otomatis setelah 8 jam tanpa aktivitas demi
            keamanan akun Anda.
          </span>
        </div>
      </section>

      {/* Kartu Ubah Password Mandiri */}
      <section className="rounded-lg border border-surface-border bg-surface-card p-6 shadow-card space-y-5 lg:col-span-7">
        <div className="flex items-center gap-2 border-b border-surface-border pb-4">
          <KeyRound className="h-5 w-5 text-primary-600" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Ubah Password
            </h2>
            <p className="text-xs text-neutral-500">
              Perbarui password akun Anda secara berkala.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 max-w-md">
          <div>
            <label
              htmlFor="acc-current-password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Password Saat Ini <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                id="acc-current-password"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, currentPassword: "" }));
                }}
                aria-invalid={Boolean(fieldErrors.currentPassword)}
                className={cn(
                  "h-10 w-full rounded-md border bg-neutral-0 pl-3 pr-10 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500",
                  fieldErrors.currentPassword
                    ? "border-danger"
                    : "border-neutral-200"
                )}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={
                  showCurrent ? "Sembunyikan password" : "Tampilkan password"
                }
                className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-50 cursor-pointer"
              >
                {showCurrent ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.currentPassword && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {fieldErrors.currentPassword}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="acc-new-password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Password Baru <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                id="acc-new-password"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, newPassword: "" }));
                }}
                placeholder="Minimal 6 karakter"
                aria-invalid={Boolean(fieldErrors.newPassword)}
                className={cn(
                  "h-10 w-full rounded-md border bg-neutral-0 pl-3 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500",
                  fieldErrors.newPassword
                    ? "border-danger"
                    : "border-neutral-200"
                )}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                aria-label={
                  showNew ? "Sembunyikan password" : "Tampilkan password"
                }
                className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-50 cursor-pointer"
              >
                {showNew ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.newPassword && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {fieldErrors.newPassword}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="acc-confirm-password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Konfirmasi Password Baru <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                id="acc-confirm-password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                }}
                placeholder="Ketik ulang password baru"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                className={cn(
                  "h-10 w-full rounded-md border bg-neutral-0 pl-3 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500",
                  fieldErrors.confirmPassword
                    ? "border-danger"
                    : "border-neutral-200"
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={
                  showConfirm ? "Sembunyikan password" : "Tampilkan password"
                }
                className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-50 cursor-pointer"
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-debit-bg bg-debit-bg px-3.5 py-2.5 text-xs font-medium text-debit-text"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{formError}</span>
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Simpan Password Baru
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

