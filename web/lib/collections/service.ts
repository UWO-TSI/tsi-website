import { z } from "zod";
import { RARITY_RANK, type Rarity } from "@/lib/rarity";
import {
  checkDonation, clampSize, journalPage, monthStart, museumWings, trophyFor, validateShowcase, weekStart, weeklyTrophies,
  type Exhibit, type JournalPage, type MuseumWing, type Trophy, type WorldMoment,
} from "./logic";
import { castWater, closedBiomes, fishRoll, forageSize, nodeAt, nodeRoll } from "./rolls";
import { BURIED_FINDS, CATEGORIES, ROSTER, toolOf, type Biome, type Category } from "./roster";
import { digRoll } from "./digLoot";
import { TREATS } from "./treats";
import { toFailure, type Result } from "@/lib/result";
import { hourKey } from "@/lib/game/peaceful";
import { ownedRig } from "@/lib/game/rods";
import { checkHeld } from "@/lib/game/tools";
import type { IslandWeather } from "@/lib/game/islandWeather";
import { CollectionsError, type BagItem, type CatchResult, type ChestItem, type CollectionsStore } from "./store";
import { readRaidCredit } from "./raidCredit";
import { FISH, HOOK_TIER, fishBosses, rollSize } from "@/lib/game/fishing";
import { CHEST_SLOTS, bagCapacity, slotsUsed } from "./bag";
import { eventCatches, landSeason, latestTourney, tourneyBoards, type TourneyBoard } from "@/lib/progression/seasonal";
import type { ClubGoal } from "@/lib/progression/types";

const ERRORS: Record<string, [number, string]> = {
  unavailable: [503, "Collections aren't available yet."],
  already_donated: [409, "Someone donated that first. You could sell yours instead."],
  not_owned: [409, "You need one in your pockets to donate it."],
  not_donatable: [422, "The museum doesn't collect that."],
  rate_limited: [429, "That's plenty of those for this hour. Try again later."],
  too_fast: [429, "Too quick. Give it a moment."],
  no_roll: [404, "Nothing on the line."],
  bad_credit: [403, "That raid's catch isn't yours to claim."],
  not_this_month: [409, "Land one this month to put it up."],
  not_bigger: [409, "Your entry for that fish is as big already."],
  roll_expired: [410, "That one got away. Cast again."],
  already_landed: [409, "Already landed."],
  already_harvested: [409, "You've already gathered here this hour."],
  out_of_season: [409, "That one only bites during its seasonal event."],
  none_left: [409, "You don't have any of those left."],
  bag_full: [409, "Your backpack is full."],
  storage_full: [409, "Your storage chest is full."],
  locked: [409, "That's locked. Unlock it first."],
  insufficient_items: [409, "You don't have that many."],
  key_reused: [409, "That request was already used for something else."],
  bad_qty: [400, "Pick a sensible amount."],
  failed: [500, "Something went wrong. Try again."],
};
const fail = <T>(err: unknown): Result<T> => toFailure(ERRORS, err);

const XZ = z.tuple([z.number().finite(), z.number().finite()]);
const CatchRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("harvest"), node: z.string().max(64), at: XZ, tool: z.string().max(64).optional() }),
  z.object({ action: z.literal("cast"), site: z.enum(["village", "home"]), at: XZ, power: z.number().min(0).max(1), tool: z.string().max(64).optional(), with: z.string().uuid().optional(), tackle: z.array(z.string().max(64)).max(4).optional() }),
  z.object({ action: z.literal("land"), roll: z.string().uuid() }),
  z.object({ action: z.literal("raid"), credit: z.string().max(1024) }),
]);
/** A recorded catch (harvest, land: its counts, record and any recipe taught), or a cast's `roll` waiting to be landed. */
/** `purse`: a dig that turned up coins or a gem (lib/collections/digLoot.ts); its item_key is the currency.
 * `together`: the friend's world name when the cast was fishing together (s-fishtogether), for the card's stamp. */
export type CatchReply = { item_key: string; size_cm: number | null; roll?: string; purse?: { currency: "coins" | "gems"; amount: number }; together?: string | null } & Partial<CatchResult>;

