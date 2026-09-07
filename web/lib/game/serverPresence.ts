import { presenceRequest, PresenceRequestError } from "./mobilePresence";

export interface OnlinePlayer {
  user_id: string; display_name: string; level: number; class: string | null; tier: number; recorded_at: string;
}
export interface OnlineNPC {
  id: string; display_name: string; spawn_zone: string; is_permanent: boolean;
}
export interface UpcomingEvent {
  id: string; title: string; start_time: string; location: string | null;
}
export interface OnlineData {
  online: OnlinePlayer[]; recent: OnlinePlayer[]; npcs: OnlineNPC[]; events: UpcomingEvent[];
}
export const EMPTY_PRESENCE: OnlineData = { online: [], recent: [], npcs: [], events: [] };

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const date = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const positiveInteger = (value: unknown, fallback: number) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;

export function parseServerPresence(value: unknown): OnlineData {
  if (!record(value) || !Array.isArray(value.online) || !Array.isArray(value.recent) || !Array.isArray(value.npcs) || !Array.isArray(value.events)) throw new Error("Invalid presence response");
  const seen = new Set<string>();
  const players = (rows: unknown[]): OnlinePlayer[] => rows.flatMap((row) => {
    if (!record(row) || !text(row.user_id) || !date(row.recorded_at) || seen.has(row.user_id)) return [];
    seen.add(row.user_id);
    return [{ user_id: row.user_id, recorded_at: row.recorded_at, display_name: text(row.display_name) ? row.display_name : "Visitor", level: positiveInteger(row.level, 1), class: text(row.class) ? row.class : null, tier: positiveInteger(row.tier, 5) }];
  });
  return {
    online: players(value.online), recent: players(value.recent),
    npcs: value.npcs.flatMap((row) => record(row) && text(row.id) && text(row.display_name) ? [{ id: row.id, display_name: row.display_name, spawn_zone: text(row.spawn_zone) ? row.spawn_zone : "Village", is_permanent: row.is_permanent === true }] : []),
    events: value.events.flatMap((row) => record(row) && text(row.id) && text(row.title) && date(row.start_time) ? [{ id: row.id, title: row.title, start_time: row.start_time, location: text(row.location) ? row.location : null }] : []),
  };
}

export async function fetchServerPresence(fetcher: typeof fetch = fetch): Promise<OnlineData> {
  return presenceRequest(async (signal) => {
    const response = await fetcher("/api/server/online", { signal });
    if (!response.ok) throw new PresenceRequestError(response.status);
    return parseServerPresence(await response.json());
  }, new AbortController().signal);
}

export function presenceAge(iso: string, now = Date.now()): string {
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) return "Time unavailable";
  const minutes = Math.max(0, Math.floor((now - stamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return "1d+ ago";
}

export function upcomingTime(iso: string, now = Date.now()): string {
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) return "Time unavailable";
  const minutes = Math.ceil((stamp - now) / 60_000);
  if (minutes <= 0) return "started";
  if (minutes < 5) return "starting soon";
  return `in ${minutes}m`;
}
