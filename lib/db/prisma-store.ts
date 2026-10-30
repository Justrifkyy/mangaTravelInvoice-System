/**
 * Implementasi AppDataRepository berbasis Prisma + MySQL (XAMPP).
 * Aktif secara otomatis begitu variabel lingkungan DATABASE_URL diisi pada file .env.
 */

import type { Prisma } from "@prisma/client";
import { SAMPLE_SETTINGS } from "@/lib/data/sample-data";
import { calculateAgentRunningBalances } from "@/lib/domain/balance";
import type { ParsedImportPreviewRow } from "@/lib/domain/excel-parser";
import type {
  ReceiptBusinessSettings,
  ReceiptTransactionRecord,
} from "@/lib/domain/receipt";
import { getPrismaClient } from "./prisma";
import type {
  AppAgentRecord,
  AppAuditLogRecord,
  AppDataRepository,
  AppUserRecord,
  ImportBatchSummaryRecord,
  ManualBalancePreview,
  SessionUser,
} from "./types";

interface StoredPreviewJson {
  reportTitle: string | null;
  rows: ParsedImportPreviewRow[];
}

async function recalculateAgentBalancesPrisma(
  txClient: Prisma.TransactionClient,
  agentId: string
): Promise<void> {
  const agent = await txClient.agent.findUnique({ where: { id: agentId } });
  if (!agent) return;

  const txs = await txClient.transaction.findMany({
    where: { agentId },
    orderBy: [{ transactionAt: "asc" }, { id: "asc" }],
  });

  const computed = calculateAgentRunningBalances(
    agent.openingBalance,
    txs.map((t) => ({
      id: t.id,
      agentId: t.agentId,
      transactionAt: t.transactionAt,
      debit: t.debit,
      credit: t.credit,
    }))
  );

  for (const c of computed) {
    const orig = txs.find((t) => t.id === c.item.id);
    if (orig && orig.balance !== c.balanceAfter) {
      await txClient.transaction.update({
        where: { id: c.item.id },
        data: { balance: c.balanceAfter },
      });
    }
  }
}

