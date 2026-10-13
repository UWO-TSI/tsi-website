/**
 * The world routes from the game (specs/multiplayer.md §6, specs/v1-drop.md §3): report, block and (v1) friends. Each
 * answers `{ ok: true, ... }` or `{ ok: false, error }` with the route's own kind words, so the card can say them.
 * Nothing throws: a dropped connection is a failure with a plain sentence.
 */
export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string; code?: string };

const OFFLINE = "Couldn't reach the island just now. Try again in a moment.";

export async function worldCall<T extends object>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...init?.headers } });
    const body = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string; code?: string } & T) | null;
    if (res.ok && body?.ok) return body as { ok: true } & T;
    const error = res.status === 401 ? "Sign in to do that." : body?.error ?? OFFLINE;
    return { ok: false, error, code: body?.code };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

/** The reasons a report offers (the route takes up to 200 characters). */
export const REPORT_REASONS = ["Rude or mean", "Spam or flooding", "Something unsafe", "Something else"] as const;

export function reportWorld(body: { line_id?: string; member_id?: string; room_id?: string; reason: string }) {
  return worldCall<{ report: { id: string } }>("/api/world/report", { method: "POST", body: JSON.stringify(body) });
}
export function blockWorld(memberId: string) {
  return worldCall<{ blocks: unknown[] }>("/api/world/blocks", { method: "POST", body: JSON.stringify({ member_id: memberId }) });
}