/**
 * A catch from the world (roadmap "Server-authoritative catch rolls"). The
 * client names an action and where it stands; the server checks the place,
 * rolls on its own clock and weather, and records only its roll:
 *   harvest { node, at, tool }        a forage node or bug spot: one per node per hour
 *   cast    { site, at, power, tool } rolls the fish that will bite (roll id; recorded on land)
 *   land    { roll }            the reel was won: records that roll once
 *   raid    { credit }          a divine raid was landed (behind NEXT_PUBLIC_FISH_BOSSES): the realtime server's signed
 *                               credit for one helper (lib/collections/raidCredit.ts), for a divine fish the opener
 *                               really had on the line; recorded once per member per roll
 * Seasonal events (`goals`, the active club goals): limited-time fish are in
 * the roll only while their event runs and never land outside it; a fish
 * landed while the fishing tourney runs enters it, in the same transaction.
 * `weather` and `goals` are read only by the actions that use them (a land
 * needs no weather, a harvest no goals). Sizes clamp to the code roster the
 * roll uses (the collection_species rows are generated from it).
 * `tool` is the held tool's key (specs/game-ui.md): a cast rolls with the held rod's tier and its owned add-ons (`tackle`), a bug needs a net and a
 * dig or a rock a shovel, each one the member owns (lib/game/tools.ts checkHeld); picking by hand needs none.
 * A landed or harvested rare catch may teach a recipe (`recipe` in the reply,
 * 20260930100000 crafting_catch_drop), also in that transaction.
 * A cast `with` a friend nearby (s-fishtogether, lib/game/fishing.ts TOGETHER) rolls a little luckier when `friendName`
 * says they are your friend (their world name; null: not friends, no boost).
 */
export async function catchAction(
  store: CollectionsStore, memberId: string, body: unknown, now: Date,
  weather: () => Promise<IslandWeather>, goals: () => Promise<readonly ClubGoal[]> = async () => [], random = Math.random,
  friendName: (memberId: string) => Promise<string | null> = async () => null,
  raidSecret = process.env.REALTIME_INTERNAL_SECRET,
): Promise<Result<CatchReply>> {
  const parsed = CatchRequest.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, code: "invalid", error: "Invalid request" };
  const req = parsed.data;
  try {
    if (req.action === "land") return { ok: true, data: await store.land(memberId, req.roll, landSeason(await goals(), now)) };
    if (req.action === "raid") {
      const credit = fishBosses() ? readRaidCredit(req.credit, raidSecret, now.getTime()) : null;
      if (!credit || credit.m !== memberId) return fail(new CollectionsError("bad_credit"));
      const sp = ROSTER.find((s) => s.key === credit.f), fish = FISH.find((f) => f.key === credit.f);
      // Only a divine fish raids, and only one the opener's own cast rolled.
      if (!sp || !fish || HOOK_TIER[fish.rarity] !== "divine" || (await store.rolled(credit.o, credit.r)) !== credit.f) return fail(new CollectionsError("no_roll"));
      const size = clampSize(sp, rollSize(fish.sizeCm, random));
      return { ok: true, data: { item_key: sp.key, size_cm: size, ...(await store.harvest(memberId, `raid:${credit.r}`, "raid", sp.key, size, trophyFor(sp, size))) } };
    }
    if (req.action === "harvest") {
      const node = nodeAt(req.node, req.at);
      if (!node) return { ok: false, status: 422, code: "wrong_place", error: "Nothing to gather from here." };
      if (node.biomes.includes("dig_sand") || node.biomes.includes("dig_soil")) return await digAt(store, memberId, req.tool, node.id, node.biomes.includes("dig_soil"), now, random);
      const sp = nodeRoll(memberId, node, now, await weather());
      if (!sp) return { ok: false, status: 409, code: "nothing_here", error: "Nothing's out here right now." };
      // On the new world rocks need the pickaxe (m6, toolOf); the village's take the shovel, as always.
      const tool = toolOf(sp);
      if (tool === "net" || tool === "shovel" || tool === "pickaxe") {
        // Row 312: a member whose tools are taught holds the starter net or shovel only once a resident has given it.
        const [owned, taught] = await Promise.all([store.ownedGear(memberId), store.toolsTaught(memberId)]);
        const held = checkHeld(req.tool, tool, owned, taught);
        if (!held.ok) return held;
      }
      const size = clampSize(ROSTER.find((s) => s.key === sp.key), forageSize(sp, random));
      return { ok: true, data: { item_key: sp.key, size_cm: size, ...(await store.harvest(memberId, node.id, hourKey(now), sp.key, size, trophyFor(sp, size))) } };
    }
    const water = castWater(req.site, req.at);
    if (!water) return { ok: false, status: 422, code: "wrong_place", error: "No water in reach." };
    const owned = await store.ownedGear(memberId);
    const held = checkHeld(req.tool, "rod", owned);
    if (!held.ok) return held;
    const [sky, active, together, buff] = await Promise.all([weather(), goals(), req.with && req.with !== memberId ? friendName(req.with) : null, store.buff(memberId, now)]);
    // The add-ons on the rod (rods.ts): only ones the member owns count.
    const { fish, size } = fishRoll(water, req.power, ownedRig(held.tool.tier, req.tackle ?? [], owned), now, sky, random, eventCatches(active, now), buff ?? undefined, !!together);
    const sp = ROSTER.find((s) => s.key === fish.key);
    const kept = clampSize(sp, size);
    const roll = await store.cast(memberId, fish.key, kept, trophyFor(sp, kept));
    // Not caught yet: the reel and the card show what the land records (no size for a fish off the roster).
    return { ok: true, data: { roll, item_key: fish.key, size_cm: kept, together } };
  } catch (err) {
    return fail(err);
  }
}

