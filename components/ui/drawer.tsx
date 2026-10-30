"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  headerBadge?: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left";
  className?: string;
  children: React.ReactNode;
}

/**
 * Komponen Drawer aksesibel (fokus terjebak, tutup dengan Esc / tombol X / klik overlay).
 * Lebar 480px di desktop, 100% layar penuh di mobile sesuai design-spec.json > components.Drawer.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  headerBadge,
  footer,
  side = "right",
  className,
  children,
}: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-neutral-900/35 transition-opacity duration-200" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 z-40 flex w-full flex-col bg-surface-card shadow-drawer focus:outline-none md:max-w-[480px]",
            side === "right"
              ? "right-0 border-l border-surface-border"
              : "left-0 border-r border-surface-border",
            className
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <DialogPrimitive.Title className="truncate text-lg font-semibold leading-7 text-neutral-900">
                {title}
              </DialogPrimitive.Title>
              {headerBadge}
            </div>
            <DialogPrimitive.Close
              aria-label="Tutup"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {description ? (
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">
              {title}
            </DialogPrimitive.Description>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

          {footer && (
            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-surface-border bg-surface-card px-5 py-4">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

