/**
 * Penyimpanan lokal berbasis file JSON (.data/local-db.json) yang dipakai otomatis
 * selama DATABASE_URL MySQL XAMPP belum dikonfigurasi di .env.
 * Mengimplementasikan kontrak AppDataRepository yang identik 1:1 dengan Prisma MySQL.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import {
  SAMPLE_AGENTS,
  SAMPLE_SETTINGS,
  SAMPLE_TRANSACTIONS,
} from "@/lib/data/sample-data";
import { calculateAgentRunningBalances } from "@/lib/domain/balance";
import { computeTransactionDedupHash } from "@/lib/domain/ingest";
import type {
  ReceiptBusinessSettings,
  ReceiptTransactionRecord,
} from "@/lib/domain/receipt";
import type {
  AppAgentRecord,
  AppAuditLogRecord,
  AppDataRepository,
  AppUserRecord,
  ImportBatchDetailRecord,
  ImportBatchSummaryRecord,
  ManualBalancePreview,
  SessionUser,
  UserRoleType,
} from "./types";

interface StoredAgent {
  id: string;
  code: string;
  name: string;
  openingBalance: string;
  isActive: boolean;
  createdAt: string;
}

interface StoredUser {
  id: string;
  username: string;
  name: string;
  passwordHash: string;
  role: UserRoleType;
  agentId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface StoredTransaction {
  id: string;
  agentId: string;
  transactionAt: string;
  case: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  orderNumber: string | null;
  bookingCode: string | null;
  groupKey: string | null;
  dedupHash: string;
  source: "manual" | "import" | "api";
  importBatchId: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface StoredAuditLog {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface LocalDbState {
  nextTransactionId: number;
  nextAuditId: number;
  settings: ReceiptBusinessSettings;
  agents: StoredAgent[];
  users: StoredUser[];
  transactions: StoredTransaction[];
  importBatches: ImportBatchDetailRecord[];
  auditLogs: StoredAuditLog[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "local-db.json");

function createInitialSeedState(): LocalDbState {
  const nowIso = "2026-07-22T01:00:00.000Z";
  const adminHash = bcrypt.hashSync("admin123", 10);
  const emanHash = bcrypt.hashSync("eman123", 10);

  const agents: StoredAgent[] = SAMPLE_AGENTS.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    openingBalance: a.openingBalance.toString(),
    isActive: a.isActive,
    createdAt: nowIso,
  }));

  const users: StoredUser[] = [
    {
      id: "user-admin-1",
      username: "admin",
      name: "Admin Manga' Travel",
      passwordHash: adminHash,
      role: "admin",
      agentId: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: nowIso,
    },
    {
      id: "user-eman-1",
      username: "eman",
      name: "eman",
      passwordHash: emanHash,
      role: "agent",
      agentId: "agent-jkt-37287",
      isActive: true,
      lastLoginAt: null,
      createdAt: nowIso,
    },
  ];

  const transactions: StoredTransaction[] = SAMPLE_TRANSACTIONS.map((tx) => ({
    id: tx.id,
    agentId: tx.agentId,
    transactionAt: tx.transactionAt,
    case: tx.case,
    description: tx.description,
    debit: tx.debit,
    credit: tx.credit,
    balance: tx.balance,
    orderNumber: tx.orderNumber,
    bookingCode: tx.bookingCode,
    groupKey: tx.groupKey,
    dedupHash: computeTransactionDedupHash({
      agentId: tx.agentId,
      transactionAt: new Date(tx.transactionAt),
      case: tx.case,
      debit: BigInt(tx.debit),
      credit: BigInt(tx.credit),
      description: tx.description,
    }),
    source: tx.source,
    importBatchId: "batch-initial-sample",
    createdBy: "user-admin-1",
    createdAt: tx.transactionAt,
  }));

  const importBatches: ImportBatchDetailRecord[] = [
    {
      id: "batch-initial-sample",
      fileName: "LAPORAN-CASHFLOW-20260722-20260728.xls",
      uploadedBy: "user-admin-1",
      uploaderName: "Admin Manga' Travel",
      status: "committed",
      totalRows: 25,
      validRows: 25,
      warningRows: 0,
      errorRows: 0,
      duplicateRows: 0,
      reportTitle:
        "LAPORAN CASHFLOW USER: eman - Periode 2026-07-22 s/d 2026-07-28",
      createdAt: "2026-07-28T08:00:00.000Z",
      committedAt: "2026-07-28T08:01:00.000Z",
      rows: [],
    },
  ];

  return {
    nextTransactionId: 1026,
    nextAuditId: 1,
    settings: { ...SAMPLE_SETTINGS },
    agents,
    users,
    transactions,
    importBatches,
    auditLogs: [],
  };
}

function readDb(): LocalDbState {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const seed = createInitialSeedState();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw) as LocalDbState;
}

function writeDb(state: LocalDbState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmpFile, DATA_FILE);
}

function recalculateAgentBalancesInPlace(
  state: LocalDbState,
  agentId: string
): void {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent) return;

  const agentTxs = state.transactions.filter((t) => t.agentId === agentId);
  const computed = calculateAgentRunningBalances(
    BigInt(agent.openingBalance),
    agentTxs.map((t) => ({
      id: BigInt(t.id),
      agentId: t.agentId,
      transactionAt: new Date(t.transactionAt),
      debit: BigInt(t.debit),
      credit: BigInt(t.credit),
    }))
  );

  const balanceMap = new Map<string, string>();
  for (const c of computed) {
    balanceMap.set(c.item.id.toString(), c.balanceAfter.toString());
  }

  for (const tx of state.transactions) {
    if (tx.agentId === agentId) {
      const updated = balanceMap.get(tx.id);
      if (updated !== undefined) {
        tx.balance = updated;
      }
    }
  }
}

function mapStoredUser(state: LocalDbState, u: StoredUser): AppUserRecord {
  const agent = u.agentId
    ? state.agents.find((a) => a.id === u.agentId) ?? null
    : null;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    passwordHash: u.passwordHash,
    role: u.role,
    agentId: u.agentId,
    agentCode: agent?.code ?? null,
    agentName: agent?.name ?? null,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

function mapStoredAgent(state: LocalDbState, a: StoredAgent): AppAgentRecord {
  const agentTxs = state.transactions
    .filter((t) => t.agentId === a.id)
    .sort((x, y) => {
      const diff =
        new Date(x.transactionAt).getTime() -
        new Date(y.transactionAt).getTime();
      if (diff !== 0) return diff;
      return BigInt(x.id) < BigInt(y.id) ? -1 : 1;
    });

  const latestBalance =
    agentTxs.length > 0
      ? agentTxs[agentTxs.length - 1].balance
      : a.openingBalance;

  const userCount = state.users.filter((u) => u.agentId === a.id).length;

  return {
    id: a.id,
    code: a.code,
    name: a.name,
    openingBalance: a.openingBalance,
    currentBalance: latestBalance,
    transactionCount: agentTxs.length,
    userCount,
    isActive: a.isActive,
    createdAt: a.createdAt,
  };
}

function mapStoredTx(
  state: LocalDbState,
  t: StoredTransaction
): ReceiptTransactionRecord {
  const agent = state.agents.find((a) => a.id === t.agentId);
  return {
    id: t.id,
    agentId: t.agentId,
    agentCode: agent?.code ?? "UNKNOWN",
    agentName: agent?.name ?? "Agen Tidak Dikenal",
    transactionAt: t.transactionAt,
    case: t.case,
    description: t.description,
    debit: t.debit,
    credit: t.credit,
    balance: t.balance,
    orderNumber: t.orderNumber,
    bookingCode: t.bookingCode,
    groupKey: t.groupKey,
    source: t.source,
  };
}

function appendAudit(
  state: LocalDbState,
  input: {
    userId: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  state.auditLogs.push({
    id: String(state.nextAuditId++),
    userId: input.userId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date().toISOString(),
  });
}

export const localDataRepository: AppDataRepository = {
  async findUserByUsername(username) {
    const state = readDb();
    const norm = username.trim().toLowerCase();
    const found = state.users.find((u) => u.username.toLowerCase() === norm);
    return found ? mapStoredUser(state, found) : null;
  },

  async findUserById(id) {
    const state = readDb();
    const found = state.users.find((u) => u.id === id);
    return found ? mapStoredUser(state, found) : null;
  },

  async recordUserLogin(userId) {
    const state = readDb();
    const found = state.users.find((u) => u.id === userId);
    if (found) {
      found.lastLoginAt = new Date().toISOString();
      appendAudit(state, {
        userId,
        action: "login",
        entity: "users",
        entityId: userId,
      });
      writeDb(state);
    }
  },

  async listUsers() {
    const state = readDb();
    return state.users
      .map((u) => mapStoredUser(state, u))
      .sort((a, b) => a.username.localeCompare(b.username));
  },

  async createUser(input) {
    const state = readDb();
    const username = input.username.trim().toLowerCase();
    if (state.users.some((u) => u.username.toLowerCase() === username)) {
      throw new Error("Username sudah digunakan.");
    }
    if (input.role === "agent" && !input.agentId) {
      throw new Error("Pengguna peran Agen wajib ditautkan ke agen.");
    }
    if (input.role === "agent" && input.agentId) {
      const ag = state.agents.find((a) => a.id === input.agentId);
      if (!ag) throw new Error("Agen yang dipilih tidak ditemukan.");
    }

    const created: StoredUser = {
      id: `user-${crypto.randomUUID()}`,
      username,
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      role: input.role,
      agentId: input.role === "agent" ? input.agentId : null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };

    state.users.push(created);
    appendAudit(state, {
      userId: input.actorUserId,
      action: "user_create",
      entity: "users",
      entityId: created.id,
      metadata: { username: created.username, role: created.role },
    });
    writeDb(state);
    return mapStoredUser(state, created);
  },

  async updateUser(input) {
    const state = readDb();
    const user = state.users.find((u) => u.id === input.id);
    if (!user) {
      throw new Error("Pengguna tidak ditemukan.");
    }

    if (input.isActive === false && user.id === input.actorUserId) {
      throw new Error("Admin tidak boleh menonaktifkan dirinya sendiri.");
    }

    const nextRole = input.role ?? user.role;
    const nextAgentId =
      nextRole === "admin"
        ? null
        : input.agentId !== undefined
          ? input.agentId
          : user.agentId;

    if (nextRole === "agent" && !nextAgentId) {
      throw new Error("Pengguna peran Agen wajib ditautkan ke agen.");
    }

    if (input.name !== undefined) user.name = input.name.trim();
    user.role = nextRole;
    user.agentId = nextAgentId;
    if (input.isActive !== undefined) user.isActive = input.isActive;
    if (input.passwordHash !== undefined) {
      user.passwordHash = input.passwordHash;
    }

    appendAudit(state, {
      userId: input.actorUserId,
      action: "user_update",
      entity: "users",
      entityId: user.id,
      metadata: {
        role: user.role,
        isActive: user.isActive,
        passwordReset: Boolean(input.passwordHash),
      },
    });
    writeDb(state);
    return mapStoredUser(state, user);
  },

  async listAgents() {
    const state = readDb();
    return state.agents
      .map((a) => mapStoredAgent(state, a))
      .sort((a, b) => a.code.localeCompare(b.code));
  },

  async findAgentById(id) {
    const state = readDb();
    const found = state.agents.find((a) => a.id === id);
    return found ? mapStoredAgent(state, found) : null;
  },

  async findAgentByCode(code) {
    const state = readDb();
    const norm = code.trim().toUpperCase();
    const found = state.agents.find((a) => a.code.toUpperCase() === norm);
    return found ? mapStoredAgent(state, found) : null;
  },

  async createAgent(input) {
    const state = readDb();
    const code = input.code.trim().toUpperCase();
    if (state.agents.some((a) => a.code.toUpperCase() === code)) {
      throw new Error("Kode agen sudah terdaftar.");
    }

    const created: StoredAgent = {
      id: `agent-${crypto.randomUUID()}`,
      code,
      name: input.name.trim(),
      openingBalance: input.openingBalance.toString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    state.agents.push(created);
    appendAudit(state, {
      userId: input.actorUserId,
      action: "agent_create",
      entity: "agents",
      entityId: created.id,
      metadata: { code: created.code },
    });
    writeDb(state);
    return mapStoredAgent(state, created);
  },

  async updateAgent(input) {
    const state = readDb();
    const agent = state.agents.find((a) => a.id === input.id);
    if (!agent) {
      throw new Error("Agen tidak ditemukan.");
    }

    if (input.code !== undefined) {
      const nextCode = input.code.trim().toUpperCase();
      if (nextCode !== agent.code) {
        const hasTx = state.transactions.some((t) => t.agentId === agent.id);
        if (hasTx) {
          throw new Error(
            "Kode agen tidak boleh diubah setelah memiliki transaksi."
          );
        }
        if (
          state.agents.some(
            (a) => a.id !== agent.id && a.code.toUpperCase() === nextCode
          )
        ) {
          throw new Error("Kode agen sudah digunakan oleh agen lain.");
        }
        agent.code = nextCode;
      }
    }

    if (input.name !== undefined) agent.name = input.name.trim();
    if (input.isActive !== undefined) agent.isActive = input.isActive;

    appendAudit(state, {
      userId: input.actorUserId,
      action: "agent_update",
      entity: "agents",
      entityId: agent.id,
      metadata: { code: agent.code, isActive: agent.isActive },
    });
    writeDb(state);
    return mapStoredAgent(state, agent);
  },

  async getSettings() {
    const state = readDb();
    return { ...state.settings };
  },

  async updateSettings(input, actorUserId) {
    const state = readDb();
    state.settings = { ...input };
    appendAudit(state, {
      userId: actorUserId,
      action: "setting_update",
      entity: "settings",
      entityId: "1",
    });
    writeDb(state);
    return { ...state.settings };
  },

  async listAllTransactionsForScope(session: SessionUser) {
    const state = readDb();
    const txs =
      session.role === "agent"
        ? state.transactions.filter((t) => t.agentId === session.agentId)
        : state.transactions;
    return txs.map((t) => mapStoredTx(state, t));
  },

  async listExistingDedupHashes() {
    const state = readDb();
    return new Set(state.transactions.map((t) => t.dedupHash).filter(Boolean));
  },

  async previewManualTransaction(input): Promise<ManualBalancePreview | null> {
    const state = readDb();
    const agent = state.agents.find((a) => a.id === input.agentId);
    if (!agent) return null;

    const agentTxs = state.transactions
      .filter((t) => t.agentId === agent.id)
      .sort((a, b) => {
        const diff =
          new Date(a.transactionAt).getTime() -
          new Date(b.transactionAt).getTime();
        if (diff !== 0) return diff;
        return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
      });

    const targetTime = input.transactionAt.getTime();
    const beforeTxs = agentTxs.filter(
      (t) => new Date(t.transactionAt).getTime() <= targetTime
    );
    const afterTxs = agentTxs.filter(
      (t) => new Date(t.transactionAt).getTime() > targetTime
    );

    const balanceBefore =
      beforeTxs.length > 0
        ? BigInt(beforeTxs[beforeTxs.length - 1].balance)
        : BigInt(agent.openingBalance);

    const balanceAfter = balanceBefore + input.credit - input.debit;

    return {
      agentCode: agent.code,
      agentName: agent.name,
      balanceBefore: balanceBefore.toString(),
      balanceAfter: balanceAfter.toString(),
      isBackdated: afterTxs.length > 0,
      affectedSubsequentCount: afterTxs.length,
    };
  },

  async createManualTransaction(input) {
    const state = readDb();
    const agent = state.agents.find((a) => a.id === input.agentId);
    if (!agent) {
      throw new Error("Agen tidak ditemukan.");
    }
    if (!agent.isActive) {
      throw new Error("Tidak dapat menambah transaksi pada agen nonaktif.");
    }

    const newId = String(state.nextTransactionId++);
    const created: StoredTransaction = {
      id: newId,
      agentId: agent.id,
      transactionAt: input.transactionAt.toISOString(),
      case: input.case,
      description: input.description,
      debit: input.debit.toString(),
      credit: input.credit.toString(),
      balance: "0",
      orderNumber: input.orderNumber,
      bookingCode: input.bookingCode,
      groupKey: input.groupKey,
      dedupHash: input.dedupHash,
      source: "manual",
      importBatchId: null,
      createdBy: input.actorUserId,
      createdAt: new Date().toISOString(),
    };

    // Jika dedupHash sudah ada, tambahkan suffix unik untuk input manual yang disengaja pada waktu berbeda/sama
    if (state.transactions.some((t) => t.dedupHash === created.dedupHash)) {
      created.dedupHash = `${created.dedupHash}-manual-${newId}`;
    }

    state.transactions.push(created);
    recalculateAgentBalancesInPlace(state, agent.id);

    appendAudit(state, {
      userId: input.actorUserId,
      action: "create_transaction",
      entity: "transactions",
      entityId: newId,
      metadata: {
        agentCode: agent.code,
        case: input.case,
        debit: created.debit,
        credit: created.credit,
      },
    });

    writeDb(state);
    const saved = state.transactions.find((t) => t.id === newId)!;
    return mapStoredTx(state, saved);
  },

  async createImportBatchPreview(input) {
    const state = readDb();
    const uploader = state.users.find((u) => u.id === input.uploadedBy);
    const batch: ImportBatchDetailRecord = {
      id: `batch-${crypto.randomUUID()}`,
      fileName: input.fileName,
      uploadedBy: input.uploadedBy,
      uploaderName: uploader?.name ?? "Admin",
      status: "previewed",
      totalRows: input.totalRows,
      validRows: input.validRows,
      warningRows: input.warningRows,
      errorRows: input.errorRows,
      duplicateRows: input.duplicateRows,
      reportTitle: input.reportTitle,
      createdAt: new Date().toISOString(),
      committedAt: null,
      rows: input.rows,
    };

    state.importBatches.unshift(batch);
    writeDb(state);
    return batch;
  },

  async getImportBatchById(id) {
    const state = readDb();
    return state.importBatches.find((b) => b.id === id) ?? null;
  },

  async listImportBatches(): Promise<ImportBatchSummaryRecord[]> {
    const state = readDb();
    return state.importBatches
      .map((b) => {
        const { rows: _unusedRows, ...summary } = b;
        void _unusedRows;
        return summary;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },

  async commitImportBatch(batchId, actorUserId) {
    const state = readDb();
    const batch = state.importBatches.find((b) => b.id === batchId);
    if (!batch) {
      throw new Error("Batch pratinjau impor tidak ditemukan.");
    }
    if (batch.status !== "previewed") {
      throw new Error("Batch impor ini sudah pernah diproses atau dibatalkan.");
    }

    const existingHashes = new Set(
      state.transactions.map((t) => t.dedupHash).filter(Boolean)
    );

    const candidateRows = batch.rows
      .filter((r) => Boolean(r.prepared))
      .map((r, idx) => ({
        row: r,
        prepared: r.prepared!,
        // File biasanya terbaru di atas -> baris bawah mendapat urutan kronologis lebih awal saat tie
        fileReverseOrder: batch.rows.length - idx,
      }));

    // Urutkan kronologis sebelum memberi ID auto-increment
    candidateRows.sort((a, b) => {
      const diff =
        new Date(a.prepared.transactionAtIso).getTime() -
        new Date(b.prepared.transactionAtIso).getTime();
      if (diff !== 0) return diff;
      return a.fileReverseOrder - b.fileReverseOrder;
    });

    const affectedAgents = new Set<string>();
    let importedCount = 0;
    let duplicateSkippedCount = batch.duplicateRows;

    for (const { prepared } of candidateRows) {
      if (existingHashes.has(prepared.dedupHash)) {
        duplicateSkippedCount += 1;
        continue;
      }

      // Jika agen belum pernah punya transaksi & punya derivedOpeningBalance, set saldo awalnya
      const agent = state.agents.find((a) => a.id === prepared.agentId);
      if (agent && prepared.derivedOpeningBalance !== null) {
        const hadPrior = state.transactions.some(
          (t) => t.agentId === agent.id
        );
        if (!hadPrior) {
          agent.openingBalance = prepared.derivedOpeningBalance;
        }
      }

      const newId = String(state.nextTransactionId++);
      state.transactions.push({
        id: newId,
        agentId: prepared.agentId,
        transactionAt: prepared.transactionAtIso,
        case: prepared.case,
        description: prepared.description,
        debit: prepared.debit,
        credit: prepared.credit,
        balance: "0",
        orderNumber: prepared.orderNumber,
        bookingCode: prepared.bookingCode,
        groupKey: prepared.groupKey,
        dedupHash: prepared.dedupHash,
        source: "import",
        importBatchId: batch.id,
        createdBy: actorUserId,
        createdAt: new Date().toISOString(),
      });

      existingHashes.add(prepared.dedupHash);
      affectedAgents.add(prepared.agentId);
      importedCount += 1;
    }

    for (const agentId of affectedAgents) {
      recalculateAgentBalancesInPlace(state, agentId);
    }

    batch.status = "committed";
    batch.committedAt = new Date().toISOString();
    batch.validRows = importedCount;
    batch.duplicateRows = duplicateSkippedCount;

    appendAudit(state, {
      userId: actorUserId,
      action: "import_commit",
      entity: "import_batches",
      entityId: batch.id,
      metadata: {
        fileName: batch.fileName,
        importedCount,
        duplicateSkippedCount,
      },
    });

    writeDb(state);
    return { importedCount, duplicateSkippedCount };
  },

  async cancelImportBatch(batchId, actorUserId) {
    const state = readDb();
    const batch = state.importBatches.find((b) => b.id === batchId);
    if (!batch) {
      throw new Error("Batch impor tidak ditemukan.");
    }
    if (batch.status !== "previewed") {
      throw new Error("Hanya batch berstatus pratinjau yang dapat dibatalkan.");
    }
    batch.status = "cancelled";
    batch.rows = [];
    appendAudit(state, {
      userId: actorUserId,
      action: "import_cancel",
      entity: "import_batches",
      entityId: batch.id,
    });
    writeDb(state);
  },

  async listAuditLogs(limit = 200): Promise<AppAuditLogRecord[]> {
    const state = readDb();
    const userById = new Map(state.users.map((u) => [u.id, u]));
    return [...state.auditLogs]
      .sort((a, b) => {
        const diff =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (diff !== 0) return diff;
        return BigInt(b.id) > BigInt(a.id) ? 1 : -1;
      })
      .slice(0, limit)
      .map((log) => {
        const actor = log.userId ? userById.get(log.userId) : undefined;
        return {
          id: log.id,
          userId: log.userId,
          username: actor?.username ?? null,
          userName: actor?.name ?? null,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          metadata: log.metadata,
          createdAt: log.createdAt,
        };
      });
  },

  async writeAuditLog(input) {
    const state = readDb();
    appendAudit(state, input);
    writeDb(state);
  },
};

