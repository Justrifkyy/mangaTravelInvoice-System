"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function GlobalSegmentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-surface-app p-4">
      <div className="w-full max-w-lg">
        <EmptyState
          variant="error"
          title="Terjadi kesalahan. Silakan coba lagi."
          description="Permintaan tidak dapat diproses saat ini. Anda dapat memuat ulang halaman atau kembali ke daftar transaksi."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Button type="button" variant="primary" onClick={() => reset()}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Coba Lagi
              </Button>
              <Button asChild variant="secondary">
                <Link href="/transactions">Ke Daftar Transaksi</Link>
              </Button>
            </div>
          }
        />
      </div>
    </main>
  );
}

