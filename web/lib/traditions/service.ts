/**
 * Trick-or-treat on the server (lib/content/traditions.ts; 20261013210000_traditions.sql): a member knocks at a
 * resident's door at night while a tradition with trick-or-treat runs, and the resident answers with a treat and a
 * line, once per resident per night. The server decides everything from its own clock and reads: the calendar, the
 * night (the island's phase from the sun table), the resident (their night routine takes them home), the treat; the
 * client only says whose door. The store does the once-a-night insert and the bag in one transaction.
 */
import { z } from "zod";
import { contentOn, nightKey, normalizeTradition, DEFAULT_TRADITIONS, type Tradition } from "@/lib/content/traditions";
import { treatFor } from "@/lib/collections/treats";
import { islandPhase } from "@/lib/game/islandTime";
import { routineKeys } from "@/lib/game/residentRoutine";

export interface DoorResident { slug: string; display_name: string; schedule?: Record<string, unknown> | null }
export interface TraditionsStore {
  traditions(): Promise<Tradition[]>;
  resident(slug: string): Promise<DoorResident | null>;
  /** Residents who have answered this member tonight. */
  treated(memberId: string, night: string): Promise<string[]>;
  /** Record tonight's treat and put it in the bag; throws "already_treated" or "bag_full". */
  give(memberId: string, resident: string, night: string, itemKey: string): Promise<{ count: number }>;
}
type Result<T> = { ok: true; data: T } | { ok: false; status: number; code: string; error: string };
const fail = (status: number, code: string, error: string): Result<never> => ({ ok: false, status, code, error });

/** Lines a resident answers the door with (drafts for David), one a night by resident. */
export const DOOR_LINES = [
  "[happy] Trick or treat? Treat. Always treat. Here you go!",
  "Oh! You gave me a fright. Here, take one. Quick, before the next ghost.",
  "Is that a costume? It's very good. Have a treat.",
  "I saved the good ones for whoever knocked first. That's you.",
  "The fog's thick tonight. Get home safe, and don't eat it all at once.",
];
export function doorLine(resident: string, night: string): string {
  let h = 7;
  for (const c of `${resident}|${night}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return DOOR_LINES[h % DOOR_LINES.length];
}

/** Does this resident come home at night (and so answer the door)? Their routine's night stops include home. */
export const answersAtNight = (r: Pick<DoorResident, "schedule">) => routineKeys(r.schedule ?? null, "night").includes("home");

export const KnockRequest = z.object({ resident: z.string().regex(/^[a-z0-9-]{1,48}$/) });

/** Tonight's state for the island's prompts: whether trick-or-treat is on, the night, who has answered already. */
export async function tonight(store: TraditionsStore, memberId: string, now: Date): Promise<Result<{ on: boolean; night: string; treated: string[] }>> {
  const rows = await store.traditions().catch(() => [...DEFAULT_TRADITIONS]);
  const night = nightKey(now.getTime());
  const on = contentOn(rows, now.getTime()).trick_or_treat && islandPhase(now) === "night";
  return { ok: true, data: { on, night, treated: on ? await store.treated(memberId, night) : [] } };
}

/** A knock: the treat and the line, or why not. */
export async function knock(store: TraditionsStore, memberId: string, body: unknown, now: Date): Promise<Result<{ resident: string; name: string; line: string; item_key: string; count: number; night: string }>> {
  const parsed = KnockRequest.safeParse(body);
  if (!parsed.success) return fail(400, "invalid", "Invalid request");
  const rows = await store.traditions().catch(() => [...DEFAULT_TRADITIONS]);
  if (!contentOn(rows, now.getTime()).trick_or_treat) return fail(409, "not_running", "Nobody's handing out treats right now.");
  if (islandPhase(now) !== "night") return fail(409, "not_night", "Come back after dark.");
  const r = await store.resident(parsed.data.resident);
  if (!r || !answersAtNight(r)) return fail(404, "nobody_home", "Nobody's home.");
  const night = nightKey(now.getTime()), treat = treatFor(memberId, r.slug, night);
  try {
    const { count } = await store.give(memberId, r.slug, night, treat.key);
    return { ok: true, data: { resident: r.slug, name: r.display_name, line: doorLine(r.slug, night), item_key: treat.key, count, night } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already_treated/.test(msg)) return fail(409, "already_treated", `${r.display_name} already gave you something tonight.`);
    if (/bag_full/.test(msg)) return fail(409, "bag_full", "Your bag's full. Make some room and knock again.");
    return fail(503, "unavailable", "The door didn't open. Try again.");
  }
}

/** The in-memory store (tests, and the dev demo when there is no database). */
export function memoryTraditionsStore(residents: DoorResident[], rows: Tradition[] = [...DEFAULT_TRADITIONS], capacity = Infinity): TraditionsStore & { bag: Map<string, number> } {
  const given = new Set<string>(), bag = new Map<string, number>();
  return {
    bag,
    async traditions() { return rows.map((t) => normalizeTradition({ ...t })); },
    async resident(slug) { return residents.find((r) => r.slug === slug) ?? null; },
    async treated(memberId, night) { return [...given].filter((k) => k.startsWith(`${memberId}|`) && k.endsWith(`|${night}`)).map((k) => k.split("|")[1]); },
    async give(memberId, resident, night, itemKey) {
      const k = `${memberId}|${resident}|${night}`;
      if (given.has(k)) throw new Error("already_treated");
      if (!bag.has(itemKey) && bag.size >= capacity) throw new Error("bag_full");
      given.add(k);
      bag.set(itemKey, (bag.get(itemKey) ?? 0) + 1);
      return { count: bag.get(itemKey)! };
    },
  };
}
