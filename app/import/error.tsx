"use client";

import { RouteErrorView } from "@/components/ui/route-error-view";

export default function ImportSegmentError({
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
      title="Gagal memuat halaman impor Excel / CSV."
    />
  );
}

