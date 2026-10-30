"use client";

export default function GlobalRootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="flex min-h-screen items-center justify-center bg-surface-app p-6 text-neutral-900">
        <div className="w-full max-w-md rounded-lg border border-surface-border bg-surface-card p-6 text-center shadow-card space-y-4">
          <h1 className="text-lg font-bold text-neutral-900">
            Terjadi kesalahan. Silakan coba lagi.
          </h1>
          <p className="text-sm text-neutral-500">
            Aplikasi mengalami kendala tak terduga saat memuat halaman utama.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-semibold text-neutral-0 hover:bg-primary-700 cursor-pointer"
          >
            Muat Ulang
          </button>
        </div>
      </body>
    </html>
  );
}

