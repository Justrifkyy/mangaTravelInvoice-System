"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertBannerVariant = "info" | "success" | "warning" | "error";

export interface AlertBannerProps {
  variant?: AlertBannerVariant;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function AlertBanner({
  variant = "info",
  title,
  children,
  action,
  onDismiss,
  className,
}: AlertBannerProps) {
  const Icon =
    variant === "success"
      ? CheckCircle2
      : variant === "warning"
        ? AlertTriangle
        : variant === "error"
          ? AlertCircle
          : Info;

  return (
    <div
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-xs",
        variant === "info" && "border-info-bg bg-info-bg text-info",
        variant === "success" &&
          "border-credit-bg bg-credit-bg text-credit-text",
        variant === "warning" &&
          "border-warning-bg bg-warning-bg text-warning-text",
        variant === "error" && "border-debit-bg bg-debit-bg text-debit-text",
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold leading-4">{title}</p>}
        {children && <div className="font-medium leading-4">{children}</div>}
        {action && <div className="pt-1">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pesan"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

