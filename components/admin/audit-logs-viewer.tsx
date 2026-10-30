"use client";

import * as React from "react";
import { RefreshCw, Search } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IndeterminateProgressBar } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client/api-client";
import type { AppAuditLogRecord } from "@/lib/db/types";
import { formatDateTimeTable, formatRupiah } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

type ActionCategory =
  | "all"
  | "auth"
  | "transactions"
  | "receipts"
  | "users_agents"
  | "settings";

interface ActionMeta {
  label: string;
  category: Exclude<ActionCategory, "all">;
  badgeClass: string;
}

const ACTION_META_MAP: Record<string, ActionMeta> = {
  login: {
    label: "Login Berhasil",
    category: "auth",
    badgeClass: "bg-credit-bg text-credit-text",
  },
  logout: {
    label: "Logout",
    category: "auth",
    badgeClass: "bg-neutral-100 text-neutral-700",
  },
  login_failed: {
    label: "Login Gagal",
    category: "auth",
    badgeClass: "bg-debit-bg text-debit-text",
  },
  create_transaction: {
    label: "Input Transaksi",
    category: "transactions",
    badgeClass: "bg-primary-100 text-primary-800",
  },
  import_commit: {
    label: "Impor Selesai",
    category: "transactions",
    badgeClass: "bg-credit-bg text-credit-text",
  },
  import_cancel: {
    label: "Impor Dibatalkan",
    category: "transactions",
    badgeClass: "bg-neutral-100 text-neutral-500",
  },
  print_receipt: {
    label: "Cetak Struk",
    category: "receipts",
    badgeClass: "bg-accent-lime-100 text-neutral-900",
  },
  user_create: {
    label: "Tambah Pengguna",
    category: "users_agents",
    badgeClass: "bg-primary-100 text-primary-800",
  },
  user_update: {
    label: "Ubah Pengguna",
    category: "users_agents",
    badgeClass: "bg-info-bg text-info",
  },
  change_own_password: {
    label: "Ganti Password",
    category: "users_agents",
    badgeClass: "bg-info-bg text-info",
  },
  agent_create: {
    label: "Tambah Agen",
    category: "users_agents",
    badgeClass: "bg-primary-100 text-primary-800",
  },
  agent_update: {
    label: "Ubah Agen",
    category: "users_agents",
    badgeClass: "bg-info-bg text-info",
  },
  setting_update: {
    label: "Ubah Pengaturan",
    category: "settings",
    badgeClass: "bg-warning-bg text-warning-text",
  },
};

function getActionMeta(action: string): ActionMeta {
  return (
    ACTION_META_MAP[action] ?? {
      label: action,
      category: "settings",
      badgeClass: "bg-neutral-100 text-neutral-700",
    }
  );
}

function summarizeMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "—";
  const parts: string[] = [];

  if (typeof metadata.agentCode === "string") {
    parts.push(`Agen: ${metadata.agentCode}`);
  }
  if (typeof metadata.username === "string") {
    parts.push(`Username: ${metadata.username}`);
  }
  if (typeof metadata.code === "string") {
    parts.push(`Kode: ${metadata.code}`);
  }
  if (typeof metadata.case === "string") {
    parts.push(`Case: ${metadata.case}`);
  }
  if (typeof metadata.debit === "string" && metadata.debit !== "0") {
    parts.push(`Debet: ${formatRupiah(metadata.debit)}`);
  }
  if (typeof metadata.credit === "string" && metadata.credit !== "0") {
    parts.push(`Kredit: ${formatRupiah(metadata.credit)}`);
  }
  if (typeof metadata.mode === "string") {
    parts.push(
      `Mode: ${metadata.mode === "group" ? "Struk Grup" : "Struk Individual"}`
    );
  }
  if (typeof metadata.size === "string") {
    parts.push(
      `Kertas: ${metadata.size === "a4" ? "A4" : `${metadata.size}mm`}`
    );
  }
  if (typeof metadata.fileName === "string") {
    parts.push(`File: ${metadata.fileName}`);
  }
  if (typeof metadata.importedCount === "number") {
    parts.push(`${metadata.importedCount} diimpor`);
  }
  if (
    typeof metadata.duplicateSkippedCount === "number" &&
    metadata.duplicateSkippedCount > 0
  ) {
    parts.push(`${metadata.duplicateSkippedCount} duplikat`);
  }
  if (typeof metadata.passwordReset === "boolean" && metadata.passwordReset) {
    parts.push("Reset password");
  }

  if (parts.length > 0) return parts.join(" • ");
  return Object.entries(metadata)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" • ");
}

