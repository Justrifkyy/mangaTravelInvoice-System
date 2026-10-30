import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-app p-4">
      <div className="w-full max-w-md">
        <EmptyState
          variant="forbidden"
          title="403 — Akses Ditolak"
          description="Anda tidak memiliki akses ke halaman ini."
          action={
            <Button asChild variant="primary">
              <Link href="/transactions">Kembali ke Transaksi</Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}

