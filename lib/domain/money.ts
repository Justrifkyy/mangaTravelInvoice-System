/**
 * Utilitas nominal uang Rupiah berbasis BIGINT (integer Rupiah, TANPA float).
 * Sumber: docs/app-spec.json > data_model.money_rule & F-08 > number_parsing
 */

/**
 * Mengurai input nominal uang ke bigint (Rupiah bulat).
 * Menerima angka bulat murni (2117756), bigint, string kosong (0n), atau string
 * berformat ribuan seperti "2,117,756", "2.117.756", "Rp 2.117.756", "-150.000".
 * Mengembalikan null jika format tidak valid atau memiliki desimal pecahan non-nol.
 */
export function parseRupiahToBigInt(
  raw: string | number | bigint | null | undefined,
  options: { allowNegative?: boolean; emptyAsZero?: boolean } = {}
): bigint | null {
  const { allowNegative = false, emptyAsZero = true } = options;

  if (raw === null || raw === undefined) {
    return emptyAsZero ? 0n : null;
  }

  if (typeof raw === "bigint") {
    if (!allowNegative && raw < 0n) return null;
    return raw;
  }

  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      return null;
    }
    if (!allowNegative && raw < 0) return null;
    return BigInt(raw);
  }

  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "—") {
    return emptyAsZero && trimmed !== "-" ? 0n : null;
  }

  // Hilangkan awalan Rp / IDR dan spasi
  let cleaned = trimmed.replace(/^(rp\.?|idr)\s*/i, "").trim();

  let isNegative = false;
  if (cleaned.startsWith("-")) {
    isNegative = true;
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1).trim();
  }

  // Hilangkan spasi internal
  cleaned = cleaned.replace(/\s+/g, "");

  // Validasi hanya berisi digit, titik, atau koma pemisah ribuan
  if (!/^[\d.,]+$/.test(cleaned)) {
    return null;
  }

  // Hilangkan pemisah ribuan titik dan koma (Rupiah tidak memakai sen/desimal pada sistem ini)
  const digitsOnly = cleaned.replace(/[.,]/g, "");
  if (!/^\d+$/.test(digitsOnly)) {
    return null;
  }

  const value = BigInt(digitsOnly);
  const signed = isNegative ? -value : value;

  if (!allowNegative && signed < 0n) {
    return null;
  }

  return signed;
}

