"use client";

import { RouteErrorView } from "@/components/ui/route-error-view";

export default function SettingsSegmentError({
  error,
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  return (
    <RouteErrorView
      error={error}
      retry={retry}
      reset={reset}
      fullScreen
      title="Gagal memuat halaman pengaturan."
    />
  );
}

