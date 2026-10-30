import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-app p-4">
      <div className="w-full max-w-md">
        <EmptyState
          variant="no_results"
          title="404 — Halaman Tidak Ditemukan"
          description="Halaman yang Anda tuju tidak tersedia atau telah dipindahkan."
          action={
            <Button asChild variant="primary">
              <Link href="/transactions">Ke Daftar Transaksi</Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}

