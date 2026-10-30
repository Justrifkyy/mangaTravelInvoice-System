/**
 * Skema validasi dan serialisasi URL query string untuk Filter (F-03) & Pencarian (F-04).
 */

import { parseRupiahToBigInt } from "@/lib/domain/money";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export type DebitCreditFilter = "all" | "debit" | "credit";
export type TransactionSortOrder = "date_desc" | "date_asc";

export interface TransactionFilterQuery {
  page: number;
  pageSize: PageSizeOption;
  sort: TransactionSortOrder;
  q: string;
  from: string; // YYYY-MM-DD atau ""
  to: string; // YYYY-MM-DD atau ""
  cases: string[];
  type: DebitCreditFilter;
  agentCode: string;
  amountMin: string;
  amountMax: string;
  balanceMin: string;
  balanceMax: string;
  desc: string;
  detailId: string;
}

export interface ParsedTransactionQuery {
  query: TransactionFilterQuery;
  amountMinBigInt: bigint | null;
  amountMaxBigInt: bigint | null;
  balanceMinBigInt: bigint | null;
  balanceMaxBigInt: bigint | null;
  validationError: string | null;
  activeFilterCount: number;
  hasActiveSearch: boolean;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstString(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

function allStrings(val: string | string[] | undefined): string[] {
  if (!val) return [];
  const rawList = Array.isArray(val) ? val : [val];
  return rawList
    .flatMap((item) => item.split(","))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseTransactionSearchParams(
  raw: RawSearchParams
): ParsedTransactionQuery {
  const rawPage = Number.parseInt(firstString(raw.page), 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const rawPageSize = Number.parseInt(firstString(raw.pageSize), 10);
  const pageSize: PageSizeOption = PAGE_SIZE_OPTIONS.includes(
    rawPageSize as PageSizeOption
  )
    ? (rawPageSize as PageSizeOption)
    : 25;

  const rawSort = firstString(raw.sort);
  const sort: TransactionSortOrder =
    rawSort === "date_asc" ? "date_asc" : "date_desc";

  const q = firstString(raw.q).trim();

  const rawFrom = firstString(raw.from).trim();
  const from = ISO_DATE_REGEX.test(rawFrom) ? rawFrom : "";

  const rawTo = firstString(raw.to).trim();
  const to = ISO_DATE_REGEX.test(rawTo) ? rawTo : "";

  const cases = Array.from(new Set(allStrings(raw.case)));

  const rawType = firstString(raw.type).trim().toLowerCase();
  const type: DebitCreditFilter =
    rawType === "debit" || rawType === "credit" ? rawType : "all";

  const agentCode = firstString(raw.agentCode).trim();
  const amountMinRaw = firstString(raw.amountMin).trim();
  const amountMaxRaw = firstString(raw.amountMax).trim();
  const balanceMinRaw = firstString(raw.balanceMin).trim();
  const balanceMaxRaw = firstString(raw.balanceMax).trim();
  const desc = firstString(raw.desc).trim();
  const detailId = firstString(raw.detail).trim();

  const amountMinBigInt =
    amountMinRaw !== ""
      ? parseRupiahToBigInt(amountMinRaw, {
          allowNegative: false,
          emptyAsZero: false,
        })
      : null;
  const amountMaxBigInt =
    amountMaxRaw !== ""
      ? parseRupiahToBigInt(amountMaxRaw, {
          allowNegative: false,
          emptyAsZero: false,
        })
      : null;

  const balanceMinBigInt =
    balanceMinRaw !== ""
      ? parseRupiahToBigInt(balanceMinRaw, {
          allowNegative: true,
          emptyAsZero: false,
        })
      : null;
  const balanceMaxBigInt =
    balanceMaxRaw !== ""
      ? parseRupiahToBigInt(balanceMaxRaw, {
          allowNegative: true,
          emptyAsZero: false,
        })
      : null;

  let validationError: string | null = null;
  if (from && to && from > to) {
    validationError = "Tanggal awal tidak boleh setelah tanggal akhir.";
  }

  let activeFilterCount = 0;
  if (from || to) activeFilterCount += 1;
  if (cases.length > 0) activeFilterCount += 1;
  if (type !== "all") activeFilterCount += 1;
  if (agentCode) activeFilterCount += 1;
  if (amountMinBigInt !== null || amountMaxBigInt !== null)
    activeFilterCount += 1;
  if (balanceMinBigInt !== null || balanceMaxBigInt !== null)
    activeFilterCount += 1;
  if (desc) activeFilterCount += 1;

  return {
    query: {
      page,
      pageSize,
      sort,
      q,
      from,
      to,
      cases,
      type,
      agentCode,
      amountMin: amountMinBigInt !== null ? amountMinBigInt.toString() : "",
      amountMax: amountMaxBigInt !== null ? amountMaxBigInt.toString() : "",
      balanceMin: balanceMinBigInt !== null ? balanceMinBigInt.toString() : "",
      balanceMax: balanceMaxBigInt !== null ? balanceMaxBigInt.toString() : "",
      desc,
      detailId,
    },
    amountMinBigInt,
    amountMaxBigInt,
    balanceMinBigInt,
    balanceMaxBigInt,
    validationError,
    activeFilterCount,
    hasActiveSearch: q.length > 0,
  };
}

/**
 * Membangun URL query string bersih (hanya menyertakan parameter non-default).
 */
export function serializeTransactionQuery(
  partial: Partial<TransactionFilterQuery>
): string {
  const params = new URLSearchParams();

  if (partial.q && partial.q.trim()) params.set("q", partial.q.trim());
  if (partial.from) params.set("from", partial.from);
  if (partial.to) params.set("to", partial.to);
  if (partial.cases && partial.cases.length > 0) {
    for (const c of partial.cases) {
      params.append("case", c);
    }
  }
  if (partial.type && partial.type !== "all") params.set("type", partial.type);
  if (partial.agentCode) params.set("agentCode", partial.agentCode);
  if (partial.amountMin) params.set("amountMin", partial.amountMin);
  if (partial.amountMax) params.set("amountMax", partial.amountMax);
  if (partial.balanceMin) params.set("balanceMin", partial.balanceMin);
  if (partial.balanceMax) params.set("balanceMax", partial.balanceMax);
  if (partial.desc && partial.desc.trim()) {
    params.set("desc", partial.desc.trim());
  }
  if (partial.sort && partial.sort !== "date_desc") {
    params.set("sort", partial.sort);
  }
  if (partial.pageSize && partial.pageSize !== 25) {
    params.set("pageSize", String(partial.pageSize));
  }
  if (partial.page && partial.page > 1) {
    params.set("page", String(partial.page));
  }
  if (partial.detailId) {
    params.set("detail", partial.detailId);
  }

  return params.toString();
}

