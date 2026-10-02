/**
 * The peaceful tools (rows 62, 193, 279; specs/game-ui.md): rods, nets and shovels in five tiers. The one in your
 * hand decides what left click does, and the server rolls a cast with the held rod's tier (checked against what you
 * own), never the best you own. Tier 1 of each is everyone's, as the flimsy rod always was. `key` is the
 * inventory's: a rod's catalogue_ref, a net's or shovel's shop slug (they have no ref). Tools never break (row 279).
 * Rod tiers' effects are rods.ts; nets and shovels have none yet (specs/game-ui-questions.md).
 */
import { RODS } from "./rods";

export type ToolKind = "rod" | "net" | "shovel";
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
];

export const toolByKey = (key: unknown): Tool | null => TOOLS.find(t => t.key === key) ?? null;
/** Owned gear keys (inventory catalogue_refs and slugs): tier 1 is everyone's. */
export const ownsTool = (t: Tool, owned: readonly string[]) => t.source === "starter" || owned.includes(t.key);
/** A kind's tools this member has, lowest tier first. */
export const ownedTools = (kind: ToolKind, owned: readonly string[]) => TOOLS.filter(t => t.kind === kind && ownsTool(t, owned));
/** The wheel's default for a kind: the best one owned. */
export const bestTool = (kind: ToolKind, owned: readonly string[]): Tool => ownedTools(kind, owned).at(-1)!;

export type HeldCheck = { ok: true; tool: Tool } | { ok: false; status: number; code: "no_tool" | "wrong_tool" | "tool_not_owned"; error: string };
const NEEDS: Record<ToolKind, string> = { rod: "Take out your rod first.", net: "You need a net for that.", shovel: "You need a shovel for that." };
/** The held tool as the server takes it: a known `kind` tool the member owns (the client only names it). */
export function checkHeld(key: unknown, kind: ToolKind, owned: readonly string[]): HeldCheck {
  if (key === undefined || key === null) return { ok: false, status: 422, code: "no_tool", error: NEEDS[kind] };
  const t = toolByKey(key);
  if (!t || t.kind !== kind) return { ok: false, status: 422, code: "wrong_tool", error: NEEDS[kind] };
  if (!ownsTool(t, owned)) return { ok: false, status: 403, code: "tool_not_owned", error: `You don't have the ${t.name.toLowerCase()}.` };
  return { ok: true, tool: t };
}
