"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  showToast: (variant: ToastVariant, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000; // 4 detik sesuai design-spec.json > components.Toast

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = React.useCallback(
    (variant: ToastVariant, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, variant, message }]);
      window.setTimeout(() => {
        dismiss(id);
      }, TOAST_DURATION_MS);
    },
    [dismiss]
  );

  const contextValue = React.useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (msg: string) => showToast("success", msg),
      error: (msg: string) => showToast("error", msg),
      info: (msg: string) => showToast("info", msg),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Posisi: atas tengah di mobile, kanan atas di desktop */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="no-print pointer-events-none fixed left-1/2 top-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2.5 md:left-auto md:right-6 md:top-6 md:translate-x-0"
      >
        {toasts.map((item) => {
          const Icon =
            item.variant === "success"
              ? CheckCircle2
              : item.variant === "error"
                ? AlertCircle
                : Info;

          return (
            <div
              key={item.id}
              role={item.variant === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface-card px-4 py-3 text-sm shadow-modal transition-all",
                item.variant === "success" && "border-credit-bg",
                item.variant === "error" && "border-debit-bg",
                item.variant === "info" && "border-info-bg"
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  item.variant === "success" && "text-success",
                  item.variant === "error" && "text-danger",
                  item.variant === "info" && "text-info"
                )}
              />
              <p className="min-w-0 flex-1 font-medium text-neutral-900">
                {item.message}
              </p>
              <button
                type="button"
                aria-label="Tutup"
                onClick={() => dismiss(item.id)}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast harus dipanggil di dalam ToastProvider.");
  }
  return ctx;
}

