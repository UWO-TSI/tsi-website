/**
 * Browser side of the game routes: they answer `{ ok: true, [key]: data }` or
 * `{ ok: false, error, code }`. A failure throws ApiError with the route's own
 * wording; `body` keeps the rest (e.g. the Oracle's cooldown `until`).
 */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public body?: Record<string, unknown> | null) {
    super(message);
  }
}

/** Fired on window after every successful write (`detail: { path, data }`): the HUD re-reads coins and XP from it. */
export const API_WRITE = "tsi:api-write";
export function announceWrite(path: string, data: unknown): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(API_WRITE, { detail: { path, data } }));
}

export async function apiCall<T>(path: string, key: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const res = await fetch(path, method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || json?.ok !== true) {
    throw new ApiError(typeof json?.error === "string" ? json.error : "Request failed", res.status, typeof json?.code === "string" ? json.code : undefined, json);
  }
  if (method !== "GET") announceWrite(path, json[key]);
  return json[key] as T;
}

/** Idempotency key for one attempt; reuse it when retrying that attempt. */
export function newKey(): string {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
