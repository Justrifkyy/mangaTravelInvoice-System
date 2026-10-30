/**
 * Aturan ekstraksi referensi dari kolom KETERANGAN.
 * Sumber: docs/app-spec.json > extraction_rules
 *
 * Diterapkan saat transaksi dibuat (manual / impor / API) dan disimpan ke kolom terpisah.
 * Jangan parse ulang saat mencetak struk.
 */

export interface ExtractedTransactionRefs {
  orderNumber: string | null;
  bookingCode: string | null;
  groupKey: string | null;
}

const ORDER_NUMBER_REGEX = /No\.\s*Pesanan\s+(\d+)/i;
const BOOKING_CODE_REGEX = /\(Kode\s+Booking\s+([A-Z0-9]+)\)/i;

export function extractTransactionRefs(
  description: string
): ExtractedTransactionRefs {
  if (!description || typeof description !== "string") {
    return {
      orderNumber: null,
      bookingCode: null,
      groupKey: null,
    };
  }

  const orderMatch = description.match(ORDER_NUMBER_REGEX);
  const bookingMatch = description.match(BOOKING_CODE_REGEX);

  const orderNumber = orderMatch?.[1] ?? null;
  const bookingCode = bookingMatch?.[1] ? bookingMatch[1].toUpperCase() : null;

  return {
    orderNumber,
    bookingCode,
    groupKey: orderNumber,
  };
}