/**
 * A dig spot (m3): the server rolls the loot (lib/collections/digLoot.ts) with the held shovel's tier, the way a cast
 * rolls with the held rod's, and records it once per spot per hour (collections_dig): a relic, ore or the broken sudo
 * into the bag, or a purse of coins or a gem into the wallet. Every dig counts for Pim's chapter.
 */
async function digAt(store: CollectionsStore, memberId: string, tool: unknown, nodeId: string, soil: boolean, now: Date, random: () => number): Promise<Result<CatchReply>> {
  const [owned, taught] = await Promise.all([store.ownedGear(memberId), store.toolsTaught(memberId)]);
  const held = checkHeld(tool, "shovel", owned, taught);
  if (!held.ok) return held;
  const loot = digRoll(BURIED_FINDS, soil, held.tool.tier, random);
  if (loot.kind === "coins" || loot.kind === "gem") {
    const purse = { currency: loot.kind === "coins" ? "coins" as const : "gems" as const, amount: loot.amount };
    return { ok: true, data: { item_key: purse.currency, size_cm: null, purse, ...(await store.dig(memberId, nodeId, hourKey(now), purse)) } };
  }
  const sp = ROSTER.find((s) => s.key === loot.key)!;
  const size = clampSize(sp, forageSize(sp, random));
  return { ok: true, data: { item_key: sp.key, size_cm: size, ...(await store.dig(memberId, nodeId, hourKey(now), { item_key: sp.key, size_cm: size, trophy: trophyFor(sp, size) })) } };
}

const EatRequest = z.object({ item: z.string().max(64) });
/** Eat a held snack (specs/game-ui.md §2): fruit only, one from the member's own stock (collections_eat). A moment, no reward (principle 3). */
export async function eat(store: CollectionsStore, memberId: string, body: unknown): Promise<Result<{ item_key: string; count: number }>> {
  const parsed = EatRequest.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, code: "invalid", error: "Invalid request" };
  const sp = [...ROSTER, ...TREATS].find((s) => s.key === parsed.data.item);
  if (sp?.category !== "fruit") return { ok: false, status: 422, code: "not_edible", error: "That isn't something to eat." };
  try {
    return { ok: true, data: { item_key: sp.key, ...(await store.eat(memberId, sp.key)) } };
  } catch (err) {
    return fail(err);
  }
}

