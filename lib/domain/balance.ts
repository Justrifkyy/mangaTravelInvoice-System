/**
 * Aturan perhitungan saldo berjalan (running balance) per agen.
 * Sumber: docs/app-spec.json > balance_rules
 *
 * Rumus:
 *   balance_setelah = balance_sebelumnya + credit - debit
 * Dihitung PER AGEN, diurutkan berdasarkan transaction_at menaik (ASC),
 * lalu id menaik (ASC) untuk memutus seri pada detik yang sama.
 */

export interface BalanceInputItem {
  id: bigint;
  agentId: string;
  transactionAt: Date;
  debit: bigint;
  credit: bigint;
}

export interface BalanceComputedItem<T extends BalanceInputItem> {
  item: T;
  balanceBefore: bigint;
  balanceAfter: bigint;
}

/**
 * Menurunkan saldo awal agen dari baris kronologis paling awal pada file impor pertama:
 *   opening = saldo_di_file - credit + debit
 */
export function deriveOpeningBalance(params: {
  fileBalance: bigint;
  credit: bigint;
  debit: bigint;
}): bigint {
  return params.fileBalance - params.credit + params.debit;
}

/**
 * Mengurutkan transaksi secara kronologis (transactionAt ASC, lalu id ASC)
 * dan menghitung saldo berjalan mulai dari openingBalance.
 */
export function calculateAgentRunningBalances<T extends BalanceInputItem>(
  openingBalance: bigint,
  transactions: readonly T[]
): BalanceComputedItem<T>[] {
  const sorted = [...transactions].sort((a, b) => {
    const timeDiff = a.transactionAt.getTime() - b.transactionAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  let running = openingBalance;
  return sorted.map((item) => {
    const balanceBefore = running;
    const balanceAfter = balanceBefore + item.credit - item.debit;
    running = balanceAfter;
    return {
      item,
      balanceBefore,
      balanceAfter,
    };
  });
}

