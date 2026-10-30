"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import type { AppAgentRecord } from "@/lib/db/types";
import { TRANSACTION_CASES } from "@/lib/domain/cases";
import { DEFAULT_APP_TIMEZONE } from "@/lib/domain/format";
import { parseRupiahToBigInt } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import type {
  DebitCreditFilter,
  TransactionFilterQuery,
} from "@/lib/validation/transaction-query";

export interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: "admin" | "agent";
  availableAgents: AppAgentRecord[];
  currentQuery: TransactionFilterQuery;
  onApply: (next: Partial<TransactionFilterQuery>) => void;
  onClearAll: () => void;
}

function getTodayJakartaParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

function toIsoDate(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function FilterDrawer({
  open,
  onOpenChange,
  role,
  availableAgents,
  currentQuery,
  onApply,
  onClearAll,
}: FilterDrawerProps) {
  function handleResetInsideDrawer() {
    onClearAll();
    onOpenChange(false);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filter Transaksi"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={handleResetInsideDrawer}
          >
            Hapus semua
          </Button>
          <Button type="submit" form="transaction-filter-form" variant="primary">
            Terapkan
          </Button>
        </>
      }
    >
      {/* Dipasang ulang saat Drawer dibuka sehingga nilai awal selalu sinkron dengan currentQuery */}
      <FilterDrawerForm
        role={role}
        availableAgents={availableAgents}
        currentQuery={currentQuery}
        onApply={onApply}
        onClose={() => onOpenChange(false)}
      />
    </Drawer>
  );
}