export async function journal(store: CollectionsStore, memberId: string, category: string, moment: WorldMoment, closed: ReadonlySet<Biome> = closedBiomes()): Promise<Result<JournalPage & { categories: { category: Category; total: number; discovered: number }[] }>> {
  if (!(CATEGORIES as string[]).includes(category)) return { ok: false, status: 400, error: "Unknown category.", code: "invalid" };
  try {
    const [roster, mine, donations] = await Promise.all([store.roster(), store.memberItems(memberId), store.donations()]);
    const page = journalPage(roster, category as Category, mine, donations, memberId, moment, closed);
    const owned = new Set(mine.map((r) => r.item_key));
    const categories = CATEGORIES.map((c) => {
      const list = roster.filter((s) => s.category === c);
      return { category: c, total: list.length, discovered: list.filter((s) => owned.has(s.key)).length };
    });
    return { ok: true, data: { ...page, categories } };
  } catch (err) {
    return fail(err);
  }
}

export async function museum(store: CollectionsStore): Promise<Result<MuseumWing[]>> {
  try {
    const [roster, donations] = await Promise.all([store.roster(), store.donations()]);
    return { ok: true, data: museumWings(roster, donations) };
  } catch (err) {
    return fail(err);
  }
}

export async function donate(store: CollectionsStore, memberId: string, speciesKey: string, idempotencyKey: string): Promise<Result<{ replayed: boolean; exhibit: Exhibit }>> {
  try {
    const roster = await store.roster();
    const exhibitFor = async () => museumWings(roster, await store.donations()).flatMap((w) => w.exhibits).find((e) => e.key === speciesKey)!;
    const prior = await store.findDonation(memberId, idempotencyKey);
    if (prior) {
      if (prior.species_key !== speciesKey) return { ok: false, status: 409, error: "Idempotency key reused for another species.", code: "key_reused" };
      return { ok: true, data: { replayed: true, exhibit: await exhibitFor() } };
    }
    const [mine, donations] = await Promise.all([store.memberItems(memberId), store.donations()]);
    const sp = roster.find((s) => s.key === speciesKey);
    const check = checkDonation(sp, donations.find((d) => d.species_key === speciesKey), mine.find((r) => r.item_key === speciesKey), memberId);
    if (!check.ok) return check;
    const best = mine.find((r) => r.item_key === speciesKey)?.best_size_cm ?? null;
    const res = await store.donate(memberId, speciesKey, idempotencyKey, best);
    return { ok: true, data: { replayed: res.replayed, exhibit: await exhibitFor() } };
  } catch (err) {
    return fail(err);
  }
}

/**
 * The museum's drive (m5, David 2026-10-28: "this might get impossible if people donate all the stuff"): any fish, bug
 * or buried find handed in counts, even a kind already on display, so the drive can always be finished.
 */
export async function handIn(store: CollectionsStore, memberId: string, speciesKey: string, idempotencyKey: string): Promise<Result<{ replayed: boolean }>> {
  try {
    const sp = ROSTER.find((s) => s.key === speciesKey);
    if (!sp) return { ok: false, status: 404, code: "unknown_species", error: "The museum doesn't know that one." };
    if (!sp.donatable) return { ok: false, status: 422, code: "not_donatable", error: "The museum doesn't collect that." };
    return { ok: true, data: await store.handIn(memberId, speciesKey, idempotencyKey) };
  } catch (err) {
    return fail(err);
  }
}

export async function trophies(store: CollectionsStore, now: Date): Promise<Result<{ week_start: string; trophies: Trophy[] }>> {
  try {
    const week = weekStart(now);
    const [roster, bests] = await Promise.all([store.roster(), store.weeklyBests(week)]);
    return { ok: true, data: { week_start: week, trophies: weeklyTrophies(roster, bests) } };
  } catch (err) {
    return fail(err);
  }
}

