"use client";

/**
 * Wrapper fetch sisi klien yang tangguh:
 * - Menangani kondisi offline, timeout (AbortController), dan respons non-JSON dengan aman.
 * - Mendeteksi kedaluwarsa sesi (HTTP 401) dan memancarkan event global agar pengguna
 *   mendapatkan notifikasi jelas dan diarahkan ke halaman login.
 */

export const SESSION_EXPIRED_EVENT = "manga:session-expired";

export interface ApiSuccessResult<T> {
  ok: true;
  status: number;
  data: T;
}

export interface ApiFailureResult {
  ok: false;
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string>;
  errorId?: string;
}

export type ApiResult<T> = ApiSuccessResult<T> | ApiFailureResult;

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | Record<string, unknown> | null;
  timeoutMs?: number;
  /**
   * Matikan pada endpoint login atau background polling agar HTTP 401
   * tidak memicu redirect sesi berakhir. Default: true.
   */
  redirectOnUnauthorized?: boolean;
  fallbackErrorMessage?: string;
}

function isPlainJsonObject(
  val: unknown
): val is Record<string, unknown> {
  if (typeof val !== "object" || val === null) return false;
  if (typeof FormData !== "undefined" && val instanceof FormData) return false;
  if (typeof Blob !== "undefined" && val instanceof Blob) return false;
  if (typeof URLSearchParams !== "undefined" && val instanceof URLSearchParams) {
    return false;
  }
  if (val instanceof ArrayBuffer || ArrayBuffer.isView(val)) return false;
  return true;
}

export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<ApiResult<T>> {
  const {
    body,
    timeoutMs = 20_000,
    redirectOnUnauthorized = true,
    fallbackErrorMessage = "Terjadi kesalahan. Silakan coba lagi.",
    headers: customHeaders,
    ...restInit
  } = options;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      ok: false,
      status: 0,
      code: "OFFLINE",
      message:
        "Koneksi jaringan terputus. Periksa sambungan internet Anda lalu coba lagi.",
    };
  }

  const controller = new AbortController();
  const externalSignal = restInit.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const timer = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const headers = new Headers(customHeaders);
  let resolvedBody: BodyInit | null | undefined;

  if (isPlainJsonObject(body)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    resolvedBody = JSON.stringify(body);
  } else {
    resolvedBody = body ?? undefined;
  }

  try {
    const res = await fetch(url, {
      ...restInit,
      headers,
      body: resolvedBody,
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") ?? "";
    let parsedJson: Record<string, unknown> | null = null;

    if (contentType.includes("application/json")) {
      try {
        parsedJson = (await res.json()) as Record<string, unknown>;
      } catch {
        parsedJson = null;
      }
    } else {
      const rawText = await res.text().catch(() => "");
      if (rawText.trim().startsWith("{")) {
        try {
          parsedJson = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
          parsedJson = null;
        }
      }
    }

    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        data: (parsedJson ?? ({} as unknown)) as T,
      };
    }

    const code =
      typeof parsedJson?.code === "string"
        ? parsedJson.code
        : res.status === 401
          ? "UNAUTHORIZED"
          : res.status === 403
            ? "FORBIDDEN"
            : res.status === 404
              ? "NOT_FOUND"
              : res.status === 429
                ? "RATE_LIMITED"
                : res.status === 503
                  ? "SERVICE_UNAVAILABLE"
                  : "HTTP_ERROR";

    const defaultStatusMessage =
      res.status === 401
        ? "Sesi Anda berakhir. Silakan masuk kembali."
        : res.status === 403
          ? "Anda tidak memiliki izin untuk melakukan tindakan ini."
          : res.status === 404
            ? "Data atau layanan yang diminta tidak ditemukan."
            : res.status === 413
              ? "Ukuran data atau berkas yang dikirim terlalu besar."
              : res.status === 429
                ? "Terlalu banyak permintaan dalam waktu singkat. Tunggu sebentar lalu coba lagi."
                : res.status === 503
                  ? "Layanan database sedang tidak terjangkau. Coba beberapa saat lagi."
                  : fallbackErrorMessage;

    const message =
      typeof parsedJson?.message === "string" && parsedJson.message.trim()
        ? parsedJson.message
        : defaultStatusMessage;

    const fields =
      parsedJson?.fields &&
      typeof parsedJson.fields === "object" &&
      !Array.isArray(parsedJson.fields)
        ? (parsedJson.fields as Record<string, string>)
        : undefined;

    const errorId =
      typeof parsedJson?.errorId === "string" ? parsedJson.errorId : undefined;

    if (
      res.status === 401 &&
      redirectOnUnauthorized &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(
        new CustomEvent(SESSION_EXPIRED_EVENT, {
          detail: { message },
        })
      );
    }

    return {
      ok: false,
      status: res.status,
      code,
      message,
      fields,
      errorId,
    };
  } catch (err) {
    if (externalSignal?.aborted) {
      return {
        ok: false,
        status: 0,
        code: "ABORTED",
        message: "Permintaan dibatalkan.",
      };
    }

    const isAbort =
      err instanceof DOMException && err.name === "AbortError";

    if (isAbort) {
      return {
        ok: false,
        status: 408,
        code: "TIMEOUT",
        message:
          "Waktu tunggu koneksi habis. Server memerlukan waktu lebih lama dari biasanya, silakan coba lagi.",
      };
    }

    return {
      ok: false,
      status: 0,
      code: "NETWORK_ERROR",
      message:
        "Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda lalu coba lagi.",
    };
  } finally {
    window.clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