export const prismaDataRepository: AppDataRepository = {
  async findUserByUsername(username) {
    const prisma = getPrismaClient();
    const u = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      include: { agent: true },
    });
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      passwordHash: u.passwordHash,
      role: u.role,
      agentId: u.agentId,
      agentCode: u.agent?.code ?? null,
      agentName: u.agent?.name ?? null,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    };
  },

  async findUserById(id) {
    const prisma = getPrismaClient();
    const u = await prisma.user.findUnique({
      where: { id },
      include: { agent: true },
    });
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      passwordHash: u.passwordHash,
      role: u.role,
      agentId: u.agentId,
      agentCode: u.agent?.code ?? null,
      agentName: u.agent?.name ?? null,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    };
  },

  async recordUserLogin(userId) {
    const prisma = getPrismaClient();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: "login",
          entity: "users",
          entityId: userId,
        },
      }),
    ]);
  },

  async listUsers(): Promise<AppUserRecord[]> {
    const prisma = getPrismaClient();
    const users = await prisma.user.findMany({
      include: { agent: true },
      orderBy: { username: "asc" },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      passwordHash: u.passwordHash,
      role: u.role,
      agentId: u.agentId,
      agentCode: u.agent?.code ?? null,
      agentName: u.agent?.name ?? null,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));
  },

  async createUser(input) {
    const prisma = getPrismaClient();
    const username = input.username.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) {
      throw new Error("Username sudah digunakan.");
    }
    if (input.role === "agent" && !input.agentId) {
      throw new Error("Pengguna peran Agen wajib ditautkan ke agen.");
    }

    const created = await prisma.user.create({
      data: {
        username,
        name: input.name.trim(),
        passwordHash: input.passwordHash,
        role: input.role,
        agentId: input.role === "agent" ? input.agentId : null,
      },
      include: { agent: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: "user_create",
        entity: "users",
        entityId: created.id,
        metadata: { username: created.username, role: created.role },
      },
    });

    return {
      id: created.id,
      username: created.username,
      name: created.name,
      passwordHash: created.passwordHash,
      role: created.role,
      agentId: created.agentId,
      agentCode: created.agent?.code ?? null,
      agentName: created.agent?.name ?? null,
      isActive: created.isActive,
      lastLoginAt: created.lastLoginAt?.toISOString() ?? null,
      createdAt: created.createdAt.toISOString(),
    };
  },

  async updateUser(input) {
    const prisma = getPrismaClient();
    const existing = await prisma.user.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Pengguna tidak ditemukan.");

    if (input.isActive === false && existing.id === input.actorUserId) {
      throw new Error("Admin tidak boleh menonaktifkan dirinya sendiri.");
    }

    const nextRole = input.role ?? existing.role;
    const nextAgentId =
      nextRole === "admin"
        ? null
        : input.agentId !== undefined
          ? input.agentId
          : existing.agentId;

    if (nextRole === "agent" && !nextAgentId) {
      throw new Error("Pengguna peran Agen wajib ditautkan ke agen.");
    }

    const updated = await prisma.user.update({
      where: { id: input.id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        role: nextRole,
        agentId: nextAgentId,
        isActive: input.isActive,
        passwordHash: input.passwordHash,
      },
      include: { agent: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: "user_update",
        entity: "users",
        entityId: updated.id,
        metadata: {
          role: updated.role,
          isActive: updated.isActive,
          passwordReset: Boolean(input.passwordHash),
        },
      },
    });

    return {
      id: updated.id,
      username: updated.username,
      name: updated.name,
      passwordHash: updated.passwordHash,
      role: updated.role,
      agentId: updated.agentId,
      agentCode: updated.agent?.code ?? null,
      agentName: updated.agent?.name ?? null,
      isActive: updated.isActive,
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    };
  },

  async listAgents(): Promise<AppAgentRecord[]> {
    const prisma = getPrismaClient();
    const agents = await prisma.agent.findMany({
      include: {
        _count: { select: { transactions: true, users: true } },
        transactions: {
          orderBy: [{ transactionAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { balance: true },
        },
      },
      orderBy: { code: "asc" },
    });

    return agents.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      openingBalance: a.openingBalance.toString(),
      currentBalance: (
        a.transactions[0]?.balance ?? a.openingBalance
      ).toString(),
      transactionCount: a._count.transactions,
      userCount: a._count.users,
      isActive: a.isActive,
      createdAt: a.createdAt.toISOString(),
    }));
  },

  async findAgentById(id) {
    const all = await this.listAgents();
    return all.find((a) => a.id === id) ?? null;
  },

  async findAgentByCode(code) {
    const all = await this.listAgents();
    const norm = code.trim().toUpperCase();
    return all.find((a) => a.code.toUpperCase() === norm) ?? null;
  },

  async createAgent(input) {
    const prisma = getPrismaClient();
    const code = input.code.trim().toUpperCase();
    const exists = await prisma.agent.findUnique({ where: { code } });
    if (exists) {
      throw new Error("Kode agen sudah terdaftar.");
    }

    const created = await prisma.agent.create({
      data: {
        code,
        name: input.name.trim(),
        openingBalance: input.openingBalance,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: "agent_create",
        entity: "agents",
        entityId: created.id,
        metadata: { code: created.code },
      },
    });

    return {
      id: created.id,
      code: created.code,
      name: created.name,
      openingBalance: created.openingBalance.toString(),
      currentBalance: created.openingBalance.toString(),
      transactionCount: 0,
      userCount: 0,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
    };
  },

  async updateAgent(input) {
    const prisma = getPrismaClient();
    const existing = await prisma.agent.findUnique({
      where: { id: input.id },
      include: { _count: { select: { transactions: true } } },
    });
    if (!existing) throw new Error("Agen tidak ditemukan.");

    let nextCode = existing.code;
    if (input.code !== undefined) {
      const candidate = input.code.trim().toUpperCase();
      if (candidate !== existing.code) {
        if (existing._count.transactions > 0) {
          throw new Error(
            "Kode agen tidak boleh diubah setelah memiliki transaksi."
          );
        }
        const collision = await prisma.agent.findUnique({
          where: { code: candidate },
        });
        if (collision) {
          throw new Error("Kode agen sudah digunakan oleh agen lain.");
        }
        nextCode = candidate;
      }
    }

    await prisma.agent.update({
      where: { id: input.id },
      data: {
        code: nextCode,
        name: input.name !== undefined ? input.name.trim() : undefined,
        isActive: input.isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: "agent_update",
        entity: "agents",
        entityId: input.id,
        metadata: { code: nextCode, isActive: input.isActive },
      },
    });

    const refreshed = await this.findAgentById(input.id);
    if (!refreshed) throw new Error("Gagal memuat data agen.");
    return refreshed;
  },

  async getSettings(): Promise<ReceiptBusinessSettings> {
    const prisma = getPrismaClient();
    const s = await prisma.setting.findUnique({ where: { id: 1 } });
    if (!s) {
      return { ...SAMPLE_SETTINGS };
    }
    return {
      businessName: s.businessName,
      logoPath: s.logoPath || "/brand/logo.svg",
      contactPersonName: s.contactPersonName,
      contactPersonPhone: s.contactPersonPhone,
      address: s.address,
      receiptFooterNote: s.receiptFooterNote,
      showBalanceOnReceipt: s.showBalanceOnReceipt,
      showThermalLogo: s.showThermalLogo,
    };
  },

  async updateSettings(input, actorUserId) {
    const prisma = getPrismaClient();
    const s = await prisma.setting.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        businessName: input.businessName,
        logoPath: input.logoPath,
        contactPersonName: input.contactPersonName,
        contactPersonPhone: input.contactPersonPhone,
        address: input.address,
        receiptFooterNote: input.receiptFooterNote,
        showBalanceOnReceipt: input.showBalanceOnReceipt,
        showThermalLogo: input.showThermalLogo,
      },
      update: {
        businessName: input.businessName,
        logoPath: input.logoPath,
        contactPersonName: input.contactPersonName,
        contactPersonPhone: input.contactPersonPhone,
        address: input.address,
        receiptFooterNote: input.receiptFooterNote,
        showBalanceOnReceipt: input.showBalanceOnReceipt,
        showThermalLogo: input.showThermalLogo,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: "setting_update",
        entity: "settings",
        entityId: "1",
      },
    });

    return {
      businessName: s.businessName,
      logoPath: s.logoPath || "/brand/logo.svg",
      contactPersonName: s.contactPersonName,
      contactPersonPhone: s.contactPersonPhone,
      address: s.address,
      receiptFooterNote: s.receiptFooterNote,
      showBalanceOnReceipt: s.showBalanceOnReceipt,
      showThermalLogo: s.showThermalLogo,
    };
  },

  async listAllTransactionsForScope(
    session: SessionUser
  ): Promise<ReceiptTransactionRecord[]> {
    const prisma = getPrismaClient();
    const where: Prisma.TransactionWhereInput =
      session.role === "agent" ? { agentId: session.agentId ?? "__none__" } : {};

    const rows = await prisma.transaction.findMany({
      where,
      include: { agent: true },
      orderBy: [{ transactionAt: "desc" }, { id: "desc" }],
    });

    return rows.map((t) => ({
      id: t.id.toString(),
      agentId: t.agentId,
      agentCode: t.agent.code,
      agentName: t.agent.name,
      transactionAt: t.transactionAt.toISOString(),
      case: t.case,
      description: t.description,
      debit: t.debit.toString(),
      credit: t.credit.toString(),
      balance: t.balance.toString(),
      orderNumber: t.orderNumber,
      bookingCode: t.bookingCode,
      groupKey: t.groupKey,
      source: t.source,
    }));
  },

  async listExistingDedupHashes() {
    const prisma = getPrismaClient();
    const rows = await prisma.transaction.findMany({
      where: { dedupHash: { not: null } },
      select: { dedupHash: true },
    });
    return new Set(
      rows.map((r) => r.dedupHash).filter((v): v is string => Boolean(v))
    );
  },

  async previewManualTransaction(input): Promise<ManualBalancePreview | null> {
    const prisma = getPrismaClient();
    const agent = await prisma.agent.findUnique({
      where: { id: input.agentId },
    });
    if (!agent) return null;

    const latestBefore = await prisma.transaction.findFirst({
      where: {
        agentId: agent.id,
        transactionAt: { lte: input.transactionAt },
      },
      orderBy: [{ transactionAt: "desc" }, { id: "desc" }],
    });

    const subsequentCount = await prisma.transaction.count({
      where: {
        agentId: agent.id,
        transactionAt: { gt: input.transactionAt },
      },
    });

    const balanceBefore = latestBefore
      ? latestBefore.balance
      : agent.openingBalance;
    const balanceAfter = balanceBefore + input.credit - input.debit;

    return {
      agentCode: agent.code,
      agentName: agent.name,
      balanceBefore: balanceBefore.toString(),
      balanceAfter: balanceAfter.toString(),
      isBackdated: subsequentCount > 0,
      affectedSubsequentCount: subsequentCount,
    };
  },

  async createManualTransaction(input) {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      const agent = await tx.agent.findUnique({ where: { id: input.agentId } });
      if (!agent) throw new Error("Agen tidak ditemukan.");
      if (!agent.isActive) {
        throw new Error("Tidak dapat menambah transaksi pada agen nonaktif.");
      }

      const existingHash = await tx.transaction.findUnique({
        where: { dedupHash: input.dedupHash },
      });
      const finalHash = existingHash
        ? `${input.dedupHash}-manual-${Date.now()}`
        : input.dedupHash;

      const created = await tx.transaction.create({
        data: {
          agentId: agent.id,
          transactionAt: input.transactionAt,
          case: input.case,
          description: input.description,
          debit: input.debit,
          credit: input.credit,
          balance: 0n,
          orderNumber: input.orderNumber,
          bookingCode: input.bookingCode,
          groupKey: input.groupKey,
          dedupHash: finalHash,
          source: "manual",
          createdBy: input.actorUserId,
        },
      });

      await recalculateAgentBalancesPrisma(tx, agent.id);

      const refreshed = await tx.transaction.findUniqueOrThrow({
        where: { id: created.id },
        include: { agent: true },
      });

      await tx.auditLog.create({
        data: {
          userId: input.actorUserId,
          action: "create_transaction",
          entity: "transactions",
          entityId: refreshed.id.toString(),
          metadata: {
            agentCode: agent.code,
            case: input.case,
            debit: input.debit.toString(),
            credit: input.credit.toString(),
          },
        },
      });

      return {
        id: refreshed.id.toString(),
        agentId: refreshed.agentId,
        agentCode: refreshed.agent.code,
        agentName: refreshed.agent.name,
        transactionAt: refreshed.transactionAt.toISOString(),
        case: refreshed.case,
        description: refreshed.description,
        debit: refreshed.debit.toString(),
        credit: refreshed.credit.toString(),
        balance: refreshed.balance.toString(),
        orderNumber: refreshed.orderNumber,
        bookingCode: refreshed.bookingCode,
        groupKey: refreshed.groupKey,
        source: refreshed.source,
      };
    });
  },

  async createImportBatchPreview(input) {
    const prisma = getPrismaClient();
    const payload: StoredPreviewJson = {
      reportTitle: input.reportTitle,
      rows: input.rows,
    };

    const created = await prisma.importBatch.create({
      data: {
        fileName: input.fileName,
        uploadedBy: input.uploadedBy,
        status: "previewed",
        totalRows: input.totalRows,
        validRows: input.validRows,
        warningRows: input.warningRows,
        errorRows: input.errorRows,
        duplicateRows: input.duplicateRows,
        previewPayload: payload as unknown as Prisma.InputJsonValue,
      },
      include: { uploader: true },
    });

    return {
      id: created.id,
      fileName: created.fileName,
      uploadedBy: created.uploadedBy,
      uploaderName: created.uploader.name,
      status: created.status,
      totalRows: created.totalRows,
      validRows: created.validRows,
      warningRows: created.warningRows,
      errorRows: created.errorRows,
      duplicateRows: created.duplicateRows,
      reportTitle: input.reportTitle,
      createdAt: created.createdAt.toISOString(),
      committedAt: null,
      rows: input.rows,
    };
  },

  async getImportBatchById(id) {
    const prisma = getPrismaClient();
    const b = await prisma.importBatch.findUnique({
      where: { id },
      include: { uploader: true },
    });
    if (!b) return null;

    const payload = (b.previewPayload ?? {
      reportTitle: null,
      rows: [],
    }) as unknown as StoredPreviewJson;

    return {
      id: b.id,
      fileName: b.fileName,
      uploadedBy: b.uploadedBy,
      uploaderName: b.uploader.name,
      status: b.status,
      totalRows: b.totalRows,
      validRows: b.validRows,
      warningRows: b.warningRows,
      errorRows: b.errorRows,
      duplicateRows: b.duplicateRows,
      reportTitle: payload.reportTitle ?? null,
      createdAt: b.createdAt.toISOString(),
      committedAt: b.committedAt?.toISOString() ?? null,
      rows: payload.rows ?? [],
    };
  },

  async listImportBatches(): Promise<ImportBatchSummaryRecord[]> {
    const prisma = getPrismaClient();
    const batches = await prisma.importBatch.findMany({
      include: { uploader: true },
      orderBy: { createdAt: "desc" },
    });

    return batches.map((b) => {
      const payload = (b.previewPayload ?? {
        reportTitle: null,
      }) as unknown as Partial<StoredPreviewJson>;

      return {
        id: b.id,
        fileName: b.fileName,
        uploadedBy: b.uploadedBy,
        uploaderName: b.uploader.name,
        status: b.status,
        totalRows: b.totalRows,
        validRows: b.validRows,
        warningRows: b.warningRows,
        errorRows: b.errorRows,
        duplicateRows: b.duplicateRows,
        reportTitle: payload.reportTitle ?? null,
        createdAt: b.createdAt.toISOString(),
        committedAt: b.committedAt?.toISOString() ?? null,
      };
    });
  },

  async commitImportBatch(batchId, actorUserId) {
    const prisma = getPrismaClient();

    return prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id: batchId },
      });
      if (!batch) throw new Error("Batch pratinjau impor tidak ditemukan.");
      if (batch.status !== "previewed") {
        throw new Error("Batch impor ini sudah pernah diproses atau dibatalkan.");
      }

      const payload = (batch.previewPayload ?? {
        reportTitle: null,
        rows: [],
      }) as unknown as StoredPreviewJson;

      const candidateRows = (payload.rows ?? [])
        .filter((r) => Boolean(r.prepared))
        .map((r, idx, arr) => ({
          prepared: r.prepared!,
          fileReverseOrder: arr.length - idx,
        }));

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
        const dup = await tx.transaction.findUnique({
          where: { dedupHash: prepared.dedupHash },
        });
        if (dup) {
          duplicateSkippedCount += 1;
          continue;
        }

        if (prepared.derivedOpeningBalance !== null) {
          const priorCount = await tx.transaction.count({
            where: { agentId: prepared.agentId },
          });
          if (priorCount === 0) {
            await tx.agent.update({
              where: { id: prepared.agentId },
              data: { openingBalance: BigInt(prepared.derivedOpeningBalance) },
            });
          }
        }

        await tx.transaction.create({
          data: {
            agentId: prepared.agentId,
            transactionAt: new Date(prepared.transactionAtIso),
            case: prepared.case,
            description: prepared.description,
            debit: BigInt(prepared.debit),
            credit: BigInt(prepared.credit),
            balance: 0n,
            orderNumber: prepared.orderNumber,
            bookingCode: prepared.bookingCode,
            groupKey: prepared.groupKey,
            dedupHash: prepared.dedupHash,
            source: "import",
            importBatchId: batch.id,
            createdBy: actorUserId,
          },
        });

        affectedAgents.add(prepared.agentId);
        importedCount += 1;
      }

      for (const agentId of affectedAgents) {
        await recalculateAgentBalancesPrisma(tx, agentId);
      }

      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "committed",
          committedAt: new Date(),
          validRows: importedCount,
          duplicateRows: duplicateSkippedCount,
          previewPayload: {
            reportTitle: payload.reportTitle,
            rows: [],
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "import_commit",
          entity: "import_batches",
          entityId: batch.id,
          metadata: {
            fileName: batch.fileName,
            importedCount,
            duplicateSkippedCount,
          },
        },
      });

      return { importedCount, duplicateSkippedCount };
    });
  },

  async cancelImportBatch(batchId, actorUserId) {
    const prisma = getPrismaClient();
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new Error("Batch impor tidak ditemukan.");
    if (batch.status !== "previewed") {
      throw new Error("Hanya batch berstatus pratinjau yang dapat dibatalkan.");
    }

    await prisma.$transaction([
      prisma.importBatch.update({
        where: { id: batchId },
        data: {
          status: "cancelled",
          previewPayload: { reportTitle: null, rows: [] },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: actorUserId,
          action: "import_cancel",
          entity: "import_batches",
          entityId: batchId,
        },
      }),
    ]);
  },

  async listAuditLogs(limit = 200): Promise<AppAuditLogRecord[]> {
    const prisma = getPrismaClient();
    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: { username: true, name: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id.toString(),
      userId: log.userId,
      username: log.user?.username ?? null,
      userName: log.user?.name ?? null,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      metadata:
        log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
          ? (log.metadata as Record<string, unknown>)
          : null,
      createdAt: log.createdAt.toISOString(),
    }));
  },

  async writeAuditLog(input) {
    const prisma = getPrismaClient();
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  },
};
