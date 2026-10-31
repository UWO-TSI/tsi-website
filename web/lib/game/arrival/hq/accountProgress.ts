/**
 * The HQ visit's and the tool quests' progress on the account (t-hq: "store its progress on the account, not the
 * device"): kept in `profiles.preferences.onboarding` as { hq: { beat, done }, tools }, behind /api/world/onboarding.
 * The device keeps a copy (store.ts) so the room reacts at once; on load the two are merged, the further along winning.
 * Nothing that pays reads this: rewards stay on the ledger's idempotent keys (arrivalService, grant.ts), so writing
 * it by hand earns nothing.
 */
import { parseVisit, type HqState } from "./visit";
import { parseQuests, type ToolQuests } from "./teachers";

export interface SavedVisit { beat: number; done: boolean }
export interface AccountProgress { hq: SavedVisit | null; tools: ToolQuests }

const saved = (v: HqState | null): SavedVisit | null => v && { beat: v.beat, done: v.done };
const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : {});

/** What the account holds (anything malformed is nothing). */
export function readProgress(preferences: unknown): AccountProgress {
  const o = obj(obj(preferences).onboarding);
  return { hq: saved(parseVisit(o.hq)), tools: parseQuests(o.tools) };
}

/** The preferences with `patch` merged in (null: the patch isn't progress at all). Only the further along is kept. */
export function writeProgress(preferences: unknown, patch: unknown): Record<string, unknown> | null {
  const p = obj(patch);
  if (!("hq" in p) && !("tools" in p)) return null;
  const hq = "hq" in p ? saved(parseVisit(p.hq)) : null;
  if ("hq" in p && p.hq !== null && !hq) return null;
  const was = readProgress(preferences);
  const next = mergeProgress(was, { hq, tools: parseQuests(p.tools) });
  return { ...obj(preferences), onboarding: next };
}

const rank = (v: SavedVisit | null) => (!v ? -1 : v.done ? Infinity : v.beat);
/** Two copies of the progress as one: the visit further along, each tool's quest at its furthest. */
export function mergeProgress(a: AccountProgress, b: AccountProgress): AccountProgress {
  const tools: ToolQuests = { ...a.tools };
  for (const [k, v] of Object.entries(b.tools) as [keyof ToolQuests, "given" | "done"][]) if (tools[k] !== "done") tools[k] = v;
  return { hq: rank(b.hq) > rank(a.hq) ? b.hq : a.hq, tools };
}