export interface MonthBoard {
  /** The month's first day, YYYY-MM-DD (Toronto). */
  month: string;
  /** The club's board: each fish's biggest entry this month, ranked by rarity, then how big for its kind (weeklyTrophies' order). */
  board: (Trophy & { mine: boolean })[];
  /** What you could put up: the biggest of each fish you landed this month and still have, and your entry for it. */
  yours: { key: string; name: string; icon: string | null; rarity: string; size_cm: number; have: number; entered: number | null }[];
}
/**
 * The fish market's monthly board (David, 2026-10-28: "a place to put your fish to monthly leaderboard"): you put a fish
 * you landed this month on it (it leaves your bag), at the biggest size you caught it this month. The portal shows it too.
 */
export async function monthBoard(store: CollectionsStore, memberId: string, now: Date): Promise<Result<MonthBoard>> {
  try {
    const month = monthStart(now);
    const [roster, entries, caught, items] = await Promise.all([store.roster(), store.monthEntries(month), store.monthCatches(memberId, month), store.memberItems(memberId)]);
    const board = weeklyTrophies(roster, entries, Infinity, Infinity).map((t) => ({ ...t, mine: t.member_id === memberId }));
    const yours = caught.flatMap((c) => {
      const sp = roster.find((s) => s.key === c.item_key), have = items.find((r) => r.item_key === c.item_key)?.count ?? 0;
      const entered = entries.find((e) => e.user_id === memberId && e.item_key === c.item_key)?.size_cm ?? null;
      return sp && trophyFor(sp, c.size_cm) && (have > 0 || entered !== null) ? [{ key: sp.key, name: sp.name, icon: sp.icon, rarity: sp.rarity, size_cm: c.size_cm, have, entered }] : [];
    }).sort((a, b) => RARITY_RANK[b.rarity as Rarity] - RARITY_RANK[a.rarity as Rarity] || a.name.localeCompare(b.name));
    return { ok: true, data: { month, board, yours } };
  } catch (err) {
    return fail(err);
  }
}
/** Put one of a fish on this month's board (monthly_fish_enter checks it, takes it and keeps the bigger entry). */
export async function enterMonthly(store: CollectionsStore, memberId: string, input: { item_key: string; idempotency_key: string }): Promise<Result<{ size_cm: number; replayed: boolean }>> {
  try {
    return { ok: true, data: await store.enterMonth(memberId, input.item_key, input.idempotency_key) };
  } catch (err) {
    return fail(err);
  }
}

export interface ShowcaseItem {
  slot: number;
  key: string;
  name: string;
  icon: string | null;
  rarity: string;
  best_size_cm: number | null;
}

export async function getShowcase(store: CollectionsStore, memberId: string): Promise<Result<(ShowcaseItem | null)[]>> {
  try {
    const [roster, keys, mine] = await Promise.all([store.roster(), store.showcase(memberId), store.memberItems(memberId)]);
    return {
      ok: true,
      data: keys.map((k, i) => {
        const sp = roster.find((s) => s.key === k);
        if (!k || !sp) return null;
        return { slot: i + 1, key: k, name: sp.name, icon: sp.icon, rarity: sp.rarity, best_size_cm: mine.find((r) => r.item_key === k)?.best_size_cm ?? null };
      }),
    };
  } catch (err) {
    return fail(err);
  }
}

export async function setShowcase(store: CollectionsStore, memberId: string, keys: unknown): Promise<Result<(ShowcaseItem | null)[]>> {
  try {
    const check = validateShowcase(keys, await store.memberItems(memberId));
    if (!check.ok) return { ok: false, status: 422, error: check.error, code: "invalid" };
    await store.setShowcase(memberId, check.keys);
    return getShowcase(store, memberId);
  } catch (err) {
    return fail(err);
  }
}

export interface TourneyView {
  slug: string;
  title: string;
  cycle: number;
  open: boolean;
  start: string | null;
  end: string | null;
  boards: TourneyBoard[];
}

