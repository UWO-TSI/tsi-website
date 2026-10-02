/**
 * The tool wheel (row 279, specs/game-ui.md): what it holds, what you hold, and what left click does with it.
 * Pure, so the HUD, the avatar and the tests share one model.
 *
 * Contents (eight slots at most): the rod, net and shovel you chose (the best you own until you pick another
 * tier), the leaf glider when you own it, your weapons once the ruins gate is open (the default first, then the
 * best of each other type), and up to two items pinned from your bag. In the ruins the wheel is weapons only:
 * the default first, the best of each type, then the rest of what you own and the starters. The centre puts
 * things away (empty hands). A quick tap swaps back to the last thing you held.
 */
import { ROSTER } from "@/lib/collections/roster";
import { MATERIALS } from "@/lib/crafting/recipes";
import { WEAPONS } from "@/lib/combat/weapons";
import { GLIDER_REF } from "./glider";
import { TOOLS, bestTool, ownsTool, type Tool, type ToolKind } from "./tools";

export type WheelKind = ToolKind | "glider" | "weapon" | "pin";
export interface WheelItem { id: string; kind: WheelKind; key: string; name: string; icon: string; tier?: number }
export const WHEEL_SLOTS = 8;
export const MAX_PINS = 2;
export type WheelSite = "village" | "home" | "ruins";

export const itemIcon = (key: string) => `/assets/icons/${key}.png`;
const SPECIES = new Map([...ROSTER, ...MATERIALS].map(s => [s.key, s]));
const WEAPON = new Map(WEAPONS.map(w => [w.key, w]));
/** The order weapon types sit on the wheel. */
const TYPE_ORDER = ["sword", "bow", "staff", "tome", "revolver", "fists", "shield", "totem"];

export interface WheelContext {
  site: WheelSite;
  /** Owned gear keys (inventory catalogue_refs and slugs). */
  owned: readonly string[];
  /** The tier you set per tool kind (a tool key); unset or no longer owned → the best you own. */
  chosen?: Partial<Record<ToolKind, string>>;
  /** Weapons you can hold (owned with a look, plus the starters), and the default (the DB-equipped one, else the last held). */
  weapons: readonly string[];
  defaultWeapon?: string | null;
  /** The ruins gate is open: weapons are yours to carry (row 140). */
  armed: boolean;
  /** Pinned item keys and how many of each you have (a pin you have none of leaves the wheel). */
  pins: readonly string[];
  stock: Readonly<Record<string, number>>;
}

const toolItem = (t: Tool): WheelItem => ({ id: `${t.kind}:${t.key}`, kind: t.kind, key: t.key, name: t.name, icon: t.icon, tier: t.tier });
const weaponItem = (key: string): WheelItem => ({ id: `weapon:${key}`, kind: "weapon", key, name: WEAPON.get(key)?.name ?? key, icon: itemIcon(key), tier: WEAPON.get(key)?.tier });
export const pinItem = (key: string): WheelItem => ({ id: `pin:${key}`, kind: "pin", key, name: SPECIES.get(key)?.name ?? key, icon: itemIcon(key) });
const GLIDER: WheelItem = { id: `glider:${GLIDER_REF}`, kind: "glider", key: GLIDER_REF, name: "Leaf glider", icon: itemIcon(GLIDER_REF) };

/** The tool of a kind on the wheel: the one you set while you still own it, else the best. */
export function wheelTool(kind: ToolKind, owned: readonly string[], chosen?: string): Tool {
  const set = TOOLS.find(t => t.kind === kind && t.key === chosen);
  return set && ownsTool(set, owned) ? set : bestTool(kind, owned);
}

/** Weapons in wheel order: the default, the best of each other type, then (`all`) the rest, by type and tier. */
export function wheelWeapons(weapons: readonly string[], defaultWeapon: string | null | undefined, all: boolean): string[] {
  const known = [...new Set(weapons)].filter(k => WEAPON.has(k));
  const typeRank = (k: string) => { const i = TYPE_ORDER.indexOf(WEAPON.get(k)!.type); return i < 0 ? TYPE_ORDER.length : i; };
  const byRank = [...known].sort((a, b) => typeRank(a) - typeRank(b) || WEAPON.get(b)!.tier - WEAPON.get(a)!.tier || a.localeCompare(b));
  const first = defaultWeapon && known.includes(defaultWeapon) ? [defaultWeapon] : [];
  const best = byRank.filter(k => !first.length || WEAPON.get(k)!.type !== WEAPON.get(first[0])!.type)
    .filter((k, i, list) => list.findIndex(o => WEAPON.get(o)!.type === WEAPON.get(k)!.type) === i);
  const out = [...first, ...best];
  return all ? [...out, ...byRank.filter(k => !out.includes(k))] : out;
}

