"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export interface RouteErrorViewProps {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
  title?: string;
  description?: string;
  fullScreen?: boolean;
}

function extractDigest(err: unknown): string | null {
  if (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.trim()
  ) {
    return (err as { digest: string }).digest.trim();
  }
  return null;
}

function isLikelyDatabaseError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("can't reach database server") ||
    msg.includes("prismaclientinitializationerror") ||
    msg.includes("econnrefused") ||
    msg.includes("database")
  );
}

export function RouteErrorView({
  error,
  retry,
  reset,
  title = "Terjadi kesalahan. Silakan coba lagi.",
  description,
  fullScreen = false,
}: RouteErrorViewProps) {
  const [isRecovering, startTransition] = React.useTransition();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    console.error("[RouteErrorBoundary]", error);
  }, [error]);

  const digest = extractDigest(error);
  const dbIssue = isLikelyDatabaseError(error);

  const effectiveDescription =
    description ??
    (dbIssue
      ? "Koneksi ke database sedang terganggu. Pastikan layanan MySQL aktif lalu klik Coba Lagi."
      : "Permintaan tidak dapat diproses saat ini. Anda dapat mencoba memuat ulang bagian ini atau kembali ke daftar transaksi.");

  function handleRetry() {
    startTransition(() => {
      if (retry) {
        retry();
      } else if (reset) {
        reset();
      } else if (typeof window !== "undefined") {
        window.location.reload();
      }
    });
  }

  async function handleCopyDigest() {
    if (!digest || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Abaikan bila clipboard tidak diizinkan
    }
  }

  const content = (
    <div className="w-full max-w-lg space-y-3">
      <EmptyState
        variant="error"
        title={title}
        description={effectiveDescription}
        action={
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Button
                type="button"
                variant="primary"
                isLoading={isRecovering}
                onClick={handleRetry}
              >
                {!isRecovering && (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                )}
                Coba Lagi
              </Button>
              <Button asChild variant="secondary">
                <Link href="/transactions">Ke Daftar Transaksi</Link>
              </Button>
            </div>

            {digest && (
              <div className="inline-flex items-center gap-2 rounded-md border border-surface-border bg-neutral-25 px-3 py-1.5 text-xs text-neutral-500">
                <span>
                  Kode referensi:{" "}
                  <code className="font-mono font-semibold text-neutral-700">
                    {digest}
                  </code>
                </span>
                <button
                  type="button"
                  onClick={handleCopyDigest}
                  aria-label="Salin kode referensi error"
                  className="inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 font-medium text-primary-600 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        }
      />
    </div>
  );

  if (fullScreen) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-surface-app p-4">
        {content}
      </main>
    );
  }

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
      {content}
    </div>
  );
}

