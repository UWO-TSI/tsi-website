/**
 * Service plumbing shared by the game domains: the Result routes return, a
 * domain error carrying the SQL function's code, and the PostgREST mapping.
 * Pure, so the in-memory stores behind the browser demos can use it too.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code: string };

export class DomainError<C extends string = string> extends Error {
  constructor(public code: C, message?: string) {
    super(message ?? code);
  }
}

const MISSING = ["42P01", "PGRST205", "PGRST202", "42703", "42883"];

/** Missing table/function → "unavailable"; else the longest listed code the message names; else "failed". */
export function raisePg(error: { code?: string; message?: string } | null | undefined, codes: readonly string[]): never {
  const msg = error?.message ?? "";
  if (MISSING.includes(error?.code ?? "") || /does not exist|schema cache/i.test(msg)) throw new DomainError("unavailable", msg);
  throw new DomainError([...codes].sort((a, b) => b.length - a.length).find((c) => msg.includes(c)) ?? "failed", msg);
}

/** A caught error as a failed Result, worded by the domain's table (which must have `failed`). */
export function toFailure<T>(messages: Record<string, [number, string]>, err: unknown): Result<T> {
  const code = err instanceof DomainError ? err.code : "failed";
  const [status, error] = messages[code] ?? messages.failed;
  return { ok: false, status, error, code };
}
