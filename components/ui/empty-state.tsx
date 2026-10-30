import * as React from "react";
import {
  AlertTriangle,
  FileSpreadsheet,
  SearchX,
  ShieldAlert,
} from "lucide-react";

export interface EmptyStateProps {
  variant?: "no_data" | "no_results" | "error" | "forbidden";
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  variant = "no_results",
  title,
  description,
  action,
}: EmptyStateProps) {
  const Icon =
    variant === "no_data"
      ? FileSpreadsheet
      : variant === "error"
        ? AlertTriangle
        : variant === "forbidden"
          ? ShieldAlert
          : SearchX;

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-surface-border bg-surface-card px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-50 text-neutral-500">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-neutral-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-neutral-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

