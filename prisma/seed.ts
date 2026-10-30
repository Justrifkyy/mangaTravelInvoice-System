/**
 * Script Seed Database MySQL (XAMPP) — dijalankan lewat: npm run db:seed
 * Mengisi pengaturan awal, agen (JKT-37287 & MKS-20819), akun pengguna (admin & eman),
 * serta 25 baris transaksi contoh terverifikasi secara idempoten.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  SAMPLE_AGENTS,
  SAMPLE_SETTINGS,
  SAMPLE_TRANSACTIONS,
} from "../lib/data/sample-data";
import { computeTransactionDedupHash } from "../lib/domain/ingest";

const prisma = new PrismaClient();

async function main() {
  console.log("Memulai seed database MySQL Manga' Travel...");

  // 1. Pengaturan Usaha
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      businessName: SAMPLE_SETTINGS.businessName,
      logoPath: SAMPLE_SETTINGS.logoPath,
      contactPersonName: SAMPLE_SETTINGS.contactPersonName,
      contactPersonPhone: SAMPLE_SETTINGS.contactPersonPhone,
      address: SAMPLE_SETTINGS.address,
      receiptFooterNote: SAMPLE_SETTINGS.receiptFooterNote,
      showBalanceOnReceipt: SAMPLE_SETTINGS.showBalanceOnReceipt,
      showThermalLogo: SAMPLE_SETTINGS.showThermalLogo,
    },
  });

  // 2. Agen
  const agentMap = new Map<string, string>();
  for (const a of SAMPLE_AGENTS) {
    const saved = await prisma.agent.upsert({
      where: { code: a.code },
      update: {},
      create: {
        id: a.id,
        code: a.code,
        name: a.name,
        openingBalance: a.openingBalance,
        isActive: a.isActive,
      },
    });
    agentMap.set(a.code, saved.id);
  }

  // 3. Pengguna Awal (admin / admin123 dan eman / eman123)
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const emanPasswordHash = await bcrypt.hash("eman123", 10);

  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      name: "Admin Manga' Travel",
      passwordHash: adminPasswordHash,
      role: "admin",
      agentId: null,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { username: "eman" },
    update: {},
    create: {
      username: "eman",
      name: "eman",
      passwordHash: emanPasswordHash,
      role: "agent",
      agentId: agentMap.get("JKT-37287")!,
      isActive: true,
    },
  });

  // 4. Transaksi Contoh (25 baris)
  let insertedTx = 0;
  for (const tx of SAMPLE_TRANSACTIONS) {
    const targetAgentId = agentMap.get(tx.agentCode)!;
    const dedupHash = computeTransactionDedupHash({
      agentId: targetAgentId,
      transactionAt: new Date(tx.transactionAt),
      case: tx.case,
      debit: BigInt(tx.debit),
      credit: BigInt(tx.credit),
      description: tx.description,
    });

    const exists = await prisma.transaction.findUnique({
      where: { dedupHash },
    });
    if (!exists) {
      await prisma.transaction.create({
        data: {
          agentId: targetAgentId,
          transactionAt: new Date(tx.transactionAt),
          case: tx.case,
          description: tx.description,
          debit: BigInt(tx.debit),
          credit: BigInt(tx.credit),
          balance: BigInt(tx.balance),
          orderNumber: tx.orderNumber,
          bookingCode: tx.bookingCode,
          groupKey: tx.groupKey,
          dedupHash,
          source: "import",
          createdBy: adminUser.id,
        },
      });
      insertedTx += 1;
    }
  }

  console.log(
    `Seed selesai! ${insertedTx} transaksi contoh baru ditambahkan. Akun siap: admin/admin123 & eman/eman123.`
  );
}

main()
  .catch((err) => {
    console.error("Seed gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

