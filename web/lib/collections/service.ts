import { z } from "zod";
import {
  checkDonation, clampSize, journalPage, museumWings, validateShowcase, weekStart, weeklyTrophies,
  type Exhibit, type JournalPage, type MuseumWing, type Trophy, type WorldMoment,
} from "./logic";
import { castWater, fishRoll, forageSize, nodeAt, nodeRoll } from "./rolls";
import { CATEGORIES, type Category } from "./roster";
import { toFailure, type Result } from "@/lib/result";
import { hourKey } from "@/lib/game/peaceful";
import { bestOwnedRod } from "@/lib/game/rods";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { CatchResult, CollectionsStore } from "./store";
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
  roll_expired: [410, "That one got away. Cast again."],
  already_landed: [409, "Already landed."],
  already_harvested: [409, "You've already gathered here this hour."],
  out_of_season: [409, "That one only bites during its seasonal event."],
  failed: [500, "Something went wrong. Try again."],
};
const fail = <T>(err: unknown): Result<T> => toFailure(ERRORS, err);

/** Test fixtures and the dev demos; catches from the world go through catchAction. */
export async function recordCatch(store: CollectionsStore, memberId: string, itemKey: string, sizeCm: number | null | undefined): Promise<Result<CatchResult & { item_key: string }>> {
  try {
    const sp = (await store.roster()).find((s) => s.key === itemKey);
    const size = clampSize(sp, sizeCm);
    const trophy = !!sp && (sp.category === "fish" || sp.category === "sea") && size !== null;
    return { ok: true, data: { item_key: itemKey, ...(await store.recordCatch(memberId, itemKey, size, trophy)) } };
  } catch (err) {
    return fail(err);
  }
}

const XZ = z.tuple([z.number().finite(), z.number().finite()]);
const CatchRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("harvest"), node: z.string().max(64), at: XZ }),
  z.object({ action: z.literal("cast"), site: z.enum(["village", "home"]), at: XZ, power: z.number().min(0).max(1) }),
  z.object({ action: z.literal("land"), roll: z.string().uuid() }),
]);
/** A recorded catch (harvest, land), or a cast's roll waiting to be landed. */
export type CatchReply = { item_key: string; size_cm: number | null } & (CatchResult | { roll: string });
const trophyFor = (sp: { category: string } | undefined, size: number | null) => !!sp && (sp.category === "fish" || sp.category === "sea") && size !== null;

/**
 * A catch from the world (roadmap "Server-authoritative catch rolls"). The
 * client names an action and where it stands; the server checks the place,
 * rolls on its own clock and weather, and records only its roll:
 *   harvest { node, at }        a forage node or bug spot: one per node per hour
 *   cast    { site, at, power } rolls the fish that will bite (roll id; recorded on land)
 *   land    { roll }            the reel was won: records that roll once
 * Seasonal events (`goals`, the active club goals): limited-time fish are in
 * the roll only while their event runs and never land outside it; a fish
 * landed while the fishing tourney runs enters it, in the same transaction.
 */
export async function catchAction(store: CollectionsStore, memberId: string, body: unknown, now: Date, weather: IslandWeather, goals: readonly ClubGoal[] = [], random = Math.random): Promise<Result<CatchReply>> {
  const parsed = CatchRequest.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, code: "invalid", error: "Invalid request" };
  const req = parsed.data;
  try {
    if (req.action === "land") return { ok: true, data: await store.land(memberId, req.roll, landSeason(goals, now)) };
    const roster = await store.roster();
    if (req.action === "harvest") {
      const node = nodeAt(req.node, req.at);
      if (!node) return { ok: false, status: 422, code: "wrong_place", error: "Nothing to gather from here." };
      const sp = nodeRoll(memberId, node, now, weather);
      if (!sp) return { ok: false, status: 409, code: "nothing_here", error: "Nothing's out here right now." };
      const size = clampSize(roster.find((s) => s.key === sp.key), forageSize(sp, random));
      return { ok: true, data: { item_key: sp.key, size_cm: size, ...(await store.harvest(memberId, node.id, hourKey(now), sp.key, size, trophyFor(sp, size))) } };
    }
    const water = castWater(req.site, req.at);
    if (!water) return { ok: false, status: 422, code: "wrong_place", error: "No water in reach." };
    const { fish, size } = fishRoll(water, req.power, bestOwnedRod(await store.ownedGear(memberId)), now, weather, random, eventCatches(goals, now));
    const sp = roster.find((s) => s.key === fish.key);
    const kept = clampSize(sp, size);
    const roll = await store.cast(memberId, fish.key, kept, trophyFor(sp, kept));
    // Not caught yet: the reel and the card use this; the record happens on land.
    return { ok: true, data: { roll, item_key: fish.key, size_cm: size } };
  } catch (err) {
    return fail(err);
  }
}

export async function journal(store: CollectionsStore, memberId: string, category: string, moment: WorldMoment): Promise<Result<JournalPage & { categories: { category: Category; total: number; discovered: number }[] }>> {
  if (!(CATEGORIES as string[]).includes(category)) return { ok: false, status: 400, error: "Unknown category.", code: "invalid" };
  try {
    const [roster, mine, donations] = await Promise.all([store.roster(), store.memberItems(memberId), store.donations()]);
    const page = journalPage(roster, category as Category, mine, donations, memberId, moment);
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

export async function trophies(store: CollectionsStore, now: Date): Promise<Result<{ week_start: string; trophies: Trophy[] }>> {
  try {
    const week = weekStart(now);
    const [roster, bests] = await Promise.all([store.roster(), store.weeklyBests(week)]);
    return { ok: true, data: { week_start: week, trophies: weeklyTrophies(roster, bests) } };
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
    const [roster, entries] = await Promise.all([store.roster(), store.tourneyEntries(t.goal.id, t.cycle)]);
    const name = (key: string) => roster.find((s) => s.key === key)?.name ?? key;
    return {
      ok: true,
      data: { slug: t.goal.slug, title: t.goal.title, cycle: t.cycle, open: t.open, start: t.start?.toISOString() ?? null, end: t.end?.toISOString() ?? null, boards: tourneyBoards(entries, memberId, name) },
    };
  } catch (err) {
    return fail(err);
  }
}
