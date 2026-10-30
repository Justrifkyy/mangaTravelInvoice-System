"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client/api-client";
import { cn } from "@/lib/utils";

export interface LoginFormProps {
  expired?: boolean;
  nextPath?: string;
  businessName?: string;
  logoPath?: string;
}

export function LoginForm({
  expired = false,
  nextPath = "/transactions",
  businessName = "Manga' Travel",
  logoPath,
}: LoginFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{
    username?: string;
    password?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const safeRedirectTarget =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/transactions";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const nextFieldErrors: { username?: string; password?: string } = {};
    if (!username.trim()) {
      nextFieldErrors.username = "Username wajib diisi.";
    }
    if (!password) {
      nextFieldErrors.password = "Password wajib diisi.";
    }
    if (nextFieldErrors.username || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setIsSubmitting(true);
    const res = await apiFetch<{
      user?: { name: string; role: string; agentCode: string | null };
    }>("/api/auth/login", {
      method: "POST",
      body: {
        username: username.trim(),
        password,
      },
      redirectOnUnauthorized: false,
      fallbackErrorMessage: "Gagal memproses login. Silakan coba lagi.",
    });

    if (!res.ok) {
      if (res.fields) {
        setFieldErrors({
          username: res.fields.username,
          password: res.fields.password,
        });
      }
      setErrorMsg(res.message);
      setIsSubmitting(false);
      return;
    }

    toast.success(
      res.data.user?.name
        ? `Selamat datang, ${res.data.user.name}!`
        : "Berhasil masuk ke sistem."
    );
    router.push(safeRedirectTarget);
    router.refresh();
  }

  function applyDemoAccount(demoUser: string, demoPass: string) {
    setUsername(demoUser);
    setPassword(demoPass);
    setErrorMsg(null);
    setFieldErrors({});
  }

  return (
    <div className="w-full max-w-[400px] space-y-4">
      <div className="rounded-lg border border-surface-border bg-surface-card p-6 shadow-card sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo
            variant="full"
            logoSrc={logoPath}
            businessName={businessName}
          />
          <h1 className="mt-5 text-2xl font-bold leading-8 text-neutral-900">
            Masuk
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            Masuk ke Sistem Transaksi {businessName}
          </p>
        </div>

        {expired && !errorMsg && (
          <AlertBanner variant="warning" className="mb-4">
            Sesi Anda berakhir. Silakan masuk kembali.
          </AlertBanner>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="login-username"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Username
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              disabled={isSubmitting}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErrorMsg(null);
                if (fieldErrors.username) {
                  setFieldErrors((prev) => ({ ...prev, username: undefined }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={
                fieldErrors.username ? "login-username-error" : undefined
              }
              placeholder="Masukkan username"
              className={cn(
                "h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50",
                fieldErrors.username ? "border-danger" : "border-neutral-200"
              )}
            />
            {fieldErrors.username && (
              <p
                id="login-username-error"
                role="alert"
                className="mt-1 text-xs text-danger"
              >
                {fieldErrors.username}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                disabled={isSubmitting}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      password: undefined,
                    }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password ? "login-password-error" : undefined
                }
                placeholder="Masukkan password"
                className={cn(
                  "h-10 w-full rounded-md border bg-neutral-0 pl-3 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50",
                  fieldErrors.password ? "border-danger" : "border-neutral-200"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? "Sembunyikan password" : "Tampilkan password"
                }
                className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p
                id="login-password-error"
                role="alert"
                className="mt-1 text-xs text-danger"
              >
                {fieldErrors.password}
              </p>
            )}
          </div>

          {errorMsg && (
            <AlertBanner
              variant="error"
              onDismiss={() => setErrorMsg(null)}
            >
              {errorMsg}
            </AlertBanner>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            className="w-full"
          >
            Masuk
          </Button>
        </form>
      </div>

      {/* Bantuan akun bawaan (seed) untuk kemudahan pengujian lokal */}
      <div className="rounded-lg border border-surface-border bg-surface-card/80 px-4 py-3 text-xs text-neutral-500">
        <p className="font-semibold text-neutral-700">Akun bawaan (pengujian):</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => applyDemoAccount("admin", "admin123")}
            className="rounded-md border border-neutral-200 bg-neutral-0 px-2.5 py-1.5 text-left transition-colors hover:border-primary-500 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 cursor-pointer"
          >
            <span className="block font-semibold text-neutral-900">Admin</span>
            <span className="font-mono text-[11px] text-neutral-500">
              admin / admin123
            </span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => applyDemoAccount("eman", "eman123")}
            className="rounded-md border border-neutral-200 bg-neutral-0 px-2.5 py-1.5 text-left transition-colors hover:border-primary-500 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 cursor-pointer"
          >
            <span className="block font-semibold text-neutral-900">
              Agen JKT-37287
            </span>
            <span className="font-mono text-[11px] text-neutral-500">
              eman / eman123
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
