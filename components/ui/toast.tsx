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

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  description?: string;
  durationMs?: number;
  action?: ToastAction;
}

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  description?: string;
  durationMs: number;
  action?: ToastAction;
  createdAt: number;
}

interface ToastContextValue {
  showToast: (
    variant: ToastVariant,
    message: string,
    options?: ToastOptions
  ) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  dismissAll: () => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const DEFAULT_TOAST_DURATION_MS = 4000; // 4 detik sesuai design-spec.json > components.Toast
const ERROR_TOAST_DURATION_MS = 6000;
const MAX_VISIBLE_TOASTS = 4;
const DEDUP_WINDOW_MS = 1500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const dismissAll = React.useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = React.useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      const now = Date.now();
      const defaultDuration =
        variant === "error" || variant === "warning"
          ? ERROR_TOAST_DURATION_MS
          : DEFAULT_TOAST_DURATION_MS;
      const durationMs = options?.durationMs ?? defaultDuration;
      const id = `${now}-${Math.random().toString(36).slice(2, 7)}`;

      setToasts((prev) => {
        // Cegah duplikasi toast identik akibat klik ganda cepat
        const isDuplicate = prev.some(
          (item) =>
            item.variant === variant &&
            item.message === message &&
            item.description === options?.description &&
            now - item.createdAt < DEDUP_WINDOW_MS
        );
        if (isDuplicate) return prev;

        const next: ToastItem = {
          id,
          variant,
          message,
          description: options?.description,
          durationMs,
          action: options?.action,
          createdAt: now,
        };
        const combined = [...prev, next];
        return combined.length > MAX_VISIBLE_TOASTS
          ? combined.slice(combined.length - MAX_VISIBLE_TOASTS)
          : combined;
      });
    },
    []
  );

  const contextValue = React.useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (msg, opts) => showToast("success", msg, opts),
      error: (msg, opts) => showToast("error", msg, opts),
      warning: (msg, opts) => showToast("warning", msg, opts),
      info: (msg, opts) => showToast("info", msg, opts),
      dismissAll,
    }),
    [showToast, dismissAll]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Posisi: atas tengah di mobile, kanan atas di desktop (z-index 60) */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="no-print pointer-events-none fixed left-1/2 top-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2.5 md:left-auto md:right-6 md:top-6 md:translate-x-0"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [paused, setPaused] = React.useState(false);
  const remainingRef = React.useRef<number>(item.durationMs);
  const startedAtRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (paused) return;

    startedAtRef.current = Date.now();
    const timer = window.setTimeout(() => {
      onDismiss(item.id);
    }, Math.max(250, remainingRef.current));

    return () => {
      window.clearTimeout(timer);
      const elapsed = Date.now() - startedAtRef.current;
      remainingRef.current = Math.max(250, remainingRef.current - elapsed);
    };
  }, [paused, item.id, onDismiss]);

  const Icon =
    item.variant === "success"
      ? CheckCircle2
      : item.variant === "warning"
        ? AlertTriangle
        : item.variant === "error"
          ? AlertCircle
          : Info;

  return (
    <div
      role={
        item.variant === "error" || item.variant === "warning"
          ? "alert"
          : "status"
      }
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-lg border bg-surface-card px-4 py-3 text-sm shadow-modal transition-all",
        item.variant === "success" && "border-credit-bg",
        item.variant === "error" && "border-debit-bg",
        item.variant === "warning" && "border-warning-bg",
        item.variant === "info" && "border-info-bg"
      )}
    >
      {/* Aksen garis tepi kiri semantik */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          item.variant === "success" && "bg-success",
          item.variant === "error" && "bg-danger",
          item.variant === "warning" && "bg-warning-text",
          item.variant === "info" && "bg-info"
        )}
      />

      <div className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            item.variant === "success" && "text-success",
            item.variant === "error" && "text-danger",
            item.variant === "warning" && "text-warning-text",
            item.variant === "info" && "text-info"
          )}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold leading-5 text-neutral-900">
            {item.message}
          </p>
          {item.description && (
            <p className="text-xs leading-4 text-neutral-500">
              {item.description}
            </p>
          )}
          {item.action && (
            <button
              type="button"
              onClick={() => {
                item.action?.onClick();
                onDismiss(item.id);
              }}
              className="mt-1 inline-flex items-center text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-xs cursor-pointer"
            >
              {item.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Tutup notifikasi"
          onClick={() => onDismiss(item.id)}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast harus dipanggil di dalam ToastProvider.");
  }
  return ctx;
}
