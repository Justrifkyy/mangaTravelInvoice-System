import { getTransactionCaseMeta } from "@/lib/domain/cases";
import { cn } from "@/lib/utils";

const CASE_BADGE_CLASSES = {
  deposit: "bg-case-deposit-bg text-case-deposit-text",
  withdrawal: "bg-case-withdrawal-bg text-case-withdrawal-text",
  bonus: "bg-case-bonus-bg text-case-bonus-text",
  unknown: "bg-case-unknown-bg text-case-unknown-text",
} as const;

export function CaseBadge({
  caseValue,
  className,
}: {
  caseValue: string;
  className?: string;
}) {
  const meta = getTransactionCaseMeta(caseValue);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium leading-4",
        CASE_BADGE_CLASSES[meta.badgeStyle],
        className
      )}
    >
      {meta.label}
    </span>
  );
}

export function RoleBadge({
  role,
  className,
}: {
  role: "admin" | "agent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium leading-4",
        role === "admin"
          ? "bg-primary-100 text-primary-800"
          : "bg-accent-lime-100 text-neutral-900",
        className
      )}
    >
      {role === "admin" ? "Admin" : "Agen"}
    </span>
  );
}

export function ActiveStatusBadge({
  isActive,
  className,
}: {
  isActive: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium leading-4",
        isActive
          ? "bg-credit-bg text-credit-text"
          : "bg-neutral-100 text-neutral-500",
        className
      )}
    >
      {isActive ? "Aktif" : "Nonaktif"}
    </span>
  );
}

export function ImportBatchStatusBadge({
  status,
  className,
}: {
  status: "previewed" | "committed" | "cancelled";
  className?: string;
}) {
  const label =
    status === "committed"
      ? "Selesai"
      : status === "cancelled"
        ? "Dibatalkan"
        : "Pratinjau";

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium leading-4",
        status === "committed" && "bg-credit-bg text-credit-text",
        status === "previewed" && "bg-warning-bg text-warning-text",
        status === "cancelled" && "bg-neutral-100 text-neutral-500",
        className
      )}
    >
      {label}
    </span>
  );
}