export interface AuditLogsViewerProps {
  initialLogs: AppAuditLogRecord[];
}

export function AuditLogsViewer({ initialLogs }: AuditLogsViewerProps) {
  const toast = useToast();

  const [logs, setLogs] = React.useState<AppAuditLogRecord[]>(initialLogs);
  const [prevInitial, setPrevInitial] = React.useState(initialLogs);
  if (prevInitial !== initialLogs) {
    setPrevInitial(initialLogs);
    setLogs(initialLogs);
  }

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<ActionCategory>("all");
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);

  async function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError(null);

    const res = await apiFetch<{ logs?: AppAuditLogRecord[] }>(
      "/api/admin/audit-logs?limit=200"
    );

    if (!res.ok) {
      setRefreshError(res.message);
      toast.error(res.message);
      setIsRefreshing(false);
      return;
    }

    if (res.data.logs) {
      setLogs(res.data.logs);
    }
    toast.info("Log audit diperbarui.");
    setIsRefreshing(false);
  }

  const filteredLogs = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      const meta = getActionMeta(log.action);
      if (category !== "all" && meta.category !== category) {
        return false;
      }
      if (!q) return true;

      const summary = summarizeMetadata(log.metadata).toLowerCase();
      return (
        meta.label.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.entity.toLowerCase().includes(q) ||
        (log.entityId?.toLowerCase().includes(q) ?? false) ||
        (log.username?.toLowerCase().includes(q) ?? false) ||
        (log.userName?.toLowerCase().includes(q) ?? false) ||
        summary.includes(q)
      );
    });
  }, [logs, category, search]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari log audit"
              placeholder="Cari pelaku, aksi, atau entitas"
              className="h-10 w-full rounded-md border border-neutral-200 bg-surface-card pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ActionCategory)}
            aria-label="Filter kategori aksi"
            className="h-10 rounded-md border border-neutral-200 bg-surface-card px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Semua Kategori Aksi</option>
            <option value="auth">Autentikasi (Login / Logout)</option>
            <option value="transactions">Transaksi &amp; Impor</option>
            <option value="receipts">Cetak Struk</option>
            <option value="users_agents">Pengguna &amp; Agen</option>
            <option value="settings">Pengaturan</option>
          </select>
        </div>

        <Button
          type="button"
          variant="secondary"
          isLoading={isRefreshing}
          onClick={handleRefresh}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Muat Ulang
        </Button>
      </div>

      {refreshError && (
        <AlertBanner
          variant="error"
          onDismiss={() => setRefreshError(null)}
        >
          {refreshError}
        </AlertBanner>
      )}

      {/* Tabel Log Audit */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          variant={search || category !== "all" ? "no_results" : "no_data"}
          title={
            search || category !== "all"
              ? "Data tidak ditemukan. Coba ubah atau hapus filter."
              : "Belum ada aktivitas tercatat."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-card">
          {isRefreshing && (
            <IndeterminateProgressBar label="Memuat ulang log audit..." />
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-surface-border bg-surface-table-header">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Waktu
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Pelaku
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Aksi
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Entitas
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Rincian
                  </th>
                </tr>
              </thead>
              <tbody
                className={cn(
                  "divide-y divide-surface-border transition-opacity",
                  isRefreshing && "opacity-65"
                )}
              >
                {filteredLogs.map((log) => {
                  const meta = getActionMeta(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-surface-table-hover">
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-xs text-neutral-700">
                        {formatDateTimeTable(log.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {log.userName ? (
                          <div>
                            <p className="font-medium text-neutral-900">
                              {log.userName}
                            </p>
                            <p className="font-mono text-xs text-neutral-500">
                              @{log.username}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-500">
                            Tamu / Sistem
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
                            meta.badgeClass
                          )}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-700">
                        {log.entity}
                        {log.entityId ? ` #${log.entityId}` : ""}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-700">
                        {summarizeMetadata(log.metadata)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