export function wheelContents(ctx: WheelContext): WheelItem[] {
  const pins = ctx.pins.filter(k => (ctx.stock[k] ?? 0) > 0).slice(0, MAX_PINS).map(pinItem);
  if (ctx.site === "ruins") return wheelWeapons(ctx.weapons, ctx.defaultWeapon, true).slice(0, WHEEL_SLOTS).map(weaponItem);
  const tools = (["rod", "net", "shovel"] as const).map(k => toolItem(wheelTool(k, ctx.owned, ctx.chosen?.[k])));
  if (ctx.owned.includes(GLIDER_REF)) tools.push(GLIDER);
  const room = WHEEL_SLOTS - tools.length - pins.length;
  const weapons = ctx.armed ? wheelWeapons(ctx.weapons, ctx.defaultWeapon, false).slice(0, room).map(weaponItem) : [];
  return [...tools, ...weapons, ...pins];
}

// ── What you hold ────────────────────────────────────────────────────
/** `held`: a wheel item id, or null (empty hands). `last`: what you held before, for the quick tap. */
export interface HeldState { held: string | null; last: string | null }
export const EMPTY_HANDS: HeldState = { held: null, last: null };

/** Take something out (null puts it away); what you had becomes `last`. */
export function equip(s: HeldState, id: string | null): HeldState {
  return id === s.held ? s : { held: id, last: s.held ?? s.last };
}
/** A quick tap of the wheel key: back to the last thing held while it's still on the wheel, else away (or out again). */
export function quickSwap(s: HeldState, items: readonly WheelItem[]): HeldState {
  const last = s.last && items.some(i => i.id === s.last) ? s.last : null;
  if (last) return { held: last, last: s.held };
  return s.held ? equip(s, null) : s;
}
/** The wheel changed (a pin ran out, a scene with other contents): a held item no longer on it goes away, or to `fallback`. */
export function reconcile(s: HeldState, items: readonly WheelItem[], fallback: string | null = null): HeldState {
  if (s.held === null || items.some(i => i.id === s.held)) return s;
  return { held: fallback && items.some(i => i.id === fallback) ? fallback : null, last: s.last };
}
export const heldItem = (s: HeldState, items: readonly WheelItem[]) => items.find(i => i.id === s.held) ?? null;

// ── Choosing on the wheel ────────────────────────────────────────────
/**
 * The slot a flick points at: `dx, dy` from the wheel's centre (screen pixels, y down), slot 0 straight up and the
 * rest clockwise, each owning an equal wedge. Within `dead` of the centre it is the centre (null: empty hands).
 */
export function slotAt(dx: number, dy: number, n: number, dead: number): number | null {
  if (n <= 0 || Math.hypot(dx, dy) < dead) return null;
  const a = Math.atan2(dx, -dy); // 0 up, clockwise
  return ((Math.round(a / (2 * Math.PI / n)) % n) + n) % n;
}
/** Where slot i sits round a wheel of radius r (screen pixels from the centre, y down). */
export function slotPosition(i: number, n: number, r: number): [number, number] {
  const a = (i / n) * 2 * Math.PI;
  return [Math.sin(a) * r, -Math.cos(a) * r];
}
/** A flick under pointer lock: the mouse's movement added up, kept within `max` of the centre. */
export function flick(v: [number, number], dx: number, dy: number, max: number): [number, number] {
  const x = v[0] + dx, y = v[1] + dy, d = Math.hypot(x, y);
  return d > max ? [x / d * max, y / d * max] : [x, y];
}

// ── Left click ───────────────────────────────────────────────────────
/** What's in reach for a tool (the world's nearest): water to fish, a catchable bug, something to dig or strike. */
export interface Reach { water: boolean; bug: string | null; dig: string | null }
export type ClickVerb = "cast" | "swing" | "dig" | "attack" | "eat";
export interface ClickAction { verb: ClickVerb; label: string; /** Something in reach takes it (a catch, a dig); otherwise it's the motion alone. */ target: boolean }
const EDIBLE = new Set(ROSTER.filter(s => s.category === "fruit").map(s => s.key));
export const edible = (key: string) => EDIBLE.has(key);

/** What left click does with what you hold (null: nothing, e.g. empty hands, or the rod with no water in reach). */
export function clickAction(item: WheelItem | null, reach: Reach, site: WheelSite): ClickAction | null {
  switch (item?.kind) {
    case "rod": return reach.water ? { verb: "cast", label: "Cast", target: true } : null;
    case "net": return reach.bug ? { verb: "swing", label: `Swing the net (${reach.bug})`, target: true } : { verb: "swing", label: "Swing the net", target: false };
    case "shovel": return reach.dig ? { verb: "dig", label: reach.dig, target: true } : { verb: "dig", label: "Dig", target: false };
    case "weapon": return { verb: "attack", label: site === "ruins" ? "Attack" : "Practice swing", target: site === "ruins" };
    case "pin": return edible(item.key) ? { verb: "eat", label: `Eat the ${item.name.toLowerCase()}`, target: true } : null;
    default: return null;
  }
}
/** Something in reach wants a tool you aren't holding: the hint names it (null when the held one fits or nothing waits). */
export function toolNeeded(item: WheelItem | null, reach: Reach): ToolKind | null {
  const want: ToolKind | null = reach.bug ? "net" : reach.dig ? "shovel" : reach.water ? "rod" : null;
  return want && item?.kind !== want ? want : null;
}
