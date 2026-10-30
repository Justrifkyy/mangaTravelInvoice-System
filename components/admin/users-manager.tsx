"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
} from "lucide-react";
import type { SafeUserDto } from "@/app/api/admin/users/route";
import { AlertBanner } from "@/components/ui/alert-banner";
import { ActiveStatusBadge, RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { IndeterminateProgressBar } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client/api-client";
import type { AppAgentRecord, UserRoleType } from "@/lib/db/types";
import { formatDateTimeTable } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

export interface UsersManagerProps {
  currentUserId: string;
  initialUsers: SafeUserDto[];
  agents: AppAgentRecord[];
}

export function UsersManager({
  currentUserId,
  initialUsers,
  agents,
}: UsersManagerProps) {
  const router = useRouter();
  const toast = useToast();
  const [isRefreshing, startRefreshTransition] = React.useTransition();

  const [users, setUsers] = React.useState<SafeUserDto[]>(initialUsers);
  const [prevInitial, setPrevInitial] = React.useState(initialUsers);
  if (prevInitial !== initialUsers) {
    setPrevInitial(initialUsers);
    setUsers(initialUsers);
  }

  const [search, setSearch] = React.useState("");
  const [modalMode, setModalMode] = React.useState<
    | { type: "closed" }
    | { type: "create" }
    | { type: "edit"; user: SafeUserDto }
    | { type: "reset_password"; user: SafeUserDto }
    | { type: "toggle_active"; user: SafeUserDto }
  >({ type: "closed" });

  const [isToggling, setIsToggling] = React.useState(false);

  const filteredUsers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.agentCode?.toLowerCase().includes(q) ?? false)
    );
  }, [users, search]);

  function handleRefreshList() {
    startRefreshTransition(() => {
      router.refresh();
    });
    toast.info("Daftar pengguna diperbarui.");
  }

  async function handleConfirmToggleActive(targetUser: SafeUserDto) {
    if (isToggling) return;
    setIsToggling(true);
    const nextActive = !targetUser.isActive;

    const res = await apiFetch<{ user?: SafeUserDto }>("/api/admin/users", {
      method: "PATCH",
      body: {
        id: targetUser.id,
        isActive: nextActive,
      },
    });

    if (!res.ok || !res.data.user) {
      toast.error(!res.ok ? res.message : "Gagal memperbarui status pengguna.");
      setIsToggling(false);
      return;
    }

    const updatedUser = res.data.user;
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    toast.success(
      nextActive
        ? `Pengguna ${updatedUser.username} diaktifkan.`
        : `Pengguna ${updatedUser.username} dinonaktifkan.`
    );
    setModalMode({ type: "closed" });
    setIsToggling(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
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
            aria-label="Cari pengguna"
            placeholder="Cari username, nama, atau agen"
            className="h-10 w-full rounded-md border border-neutral-200 bg-surface-card pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            disabled={isRefreshing}
            onClick={handleRefreshList}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                isRefreshing && "animate-spin text-primary-600"
              )}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Muat Ulang</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={() => setModalMode({ type: "create" })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah Pengguna
          </Button>
        </div>
      </div>

      {/* Tabel Pengguna */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          variant={search ? "no_results" : "no_data"}
          title={
            search
              ? "Pengguna tidak ditemukan. Coba kata kunci lain."
              : "Belum ada pengguna terdaftar."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-card">
          {isRefreshing && (
            <IndeterminateProgressBar label="Memperbarui daftar pengguna..." />
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-surface-border bg-surface-table-header">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Username
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Nama Lengkap
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Peran
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Agen Tertaut
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Login Terakhir
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody
                className={cn(
                  "divide-y divide-surface-border transition-opacity",
                  isRefreshing && "opacity-65"
                )}
              >
                {filteredUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr key={user.id} className="hover:bg-surface-table-hover">
                      <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-neutral-900">
                        {user.username}
                        {isSelf && (
                          <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 font-sans text-[11px] font-medium text-primary-700">
                            Anda
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        {user.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-700">
                        {user.agentCode ? (
                          <span>
                            <strong className="font-mono font-semibold">
                              {user.agentCode}
                            </strong>{" "}
                            <span className="text-neutral-500 text-xs">
                              ({user.agentName})
                            </span>
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                        {user.lastLoginAt
                          ? formatDateTimeTable(user.lastLoginAt)
                          : "Belum pernah"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <ActiveStatusBadge isActive={user.isActive} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setModalMode({ type: "edit", user })}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Ubah
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setModalMode({ type: "reset_password", user })
                            }
                          >
                            <KeyRound
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Reset Password
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isSelf}
                            title={
                              isSelf
                                ? "Admin tidak boleh menonaktifkan dirinya sendiri."
                                : undefined
                            }
                            onClick={() =>
                              setModalMode({ type: "toggle_active", user })
                            }
                            className={cn(
                              user.isActive
                                ? "text-debit-text hover:bg-debit-bg/40"
                                : "text-credit-text hover:bg-credit-bg/40"
                            )}
                          >
                            <Power className="h-3.5 w-3.5" aria-hidden="true" />
                            {user.isActive ? "Nonaktifkan" : "Aktifkan"}
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

      {/* Modal Tambah / Ubah Pengguna */}
      <Modal
        open={modalMode.type === "create" || modalMode.type === "edit"}
        onOpenChange={(open) => {
          if (!open) setModalMode({ type: "closed" });
        }}
        title={
          modalMode.type === "edit" ? "Ubah Pengguna" : "Tambah Pengguna Baru"
        }
      >
        {(modalMode.type === "create" || modalMode.type === "edit") && (
          <UserFormInner
            key={modalMode.type === "edit" ? modalMode.user.id : "new-user"}
            currentUserId={currentUserId}
            editingUser={modalMode.type === "edit" ? modalMode.user : null}
            agents={agents}
            onCancel={() => setModalMode({ type: "closed" })}
            onSaved={(savedUser, isNew) => {
              setUsers((prev) =>
                isNew
                  ? [...prev, savedUser].sort((a, b) =>
                      a.username.localeCompare(b.username)
                    )
                  : prev.map((u) => (u.id === savedUser.id ? savedUser : u))
              );
              setModalMode({ type: "closed" });
              toast.success(
                isNew
                  ? `Pengguna ${savedUser.username} berhasil ditambahkan.`
                  : `Pengguna ${savedUser.username} berhasil diperbarui.`
              );
              router.refresh();
            }}
          />
        )}
      </Modal>

      {/* Modal Reset Password */}
      <Modal
        open={modalMode.type === "reset_password"}
        onOpenChange={(open) => {
          if (!open) setModalMode({ type: "closed" });
        }}
        title="Reset Password Pengguna"
        description={
          modalMode.type === "reset_password"
            ? `Atur password baru untuk ${modalMode.user.name} (${modalMode.user.username}).`
            : undefined
        }
      >
        {modalMode.type === "reset_password" && (
          <ResetPasswordInner
            key={modalMode.user.id}
            user={modalMode.user}
            onCancel={() => setModalMode({ type: "closed" })}
            onResetDone={() => {
              const targetUsername = modalMode.user.username;
              setModalMode({ type: "closed" });
              toast.success(
                `Password untuk ${targetUsername} berhasil direset.`
              );
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
          modalMode.type === "toggle_active" && modalMode.user.isActive
            ? "Nonaktifkan Pengguna"
            : "Aktifkan Pengguna"
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
                variant={modalMode.user.isActive ? "danger" : "primary"}
                isLoading={isToggling}
                onClick={() => handleConfirmToggleActive(modalMode.user)}
              >
                {modalMode.user.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </>
          ) : undefined
        }
      >
        {modalMode.type === "toggle_active" && (
          <p className="text-sm text-neutral-700">
            {modalMode.user.isActive ? (
              <>
                Nonaktifkan akun{" "}
                <strong>
                  {modalMode.user.name} ({modalMode.user.username})
                </strong>
                ? Pengguna ini tidak akan dapat masuk ke sistem sampai
                diaktifkan kembali.
              </>
            ) : (
              <>
                Aktifkan kembali akun{" "}
                <strong>
                  {modalMode.user.name} ({modalMode.user.username})
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

function UserFormInner({
  currentUserId,
  editingUser,
  agents,
  onCancel,
  onSaved,
}: {
  currentUserId: string;
  editingUser: SafeUserDto | null;
  agents: AppAgentRecord[];
  onCancel: () => void;
  onSaved: (user: SafeUserDto, isNew: boolean) => void;
}) {
  const isEditingSelf = Boolean(editingUser && editingUser.id === currentUserId);

  const [username, setUsername] = React.useState(editingUser?.username ?? "");
  const [name, setName] = React.useState(editingUser?.name ?? "");
  const [role, setRole] = React.useState<UserRoleType>(
    editingUser?.role ?? "agent"
  );
  const [agentId, setAgentId] = React.useState<string>(
    editingUser?.agentId ?? agents[0]?.id ?? ""
  );
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [isSaving, setIsSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const isNew = !editingUser;
    const nextErrors: Record<string, string> = {};

    if (isNew) {
      const trimmedUser = username.trim().toLowerCase();
      if (trimmedUser.length < 3) {
        nextErrors.username = "Username minimal 3 karakter.";
      } else if (!/^[A-Za-z0-9_.-]+$/.test(trimmedUser)) {
        nextErrors.username =
          "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.";
      }

      if (password.length < 6) {
        nextErrors.password = "Password awal minimal 6 karakter.";
      }
    }

    if (!name.trim()) {
      nextErrors.name = "Nama lengkap wajib diisi.";
    }

    if (role === "agent" && !agentId) {
      nextErrors.agentId = "Pilih agen yang akan ditautkan.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    const res = await apiFetch<{ user?: SafeUserDto }>("/api/admin/users", {
      method: isNew ? "POST" : "PATCH",
      body: isNew
        ? {
            username: username.trim().toLowerCase(),
            name: name.trim(),
            password,
            role,
            agentId: role === "agent" ? agentId : null,
          }
        : {
            id: editingUser.id,
            name: name.trim(),
            role,
            agentId: role === "agent" ? agentId : null,
          },
    });

    if (!res.ok || !res.data.user) {
      if (!res.ok && res.fields) setFieldErrors(res.fields);
      setErrorMsg(
        !res.ok ? res.message : "Gagal menyimpan data pengguna."
      );
      setIsSaving(false);
      return;
    }

    onSaved(res.data.user, isNew);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label
          htmlFor="user-username-input"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Username <span className="text-danger">*</span>
        </label>
        <input
          id="user-username-input"
          type="text"
          disabled={Boolean(editingUser) || isSaving}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase());
            if (fieldErrors.username) {
              setFieldErrors((prev) => ({ ...prev, username: "" }));
            }
          }}
          placeholder="Contoh: eman"
          aria-invalid={Boolean(fieldErrors.username)}
          className={cn(
            "h-10 w-full rounded-md border px-3 font-mono text-sm text-neutral-900 placeholder:font-sans placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500",
            editingUser
              ? "border-neutral-200 bg-neutral-50 text-neutral-500 cursor-not-allowed"
              : fieldErrors.username
                ? "border-danger bg-neutral-0"
                : "border-neutral-200 bg-neutral-0"
          )}
        />
        {fieldErrors.username && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {fieldErrors.username}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="user-name-input"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Nama Lengkap <span className="text-danger">*</span>
        </label>
        <input
          id="user-name-input"
          type="text"
          disabled={isSaving}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) {
              setFieldErrors((prev) => ({ ...prev, name: "" }));
            }
          }}
          placeholder="Contoh: Abdul Rachman Manga"
          aria-invalid={Boolean(fieldErrors.name)}
          className={cn(
            "h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500",
            fieldErrors.name ? "border-danger" : "border-neutral-200"
          )}
        />
        {fieldErrors.name && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {fieldErrors.name}
          </p>
        )}
      </div>

      {!editingUser && (
        <div>
          <label
            htmlFor="user-password-input"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Password Awal <span className="text-danger">*</span>
          </label>
          <div className="relative">
            <input
              id="user-password-input"
              type={showPassword ? "text" : "password"}
              disabled={isSaving}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: "" }));
                }
              }}
              placeholder="Minimal 6 karakter"
              aria-invalid={Boolean(fieldErrors.password)}
              className={cn(
                "h-10 w-full rounded-md border bg-neutral-0 pl-3 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500",
                fieldErrors.password ? "border-danger" : "border-neutral-200"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Sembunyikan password" : "Tampilkan password"
              }
              className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-50 cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {fieldErrors.password}
            </p>
          )}
        </div>
      )}

      <div>
        <label
          htmlFor="user-role-select"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Peran <span className="text-danger">*</span>
        </label>
        <select
          id="user-role-select"
          disabled={isEditingSelf || isSaving}
          value={role}
          onChange={(e) => setRole(e.target.value as UserRoleType)}
          className={cn(
            "h-10 w-full rounded-md border border-neutral-200 bg-neutral-0 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500",
            isEditingSelf && "bg-neutral-50 text-neutral-500 cursor-not-allowed"
          )}
        >
          <option value="agent">Agen (Akses terbatas ke data agennya)</option>
          <option value="admin">Admin (Akses penuh seluruh agen)</option>
        </select>
      </div>

      {role === "agent" && (
        <div>
          <label
            htmlFor="user-agent-select"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Tautkan ke Agen <span className="text-danger">*</span>
          </label>
          <select
            id="user-agent-select"
            disabled={isSaving}
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value);
              if (fieldErrors.agentId) {
                setFieldErrors((prev) => ({ ...prev, agentId: "" }));
              }
            }}
            aria-invalid={Boolean(fieldErrors.agentId)}
            className={cn(
              "h-10 w-full rounded-md border bg-neutral-0 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500",
              fieldErrors.agentId ? "border-danger" : "border-neutral-200"
            )}
          >
            <option value="">— Pilih Agen —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name} {!a.isActive ? "(Nonaktif)" : ""}
              </option>
            ))}
          </select>
          {fieldErrors.agentId && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {fieldErrors.agentId}
            </p>
          )}
        </div>
      )}

      {errorMsg && (
        <AlertBanner variant="error" onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </AlertBanner>
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

function ResetPasswordInner({
  user,
  onCancel,
  onResetDone,
}: {
  user: SafeUserDto;
  onCancel: () => void;
  onResetDone: () => void;
}) {
  const [newPassword, setNewPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg("Password baru minimal 6 karakter.");
      return;
    }

    setIsSaving(true);
    const res = await apiFetch("/api/admin/users", {
      method: "PATCH",
      body: {
        id: user.id,
        newPassword,
      },
    });

    if (!res.ok) {
      setErrorMsg(res.message);
      setIsSaving(false);
      return;
    }

    onResetDone();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label
          htmlFor="reset-password-input"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Password Baru <span className="text-danger">*</span>
        </label>
        <div className="relative">
          <input
            id="reset-password-input"
            type={showPassword ? "text" : "password"}
            autoFocus
            disabled={isSaving}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setErrorMsg(null);
            }}
            placeholder="Minimal 6 karakter"
            className="h-10 w-full rounded-md border border-neutral-200 bg-neutral-0 pl-3 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={
              showPassword ? "Sembunyikan password" : "Tampilkan password"
            }
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-50 cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <AlertBanner variant="error" onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </AlertBanner>
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
          Simpan Password
        </Button>
      </div>
    </form>
  );
}
