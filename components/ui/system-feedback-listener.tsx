"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SESSION_EXPIRED_EVENT } from "@/lib/client/api-client";

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getClientOfflineSnapshot(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function getServerOfflineSnapshot(): boolean {
  return false;
}

/**
 * Pemantau global status jaringan (offline/online) dan kedaluwarsa sesi (HTTP 401).
 * Menampilkan banner koneksi terputus serta mengarahkan pengguna ke /login?expired=1
 * lengkap dengan notifikasi toast apabila sesi berakhir saat beraktivitas.
 *
 * Catatan Next.js 16 Cache Components: sengaja tidak memanggil `usePathname()`
 * pada fase render RootLayout agar tidak memblokir prerender shell statis.
 */
export function SystemFeedbackListener() {
  const router = useRouter();
  const toast = useToast();

  const isOffline = React.useSyncExternalStore(
    subscribeOnlineStatus,
    getClientOfflineSnapshot,
    getServerOfflineSnapshot
  );

  const wasOfflineRef = React.useRef(false);
  const sessionRedirectingRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      wasOfflineRef.current = true;
    }

    function handleOffline() {
      wasOfflineRef.current = true;
      toast.warning("Koneksi jaringan terputus.", {
        description:
          "Perubahan tidak dapat disimpan sampai sambungan internet kembali aktif.",
      });
    }

    function handleOnline() {
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        toast.success("Koneksi jaringan tersambung kembali.");
      }
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [toast]);

  React.useEffect(() => {
    function handleSessionExpired(event: Event) {
      const currentPathname =
        typeof window !== "undefined" ? window.location.pathname : "";

      if (currentPathname === "/login") {
        sessionRedirectingRef.current = false;
        return;
      }

      if (sessionRedirectingRef.current) {
        return;
      }
      sessionRedirectingRef.current = true;

      const custom = event as CustomEvent<{ message?: string }>;
      const msg =
        custom.detail?.message ?? "Sesi Anda berakhir. Silakan masuk kembali.";

      toast.warning(msg);

      const currentUrl =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "";

      const params = new URLSearchParams();
      params.set("expired", "1");
      if (currentUrl && currentUrl !== "/" && currentUrl !== "/login") {
        params.set("next", currentUrl);
      }

      router.push(`/login?${params.toString()}`);
      router.refresh();

      window.setTimeout(() => {
        sessionRedirectingRef.current = false;
      }, 2500);
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [router, toast]);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="no-print sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-warning-bg bg-warning-bg px-4 py-2 text-center text-xs font-semibold text-warning-text"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Anda sedang luring (offline). Periksa koneksi jaringan sebelum menyimpan
        atau mengimpor transaksi.
      </span>
    </div>
  );
}
