import { localDataRepository } from "./local-store";
import { prismaDataRepository } from "./prisma-store";
import type { AppDataRepository } from "./types";

export function isPrismaDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Mengembalikan repository data aktif:
 * - Jika DATABASE_URL sudah diatur di .env (mis. MySQL XAMPP), gunakan Prisma MySQL.
 * - Jika belum, gunakan penyimpanan persisten lokal (.data/local-db.json).
 */
export function getDataRepository(): AppDataRepository {
  if (isPrismaDatabaseConfigured()) {
    return prismaDataRepository;
  }
  return localDataRepository;
}