/** The fishing tourney board (open, or the last one run) as this member may see it (principle 6: tourneyBoards). */
export async function tourney(store: CollectionsStore, goals: ClubGoal[], memberId: string, now: Date): Promise<Result<TourneyView | null>> {
  try {
    const t = latestTourney(goals, now);
    if (!t) return { ok: true, data: null };
    const entries = await store.tourneyEntries(t.goal.id, t.cycle);
    const name = (key: string) => ROSTER.find((s) => s.key === key)?.name ?? key;
    return {
      ok: true,
      data: { slug: t.goal.slug, title: t.goal.title, cycle: t.cycle, open: t.open, start: t.start?.toISOString() ?? null, end: t.end?.toISOString() ?? null, boards: tourneyBoards(entries, memberId, name) },
    };
  } catch (err) {
    return fail(err);
  }
}

// ── The backpack and the home storage chest (specs/game-ui.md milestone 2) ──

export interface BagView {
  items: BagItem[];
  /** Slots: the bag's size (20, or a pocket upgrade's) and how many its stacks fill (more than its size for a member who was over before the cap). */
  capacity: number;
  used: number;
  chest: ChestItem[];
  chest_capacity: number;
  chest_used: number;
  /** Species in the club museum: "you" when your specimen is the one on show. */
  museum: Record<string, "you" | "club">;
}

const stockOf = (rows: { item_key: string; count: number }[]) => Object.fromEntries(rows.map(r => [r.item_key, r.count]));
async function viewOf(store: CollectionsStore, memberId: string): Promise<BagView> {
  const [{ items, chest }, owned, donations] = await Promise.all([store.bag(memberId), store.ownedGear(memberId), store.donations()]);
  return {
    items, capacity: bagCapacity(owned), used: slotsUsed(stockOf(items)),
    chest, chest_capacity: CHEST_SLOTS, chest_used: slotsUsed(stockOf(chest)),
    museum: Object.fromEntries(donations.map(d => [d.species_key, d.donor_id === memberId ? "you" : "club"])),
  };
}
export async function bagView(store: CollectionsStore, memberId: string): Promise<Result<BagView>> {
  try {
    return { ok: true, data: await viewOf(store, memberId) };
  } catch (err) {
    return fail(err);
  }
}

const Item = z.string().regex(/^[a-z0-9_]{1,64}$/);
const Qty = z.number().int().min(1).max(999);
/** The client's idempotency key, as memberContext's IdemKey (kept here: this module also runs in the browser demos). */
const Key = z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/);
const BagRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lock"), item: Item, locked: z.boolean() }),
  z.object({ action: z.literal("drop"), item: Item, qty: Qty, idempotency_key: Key }),
  z.object({ action: z.literal("store"), item: Item, qty: Qty, idempotency_key: Key }),
  z.object({ action: z.literal("take"), item: Item, qty: Qty, idempotency_key: Key }),
  z.object({ action: z.literal("store_materials"), idempotency_key: Key }),
]);
/**
 * A change to the bag, answered with the bag as it is now (the client never decides what you have):
 *   lock  { item, locked }            selling and dropping skip a locked item; so does "store all materials"
 *   drop  { item, qty, key }          gone for good
 *   store { item, qty, key }          bag → chest   (storage_full when the chest has no room)
 *   take  { item, qty, key }          chest → bag   (bag_full when the bag has no room)
 *   store_materials { key }           every unlocked material into the chest
 * Each write is atomic and happens once per key; a replay changes nothing.
 */
export async function bagAction(store: CollectionsStore, memberId: string, body: unknown): Promise<Result<BagView>> {
  const parsed = BagRequest.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, code: "invalid", error: "Invalid request" };
  const req = parsed.data;
  try {
    if (req.action === "lock") await store.setLocked(memberId, req.item, req.locked);
    else if (req.action === "drop") await store.drop(memberId, req.item, req.qty, req.idempotency_key);
    else if (req.action === "store_materials") await store.storeMaterials(memberId, req.idempotency_key);
    else await store.move(memberId, req.item, req.qty, req.action === "store" ? "chest" : "bag", req.idempotency_key);
    return { ok: true, data: await viewOf(store, memberId) };
  } catch (err) {
    return fail(err);
  }
}
