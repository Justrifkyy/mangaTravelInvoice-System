/**
 * Utilitas pemformatan uang dan tanggal secara konsisten di seluruh tabel, detail, dan struk.
 * Sumber: docs/app-spec.json > formatting_rules & docs/design-spec.json > implementation_notes.formatting
 */

export const DEFAULT_APP_TIMEZONE = "Asia/Jakarta";

const idrNumberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const INDONESIAN_SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

export interface FormatRupiahOptions {
  /** Tampilkan '—' jika bernilai 0 (untuk kolom Debet/Kredit di tabel) */
  emptyAsDash?: boolean;
  /** Tambahkan tanda visual '+' atau '-' untuk aksesibilitas buta warna */
  signDisplay?: "none" | "debit" | "credit";
}

/**
 * Format integer Rupiah sesuai aturan: "Rp 2.117.756" (pemisah ribuan titik, tanpa desimal).
 */
export function formatRupiah(
  amount: bigint | number | string,
  options: FormatRupiahOptions = {}
): string {
  const { emptyAsDash = false, signDisplay = "none" } = options;
  const val = typeof amount === "bigint" ? amount : BigInt(amount);

  if (val === 0n && emptyAsDash) {
    return "—";
  }

  const isNegative = val < 0n;
  const absVal = isNegative ? -val : val;
  const formattedDigits = idrNumberFormatter.format(absVal);

  if (isNegative) {
    return `-Rp ${formattedDigits}`;
  }

  if (signDisplay === "debit" && val > 0n) {
    return `-Rp ${formattedDigits}`;
  }

  if (signDisplay === "credit" && val > 0n) {
    return `+Rp ${formattedDigits}`;
  }

  return `Rp ${formattedDigits}`;
}

function getZonedDateParts(
  input: Date | string,
  timeZone: string = DEFAULT_APP_TIMEZONE
) {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  const monthIndex = Number(map.month) - 1;
  return {
    day: map.day,
    monthIndex,
    monthShort: INDONESIAN_SHORT_MONTHS[monthIndex] ?? map.month,
    year: map.year,
    hour: map.hour === "24" ? "00" : map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/**
 * Format tabel & detail: "28 Jul 2026, 14:13:16"
 */
export function formatDateTimeTable(
  input: Date | string,
  timeZone: string = DEFAULT_APP_TIMEZONE
): string {
  const p = getZonedDateParts(input, timeZone);
  if (!p) return "—";
  return `${Number(p.day)} ${p.monthShort} ${p.year}, ${p.hour}:${p.minute}:${p.second}`;
}

/**
 * Format struk ringkas: "28 Jul 2026 14:13"
 */
export function formatDateTimeReceipt(
  input: Date | string,
  timeZone: string = DEFAULT_APP_TIMEZONE
): string {
  const p = getZonedDateParts(input, timeZone);
  if (!p) return "—";
  return `${Number(p.day)} ${p.monthShort} ${p.year} ${p.hour}:${p.minute}`;
}

/**
 * Format tanggal YYYY-MM-DD ke "22 Jul 2026" untuk chip filter.
 */
export function formatIsoDateLabel(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const [, year, monthStr, dayStr] = match;
  const monthIdx = Number(monthStr) - 1;
  const monthLabel = INDONESIAN_SHORT_MONTHS[monthIdx] ?? monthStr;
  return `${Number(dayStr)} ${monthLabel} ${year}`;
}

/**
 * Konversi string tanggal lokal Asia/Jakarta ("YYYY-MM-DD HH:mm:ss") ke objek Date UTC.
 */
export function parseJakartaDateTime(dateTimeStr: string): Date | null {
  const trimmed = dateTimeStr.trim();
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) return null;
  const [, y, m, d, hh = "00", mm = "00", ss = "00"] = match;
  const isoWithOffset = `${y}-${m}-${d}T${hh}:${mm}:${ss}+07:00`;
  const parsed = new Date(isoWithOffset);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

