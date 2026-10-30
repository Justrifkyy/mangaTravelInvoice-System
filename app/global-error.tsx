"use client";

import * as React from "react";
import Link from "next/link";
import "./globals.css";

export default function GlobalRootError({
  error,
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  React.useEffect(() => {
    console.error("[GlobalRootError]", error);
  }, [error]);

  const digest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string"
      ? (error as { digest: string }).digest
      : null;

  function handleRecover() {
    if (retry) {
      retry();
    } else if (reset) {
      reset();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <html lang="id">
      <head>
        <title>Terjadi Kesalahan — Manga&apos; Travel</title>
      </head>
      <body className="flex min-h-screen items-center justify-center bg-surface-app p-6 text-neutral-900">
        <div className="w-full max-w-md rounded-lg border border-surface-border bg-surface-card p-6 text-center shadow-card space-y-4">
          <h1 className="text-lg font-bold text-neutral-900">
            Terjadi kesalahan. Silakan coba lagi.
          </h1>
          <p className="text-sm text-neutral-500">
            Aplikasi mengalami kendala tak terduga saat memuat halaman utama.
          </p>
          {digest && (
            <p className="text-xs text-neutral-500">
              Kode referensi:{" "}
              <code className="font-mono font-semibold text-neutral-700">
                {digest}
              </code>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleRecover}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-semibold text-neutral-0 hover:bg-primary-700 cursor-pointer"
            >
              Muat Ulang
            </button>
            <Link
              href="/transactions"
              className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-200 bg-neutral-0 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Ke Daftar Transaksi
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
