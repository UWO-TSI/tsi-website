/**
 * The peaceful tools (rows 62, 193, 279; specs/game-ui.md): rods, nets and shovels in five tiers. The one in your
 * hand decides what left click does, and the server rolls a cast with the held rod's tier (checked against what you
 * own), never the best you own. Tier 1 of each is everyone's, as the flimsy rod always was. `key` is the
 * inventory's: a rod's catalogue_ref, a net's or shovel's shop slug (they have no ref). Tools never break (row 279).
 * Rod tiers' effects are rods.ts; nets and shovels have none yet (specs/game-ui-questions.md).
 */
import { RODS } from "./rods";

export type ToolKind = "rod" | "net" | "shovel" | "pickaxe";
export type ToolTier = 1 | 2 | 3 | 4 | 5;
export interface Tool { kind: ToolKind; tier: ToolTier; key: string; name: string; source: "starter" | "shop" | "crafted"; model: string; icon: string }

const tool = (kind: ToolKind, tier: ToolTier, key: string, name: string, source: Tool["source"]): Tool =>
  ({ kind, tier, key, name, source, model: `/assets/game/tools/${kind}-${tier}.glb`, icon: `/assets/icons/${key}.webp` });

export const TOOLS: readonly Tool[] = [
  ...RODS.map(r => tool("rod", r.tier, r.key, r.name, r.source)),
  tool("net", 1, "net-basic", "Bug net", "starter"), tool("net", 2, "net-mid", "Wide net", "shop"),
  tool("net", 3, "net-silk", "Silk net", "crafted"), tool("net", 4, "net-dragonfly", "Dragonfly net", "crafted"), tool("net", 5, "net-emperor", "Emperor net", "crafted"),
  tool("shovel", 1, "shovel-basic", "Shovel", "starter"), tool("shovel", 2, "shovel-mid", "Iron shovel", "shop"),
  tool("shovel", 3, "shovel-sturdy", "Sturdy shovel", "crafted"), tool("shovel", 4, "shovel-crystal", "Crystal shovel", "crafted"), tool("shovel", 5, "shovel-gold", "Golden shovel", "crafted"),
  // m6: Mayor Eliza's pickaxe breaks rocks (stone, sometimes iron). One tier for now, and nobody's starter: everyone
  // gets it from her (lib/game/arrival/hq/teachers.ts), whenever they arrived.
  tool("pickaxe", 1, "pickaxe-basic", "Pickaxe", "shop"),
];

export const toolByKey = (key: unknown): Tool | null => TOOLS.find(t => t.key === key) ?? null;
/**
 * The kinds a resident teaches (row 312, specs/hq-onboarding.md): for a member whose tools are taught (`taught`: they
 * arrived after row 312, lib/game/arrival/arrivalService.ts), the tier-1 net and shovel are theirs only once a resident
 * has handed them over (an inventory row, lib/game/arrival/hq/grant.ts). Everyone else keeps them as starters.
 */
export const TAUGHT_KINDS: readonly ToolKind[] = ["net", "shovel"];
/** Owned gear keys (inventory catalogue_refs and slugs): tier 1 is everyone's, but a taught kind's only once given. */
export const ownsTool = (t: Tool, owned: readonly string[], taught = false) =>
  owned.includes(t.key) || (t.source === "starter" && !(taught && TAUGHT_KINDS.includes(t.kind)));
/** A kind's tools this member has, lowest tier first. */
export const ownedTools = (kind: ToolKind, owned: readonly string[], taught = false) => TOOLS.filter(t => t.kind === kind && ownsTool(t, owned, taught));
/** The wheel's default for a kind: the best one owned (null: none yet, a taught kind no resident has given). */
export const bestTool = (kind: ToolKind, owned: readonly string[], taught = false): Tool | null => ownedTools(kind, owned, taught).at(-1) ?? null;

export type HeldCheck = { ok: true; tool: Tool } | { ok: false; status: number; code: "no_tool" | "wrong_tool" | "tool_not_owned"; error: string };
const NEEDS: Record<ToolKind, string> = { rod: "Take out your rod first.", net: "You need a net for that.", shovel: "You need a shovel for that.", pickaxe: "You need a pickaxe for that." };
/** The held tool as the server takes it: a known `kind` tool the member owns (the client only names it). */
export function checkHeld(key: unknown, kind: ToolKind, owned: readonly string[], taught = false): HeldCheck {
  if (key === undefined || key === null) return { ok: false, status: 422, code: "no_tool", error: NEEDS[kind] };
  const t = toolByKey(key);
  if (!t || t.kind !== kind) return { ok: false, status: 422, code: "wrong_tool", error: NEEDS[kind] };
  if (!ownsTool(t, owned, taught)) return { ok: false, status: 403, code: "tool_not_owned", error: `You don't have the ${t.name.toLowerCase()}.` };
  return { ok: true, tool: t };
}
