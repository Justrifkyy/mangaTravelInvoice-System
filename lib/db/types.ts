/**
 * Tipe data domain bersama untuk Repository (mendukung MySQL Prisma maupun Local Store).
 */

import type { ParsedImportPreviewRow } from "@/lib/domain/excel-parser";
import type {
  ReceiptBusinessSettings,
  ReceiptTransactionRecord,
} from "@/lib/domain/receipt";

export type UserRoleType = "admin" | "agent";

export interface AppUserRecord {
  id: string;
  username: string;
  name: string;
  passwordHash: string;
  role: UserRoleType;
  agentId: string | null;
  agentCode: string | null;
  agentName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: UserRoleType;
  agentId: string | null;
  agentCode: string | null;
}

export interface AppAgentRecord {
  id: string;
  code: string;
  name: string;
  openingBalance: string; // serialized bigint
  currentBalance: string; // serialized bigint
  transactionCount: number;
  userCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface ImportBatchSummaryRecord {
  id: string;
  fileName: string;
  uploadedBy: string;
  uploaderName: string;
  status: "previewed" | "committed" | "cancelled";
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  reportTitle: string | null;
  createdAt: string;
  committedAt: string | null;
}

export interface ImportBatchDetailRecord extends ImportBatchSummaryRecord {
  rows: ParsedImportPreviewRow[];
}

export interface ManualBalancePreview {
  agentCode: string;
  agentName: string;
  balanceBefore: string;
  balanceAfter: string;
  isBackdated: boolean;
  affectedSubsequentCount: number;
}

export interface AppAuditLogRecord {
  id: string;
  userId: string | null;
  username: string | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AppDataRepository {
  // Auth & Users
  findUserByUsername(username: string): Promise<AppUserRecord | null>;
  findUserById(id: string): Promise<AppUserRecord | null>;
  recordUserLogin(userId: string): Promise<void>;
  listUsers(): Promise<AppUserRecord[]>;
  createUser(input: {
    username: string;
    name: string;
    passwordHash: string;
    role: UserRoleType;
    agentId: string | null;
    actorUserId: string;
  }): Promise<AppUserRecord>;
  updateUser(input: {
    id: string;
    name?: string;
    role?: UserRoleType;
    agentId?: string | null;
    isActive?: boolean;
    passwordHash?: string;
    actorUserId: string;
  }): Promise<AppUserRecord>;

  // Agents
  listAgents(): Promise<AppAgentRecord[]>;
  findAgentById(id: string): Promise<AppAgentRecord | null>;
  findAgentByCode(code: string): Promise<AppAgentRecord | null>;
  createAgent(input: {
    code: string;
    name: string;
    openingBalance: bigint;
    actorUserId: string;
  }): Promise<AppAgentRecord>;
  updateAgent(input: {
    id: string;
    code?: string;
    name?: string;
    isActive?: boolean;
    actorUserId: string;
  }): Promise<AppAgentRecord>;

  // Settings
  getSettings(): Promise<ReceiptBusinessSettings>;
  updateSettings(
    input: ReceiptBusinessSettings,
    actorUserId: string
  ): Promise<ReceiptBusinessSettings>;

  // Transactions
  listAllTransactionsForScope(
    session: SessionUser
  ): Promise<ReceiptTransactionRecord[]>;
  listExistingDedupHashes(): Promise<Set<string>>;
  previewManualTransaction(input: {
    agentId: string;
    transactionAt: Date;
    debit: bigint;
    credit: bigint;
  }): Promise<ManualBalancePreview | null>;
  createManualTransaction(input: {
    agentId: string;
    transactionAt: Date;
    case: string;
    description: string;
    debit: bigint;
    credit: bigint;
    orderNumber: string | null;
    bookingCode: string | null;
    groupKey: string | null;
    dedupHash: string;
    actorUserId: string;
  }): Promise<ReceiptTransactionRecord>;

  // Imports
  createImportBatchPreview(input: {
    fileName: string;
    uploadedBy: string;
    reportTitle: string | null;
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
    duplicateRows: number;
    rows: ParsedImportPreviewRow[];
  }): Promise<ImportBatchDetailRecord>;
  getImportBatchById(id: string): Promise<ImportBatchDetailRecord | null>;
  listImportBatches(): Promise<ImportBatchSummaryRecord[]>;
  commitImportBatch(
    batchId: string,
    actorUserId: string
  ): Promise<{ importedCount: number; duplicateSkippedCount: number }>;
  cancelImportBatch(batchId: string, actorUserId: string): Promise<void>;

  // Audit
  listAuditLogs(limit?: number): Promise<AppAuditLogRecord[]>;
  writeAuditLog(input: {
    userId: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

