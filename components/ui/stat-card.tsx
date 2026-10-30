import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  tone?: "default" | "credit" | "debit";
  subtitle?: string;
  icon?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  tone = "default",
  subtitle,
  icon,
}: StatCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-surface-border bg-surface-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium leading-4 text-neutral-500">
          {label}
        </span>
        {icon && <div className="text-neutral-400">{icon}</div>}
      </div>
      <div className="mt-2">
        <p
          className={cn(
            "tabular-nums text-2xl font-bold leading-8 tracking-tight",
            tone === "credit" && "text-credit-text",
            tone === "debit" && "text-debit-text",
            tone === "default" && "text-neutral-900"
          )}
        >
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

