"use client";

import { X } from "lucide-react";
import { getTransactionCaseMeta } from "@/lib/domain/cases";
import { formatIsoDateLabel, formatRupiah } from "@/lib/domain/format";
import type { TransactionFilterQuery } from "@/lib/validation/transaction-query";

export interface FilterChipsProps {
  role: "admin" | "agent";
  query: TransactionFilterQuery;
  onRemoveChip: (patch: Partial<TransactionFilterQuery>) => void;
  onClearAll: () => void;
}

interface ChipDescriptor {
  key: string;
  label: string;
  removePatch: Partial<TransactionFilterQuery>;
}

export function FilterChips({
  role,
  query,
  onRemoveChip,
  onClearAll,
}: FilterChipsProps) {
  const chips: ChipDescriptor[] = [];

  if (query.from || query.to) {
    let val = "";
    if (query.from && query.to) {
      val = `${formatIsoDateLabel(query.from)} – ${formatIsoDateLabel(query.to)}`;
    } else if (query.from) {
      val = `Mulai ${formatIsoDateLabel(query.from)}`;
    } else if (query.to) {
      val = `Sampai ${formatIsoDateLabel(query.to)}`;
    }
    chips.push({
      key: "date",
      label: `Tanggal: ${val}`,
      removePatch: { from: "", to: "", page: 1 },
    });
  }

  for (const c of query.cases) {
    const meta = getTransactionCaseMeta(c);
    chips.push({
      key: `case-${c}`,
      label: `Case: ${meta.label}`,
      removePatch: {
        cases: query.cases.filter((item) => item !== c),
        page: 1,
      },
    });
  }

  if (query.type !== "all") {
    chips.push({
      key: "type",
      label: `Sisi: ${query.type === "debit" ? "Debet" : "Kredit"}`,
      removePatch: { type: "all", page: 1 },
    });
  }

  if (role === "admin" && query.agentCode) {
    chips.push({
      key: "agent",
      label: `Kode Agen: ${query.agentCode}`,
      removePatch: { agentCode: "", page: 1 },
    });
  }

  if (query.amountMin || query.amountMax) {
    const minStr = query.amountMin ? formatRupiah(query.amountMin) : "Rp 0";
    const maxStr = query.amountMax ? formatRupiah(query.amountMax) : "∞";
    chips.push({
      key: "amount",
      label: `Nominal: ${minStr} – ${maxStr}`,
      removePatch: { amountMin: "", amountMax: "", page: 1 },
    });
  }

  if (query.balanceMin || query.balanceMax) {
    const minStr = query.balanceMin ? formatRupiah(query.balanceMin) : "-∞";
    const maxStr = query.balanceMax ? formatRupiah(query.balanceMax) : "∞";
    chips.push({
      key: "balance",
      label: `Saldo: ${minStr} – ${maxStr}`,
      removePatch: { balanceMin: "", balanceMax: "", page: 1 },
    });
  }

  if (query.desc) {
    chips.push({
      key: "desc",
      label: `Keterangan: "${query.desc}"`,
      removePatch: { desc: "", page: 1 },
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Filter aktif"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-50 pl-3 pr-1.5 text-xs font-medium text-primary-700"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemoveChip(chip.removePatch)}
            aria-label={`Hapus filter ${chip.label}`}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-primary-700 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-xs px-1 py-0.5 cursor-pointer"
      >
        Hapus semua
      </button>
    </div>
  );
}

