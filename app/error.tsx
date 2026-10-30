"use client";

import { RouteErrorView } from "@/components/ui/route-error-view";

export default function GlobalSegmentError({
  error,
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  return <RouteErrorView error={error} retry={retry} reset={reset} fullScreen />;
}