function FilterDrawerForm({
  role,
  availableAgents,
  currentQuery,
  onApply,
  onClose,
}: {
  role: "admin" | "agent";
  availableAgents: AppAgentRecord[];
  currentQuery: TransactionFilterQuery;
  onApply: (next: Partial<TransactionFilterQuery>) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = React.useState(currentQuery.from);
  const [to, setTo] = React.useState(currentQuery.to);
  const [cases, setCases] = React.useState<string[]>(currentQuery.cases);
  const [type, setType] = React.useState<DebitCreditFilter>(currentQuery.type);
  const [agentCode, setAgentCode] = React.useState(currentQuery.agentCode);
  const [agentSearch, setAgentSearch] = React.useState("");
  const [agentDropdownOpen, setAgentDropdownOpen] = React.useState(false);
  const [amountMin, setAmountMin] = React.useState(currentQuery.amountMin);
  const [amountMax, setAmountMax] = React.useState(currentQuery.amountMax);
  const [balanceMin, setBalanceMin] = React.useState(currentQuery.balanceMin);
  const [balanceMax, setBalanceMax] = React.useState(currentQuery.balanceMax);
  const [desc, setDesc] = React.useState(currentQuery.desc);
  const [dateError, setDateError] = React.useState<string | null>(null);

  function applyDatePreset(
    preset: "today" | "last7" | "thisMonth" | "lastMonth"
  ) {
    const { year, month, day } = getTodayJakartaParts();
    setDateError(null);

    if (preset === "today") {
      const todayStr = toIsoDate(year, month, day);
      setFrom(todayStr);
      setTo(todayStr);
      return;
    }

    if (preset === "last7") {
      setFrom(toIsoDate(year, month, day - 6));
      setTo(toIsoDate(year, month, day));
      return;
    }

    if (preset === "thisMonth") {
      setFrom(toIsoDate(year, month, 1));
      setTo(toIsoDate(year, month, day));
      return;
    }

    if (preset === "lastMonth") {
      const firstPrev = toIsoDate(year, month - 1, 1);
      const lastPrev = toIsoDate(year, month, 0);
      setFrom(firstPrev);
      setTo(lastPrev);
    }
  }

  function toggleCase(val: string) {
    setCases((prev) =>
      prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (from && to && from > to) {
      setDateError("Tanggal awal tidak boleh setelah tanggal akhir.");
      return;
    }
    setDateError(null);

    const parsedAmtMin =
      amountMin.trim() !== ""
        ? parseRupiahToBigInt(amountMin, {
            allowNegative: false,
            emptyAsZero: false,
          })
        : null;
    const parsedAmtMax =
      amountMax.trim() !== ""
        ? parseRupiahToBigInt(amountMax, {
            allowNegative: false,
            emptyAsZero: false,
          })
        : null;
    const parsedBalMin =
      balanceMin.trim() !== ""
        ? parseRupiahToBigInt(balanceMin, {
            allowNegative: true,
            emptyAsZero: false,
          })
        : null;
    const parsedBalMax =
      balanceMax.trim() !== ""
        ? parseRupiahToBigInt(balanceMax, {
            allowNegative: true,
            emptyAsZero: false,
          })
        : null;

    onApply({
      from,
      to,
      cases,
      type,
      agentCode: role === "admin" ? agentCode : "",
      amountMin: parsedAmtMin !== null ? parsedAmtMin.toString() : "",
      amountMax: parsedAmtMax !== null ? parsedAmtMax.toString() : "",
      balanceMin: parsedBalMin !== null ? parsedBalMin.toString() : "",
      balanceMax: parsedBalMax !== null ? parsedBalMax.toString() : "",
      desc: desc.trim(),
      page: 1,
    });
    onClose();
  }

  const filteredAgents = availableAgents.filter((a) => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  });

  return (
    <form
      id="transaction-filter-form"
      onSubmit={handleSubmit}
      className="space-y-6"
    >
        {/* 1. Tanggal */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-900">
              Tanggal
            </span>
            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setDateError(null);
                }}
                className="text-xs font-medium text-primary-600 hover:underline cursor-pointer"
              >
                Kosongkan
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "today", label: "Hari ini" },
                { id: "last7", label: "7 hari terakhir" },
                { id: "thisMonth", label: "Bulan ini" },
                { id: "lastMonth", label: "Bulan lalu" },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDatePreset(preset.id)}
                className="rounded-full border border-neutral-200 bg-neutral-0 px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="filter-date-from"
                className="mb-1 block text-xs font-medium text-neutral-700"
              >
                Tanggal awal
              </label>
              <input
                id="filter-date-from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setDateError(null);
                }}
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? "filter-date-error" : undefined}
                className={cn(
                  "h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500",
                  dateError ? "border-danger" : "border-neutral-200"
                )}
              />
            </div>
            <div>
              <label
                htmlFor="filter-date-to"
                className="mb-1 block text-xs font-medium text-neutral-700"
              >
                Tanggal akhir
              </label>
              <input
                id="filter-date-to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setDateError(null);
                }}
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? "filter-date-error" : undefined}
                className={cn(
                  "h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500",
                  dateError ? "border-danger" : "border-neutral-200"
                )}
              />
            </div>
          </div>

          {dateError && (
            <p id="filter-date-error" role="alert" className="text-xs text-danger">
              {dateError}
            </p>
          )}
        </section>

        {/* 2. Jenis (Case) */}
        <fieldset className="space-y-2.5 border-t border-surface-border pt-5">
          <legend className="text-sm font-semibold text-neutral-900">
            Jenis (Case)
          </legend>
          <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3">
            {TRANSACTION_CASES.map((item) => {
              const checked = cases.includes(item.value);
              return (
                <label
                  key={item.value}
                  className={cn(
                    "flex h-10 cursor-pointer items-center gap-2.5 rounded-md border px-3 text-sm font-medium transition-colors",
                    checked
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-neutral-200 bg-neutral-0 text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCase(item.value)}
                    className="h-4 w-4 rounded-xs border-neutral-200 accent-primary-600 focus:ring-primary-500"
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* 3. Debet / Kredit */}
        <fieldset className="space-y-2.5 border-t border-surface-border pt-5">
          <legend className="text-sm font-semibold text-neutral-900">
            Debet / Kredit
          </legend>
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {(
              [
                { value: "all", label: "Semua" },
                { value: "debit", label: "Debet" },
                { value: "credit", label: "Kredit" },
              ] as const
            ).map((opt) => {
              const selected = type === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                    selected
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-neutral-200 bg-neutral-0 text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  <input
                    type="radio"
                    name="debit-credit-filter"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setType(opt.value)}
                    className="sr-only"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* 4. Kode Agen (HANYA Admin — F-03 > criteria.agent_code.rule) */}
        {role === "admin" && (
          <section className="space-y-2 border-t border-surface-border pt-5">
            <label
              htmlFor="filter-agent-combobox"
              className="block text-sm font-semibold text-neutral-900"
            >
              Kode Agen
            </label>
            <div className="relative">
              <button
                id="filter-agent-combobox"
                type="button"
                aria-expanded={agentDropdownOpen}
                onClick={() => setAgentDropdownOpen((v) => !v)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-neutral-200 bg-neutral-0 px-3 text-left text-sm text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                <span className={cn(!agentCode && "text-neutral-400")}>
                  {agentCode
                    ? `${agentCode} — ${
                        availableAgents.find((a) => a.code === agentCode)
                          ?.name ?? ""
                      }`
                    : "Ketik atau pilih kode agen"}
                </span>
                <ChevronsUpDown
                  className="h-4 w-4 shrink-0 text-neutral-400"
                  aria-hidden="true"
                />
              </button>

              {agentDropdownOpen && (
                <div className="mt-1.5 rounded-md border border-neutral-200 bg-neutral-0 p-2 shadow-card">
                  <input
                    type="text"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder="Ketik atau pilih kode agen"
                    aria-label="Cari kode agen"
                    className="mb-1.5 h-9 w-full rounded-md border border-neutral-200 px-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto" role="listbox">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setAgentCode("");
                          setAgentDropdownOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                      >
                        <span>Semua agen</span>
                        {!agentCode && (
                          <Check className="h-4 w-4 text-primary-600" />
                        )}
                      </button>
                    </li>
                    {filteredAgents.map((agent) => (
                      <li key={agent.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setAgentCode(agent.code);
                            setAgentDropdownOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-sm text-neutral-900 hover:bg-primary-50 cursor-pointer"
                        >
                          <span>
                            <strong className="font-semibold">
                              {agent.code}
                            </strong>{" "}
                            <span className="text-neutral-500">
                              — {agent.name}
                            </span>
                          </span>
                          {agentCode === agent.code && (
                            <Check className="h-4 w-4 text-primary-600" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 5. Nominal (min-max) */}
        <section className="space-y-2 border-t border-surface-border pt-5">
          <span className="block text-sm font-semibold text-neutral-900">
            Nominal (Rp)
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="filter-amount-min"
                className="mb-1 block text-xs font-medium text-neutral-700"
              >
                Nominal minimum
              </label>
              <input
                id="filter-amount-min"
                type="text"
                inputMode="numeric"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder="Contoh: 25000"
                className="tabular-nums h-10 w-full rounded-md border border-neutral-200 bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label
                htmlFor="filter-amount-max"
                className="mb-1 block text-xs font-medium text-neutral-700"
              >
                Nominal maksimum
              </label>
              <input
                id="filter-amount-max"
                type="text"
                inputMode="numeric"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="Contoh: 5000000"
                className="tabular-nums h-10 w-full rounded-md border border-neutral-200 bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </section>

        {/* 6. Saldo (min-max) */}
        <section className="space-y-2 border-t border-surface-border pt-5">
          <span className="block text-sm font-semibold text-neutral-900">
            Saldo (Rp)
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="filter-balance-min"
                className="mb-1 block text-xs font-medium text-neutral-700"
              >
                Saldo minimum
              </label>
              <input
                id="filter-balance-min"
                type="text"
                inputMode="numeric"
                value={balanceMin}
                onChange={(e) => setBalanceMin(e.target.value)}
                placeholder="Contoh: 500000"
                className="tabular-nums h-10 w-full rounded-md border border-neutral-200 bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label
                htmlFor="filter-balance-max"
                className="mb-1 block text-xs font-medium text-neutral-700"
              >
                Saldo maksimum
              </label>
              <input
                id="filter-balance-max"
                type="text"
                inputMode="numeric"
                value={balanceMax}
                onChange={(e) => setBalanceMax(e.target.value)}
                placeholder="Contoh: 50000000"
                className="tabular-nums h-10 w-full rounded-md border border-neutral-200 bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </section>

        {/* 7. Keterangan mengandung */}
        <section className="space-y-2 border-t border-surface-border pt-5">
          <label
            htmlFor="filter-desc-contains"
            className="block text-sm font-semibold text-neutral-900"
          >
            Keterangan mengandung
          </label>
          <input
            id="filter-desc-contains"
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Contoh: Issued Flight atau AUTO-TOPUP"
            className="h-10 w-full rounded-md border border-neutral-200 bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </section>
    </form>
  );
}
