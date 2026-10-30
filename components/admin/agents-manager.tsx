"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Lock,
  Pencil,
  Plus,
  Power,
  Search,
} from "lucide-react";
import { ActiveStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { AppAgentRecord } from "@/lib/db/types";
import { formatRupiah } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

export interface AgentsManagerProps {
  initialAgents: AppAgentRecord[];
}

export function AgentsManager({ initialAgents }: AgentsManagerProps) {
  const router = useRouter();
  const toast = useToast();

  const [agents, setAgents] = React.useState<AppAgentRecord[]>(initialAgents);
  const [prevInitial, setPrevInitial] = React.useState(initialAgents);
  if (prevInitial !== initialAgents) {
    setPrevInitial(initialAgents);
    setAgents(initialAgents);
  }

  const [search, setSearch] = React.useState("");
  const [modalMode, setModalMode] = React.useState<
    | { type: "closed" }
    | { type: "create" }
    | { type: "edit"; agent: AppAgentRecord }
    | { type: "toggle_active"; agent: AppAgentRecord }
  >({ type: "closed" });

  const [isToggling, setIsToggling] = React.useState(false);

  const filteredAgents = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [agents, search]);

  async function handleConfirmToggleActive(agent: AppAgentRecord) {
    if (isToggling) return;
    setIsToggling(true);
    const nextActive = !agent.isActive;

    try {
      const res = await fetch("/api/admin/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: agent.id,
          isActive: nextActive,
        }),
      });
      const data = (await res.json()) as {
        agent?: AppAgentRecord;
        message?: string;
      };

      if (!res.ok || !data.agent) {
        toast.error(data.message ?? "Terjadi kesalahan. Silakan coba lagi.");
        setIsToggling(false);
        return;
      }

      setAgents((prev) =>
        prev.map((a) => (a.id === data.agent!.id ? data.agent! : a))
      );
      toast.success(
        nextActive
          ? `Agen ${data.agent.code} diaktifkan.`
          : `Agen ${data.agent.code} dinonaktifkan.`
      );
      setModalMode({ type: "closed" });
      setIsToggling(false);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
      setIsToggling(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar: Pencarian + Tombol Tambah Agen */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari agen"
            placeholder="Cari kode atau nama agen"
            className="h-10 w-full rounded-md border border-neutral-200 bg-surface-card pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={() => setModalMode({ type: "create" })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Agen
        </Button>
      </div>

      {/* Tabel Agen */}
      {filteredAgents.length === 0 ? (
        <EmptyState
          variant={search ? "no_results" : "no_data"}
          title={
            search
              ? "Agen tidak ditemukan. Coba kata kunci lain."
              : "Belum ada agen terdaftar."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-surface-border bg-surface-table-header">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Kode Agen
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Nama Agen
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Saldo Awal
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Saldo Saat Ini
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Transaksi
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Pengguna
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filteredAgents.map((agent) => {
                  const currentBal = BigInt(agent.currentBalance);
                  return (
                    <tr
                      key={agent.id}
                      className="hover:bg-surface-table-hover"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-neutral-900">
                        {agent.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        {agent.name}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right text-neutral-700">
                        {formatRupiah(agent.openingBalance)}
                      </td>
                      <td
                        className={cn(
                          "tabular-nums whitespace-nowrap px-4 py-3 text-right font-semibold",
                          currentBal < 0n
                            ? "text-debit-text"
                            : "text-neutral-900"
                        )}
                      >
                        {formatRupiah(currentBal)}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right text-neutral-700">
                        {agent.transactionCount}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right text-neutral-700">
                        {agent.userCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <ActiveStatusBadge isActive={agent.isActive} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setModalMode({ type: "edit", agent })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Ubah
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setModalMode({ type: "toggle_active", agent })
                            }
                            className={cn(
                              agent.isActive
                                ? "text-debit-text hover:bg-debit-bg/40"
                                : "text-credit-text hover:bg-credit-bg/40"
                            )}
                          >
                            <Power className="h-3.5 w-3.5" aria-hidden="true" />
                            {agent.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah / Ubah Agen */}
      <Modal
        open={modalMode.type === "create" || modalMode.type === "edit"}
        onOpenChange={(open) => {
          if (!open) setModalMode({ type: "closed" });
        }}
        title={modalMode.type === "edit" ? "Ubah Agen" : "Tambah Agen Baru"}
      >
        {(modalMode.type === "create" || modalMode.type === "edit") && (
          <AgentFormInner
            key={modalMode.type === "edit" ? modalMode.agent.id : "new-agent"}
            editingAgent={
              modalMode.type === "edit" ? modalMode.agent : null
            }
            onCancel={() => setModalMode({ type: "closed" })}
            onSaved={(savedAgent, isNew) => {
              setAgents((prev) =>
                isNew
                  ? [...prev, savedAgent].sort((a, b) =>
                      a.code.localeCompare(b.code)
                    )
                  : prev.map((a) => (a.id === savedAgent.id ? savedAgent : a))
              );
              setModalMode({ type: "closed" });
              toast.success(
                isNew
                  ? `Agen ${savedAgent.code} berhasil ditambahkan.`
                  : `Agen ${savedAgent.code} berhasil diperbarui.`
              );
              router.refresh();
            }}
          />
        )}
      </Modal>

      {/* Modal Konfirmasi Nonaktifkan / Aktifkan */}
      <Modal
        open={modalMode.type === "toggle_active"}
        onOpenChange={(open) => {
          if (!open) setModalMode({ type: "closed" });
        }}
        title={
          modalMode.type === "toggle_active" && modalMode.agent.isActive
            ? "Nonaktifkan Agen"
            : "Aktifkan Agen"
        }
        footer={
          modalMode.type === "toggle_active" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={isToggling}
                onClick={() => setModalMode({ type: "closed" })}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant={modalMode.agent.isActive ? "danger" : "primary"}
                isLoading={isToggling}
                onClick={() => handleConfirmToggleActive(modalMode.agent)}
              >
                {modalMode.agent.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </>
          ) : undefined
        }
      >
        {modalMode.type === "toggle_active" && (
          <p className="text-sm text-neutral-700">
            {modalMode.agent.isActive ? (
              <>
                Nonaktifkan agen{" "}
                <strong>
                  {modalMode.agent.code} — {modalMode.agent.name}
                </strong>
                ? Riwayat transaksi tetap tersimpan, namun transaksi baru tidak
                dapat ditambahkan selama agen nonaktif.
              </>
            ) : (
              <>
                Aktifkan kembali agen{" "}
                <strong>
                  {modalMode.agent.code} — {modalMode.agent.name}
                </strong>
                ?
              </>
            )}
          </p>
        )}
      </Modal>
    </div>
  );
}

function AgentFormInner({
  editingAgent,
  onCancel,
  onSaved,
}: {
  editingAgent: AppAgentRecord | null;
  onCancel: () => void;
  onSaved: (agent: AppAgentRecord, isNew: boolean) => void;
}) {
  const isCodeLocked = Boolean(
    editingAgent && editingAgent.transactionCount > 0
  );

  const [code, setCode] = React.useState(editingAgent?.code ?? "");
  const [name, setName] = React.useState(editingAgent?.name ?? "");
  const [openingBalance, setOpeningBalance] = React.useState(
    editingAgent?.openingBalance ?? "0"
  );
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [isSaving, setIsSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});
    setIsSaving(true);

    try {
      const isNew = !editingAgent;
      const res = await fetch("/api/admin/agents", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? {
                code: code.trim().toUpperCase(),
                name: name.trim(),
                openingBalance: openingBalance.trim() || "0",
              }
            : {
                id: editingAgent.id,
                code: isCodeLocked ? undefined : code.trim().toUpperCase(),
                name: name.trim(),
              }
        ),
      });

      const data = (await res.json()) as {
        agent?: AppAgentRecord;
        message?: string;
        fields?: Record<string, string>;
      };

      if (!res.ok || !data.agent) {
        if (data.fields) setFieldErrors(data.fields);
        setErrorMsg(
          data.message ?? "Terjadi kesalahan. Silakan coba lagi."
        );
        setIsSaving(false);
        return;
      }

      onSaved(data.agent, isNew);
    } catch {
      setErrorMsg("Terjadi kesalahan. Silakan coba lagi.");
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label
          htmlFor="agent-code-input"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Kode Agen <span className="text-danger">*</span>
        </label>
        <div className="relative">
          <input
            id="agent-code-input"
            type="text"
            value={code}
            disabled={isCodeLocked}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Contoh: JKT-37287"
            aria-invalid={Boolean(fieldErrors.code)}
            aria-describedby={
              isCodeLocked
                ? "agent-code-locked-note"
                : fieldErrors.code
                  ? "agent-code-error"
                  : undefined
            }
            className={cn(
              "h-10 w-full rounded-md border px-3 font-mono text-sm uppercase text-neutral-900 placeholder:font-sans placeholder:normal-case placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500",
              isCodeLocked
                ? "border-neutral-200 bg-neutral-50 text-neutral-500 cursor-not-allowed pr-9"
                : fieldErrors.code
                  ? "border-danger bg-neutral-0"
                  : "border-neutral-200 bg-neutral-0"
            )}
          />
          {isCodeLocked && (
            <Lock
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
          )}
        </div>
        {isCodeLocked && (
          <p
            id="agent-code-locked-note"
            className="mt-1 text-xs text-neutral-500"
          >
            Kode agen dikunci karena agen ini sudah memiliki{" "}
            {editingAgent?.transactionCount} transaksi.
          </p>
        )}
        {fieldErrors.code && (
          <p id="agent-code-error" role="alert" className="mt-1 text-xs text-danger">
            {fieldErrors.code}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="agent-name-input"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Nama Agen <span className="text-danger">*</span>
        </label>
        <input
          id="agent-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Manga' Travel Jakarta"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "agent-name-error" : undefined}
          className={cn(
            "h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500",
            fieldErrors.name ? "border-danger" : "border-neutral-200"
          )}
        />
        {fieldErrors.name && (
          <p id="agent-name-error" role="alert" className="mt-1 text-xs text-danger">
            {fieldErrors.name}
          </p>
        )}
      </div>

      {!editingAgent && (
        <div>
          <label
            htmlFor="agent-opening-balance"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Saldo Awal (Rp)
          </label>
          <input
            id="agent-opening-balance"
            type="text"
            inputMode="numeric"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            placeholder="0"
            aria-invalid={Boolean(fieldErrors.openingBalance)}
            className={cn(
              "tabular-nums h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500",
              fieldErrors.openingBalance ? "border-danger" : "border-neutral-200"
            )}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Biarkan 0 jika saldo awal akan diturunkan otomatis saat impor Excel
            pertama.
          </p>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-debit-bg bg-debit-bg px-3 py-2.5 text-xs font-medium text-debit-text"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2.5 border-t border-surface-border pt-4">
        <Button
          type="button"
          variant="secondary"
          disabled={isSaving}
          onClick={onCancel}
        >
          Batal
        </Button>
        <Button type="submit" variant="primary" isLoading={isSaving}>
          Simpan
        </Button>
      </div>
    </form>
  );
}

