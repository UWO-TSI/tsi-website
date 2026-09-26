import {
  checkDonation, clampSize, journalPage, museumWings, validateShowcase, weekStart, weeklyTrophies,
  type Exhibit, type JournalPage, type MuseumWing, type Trophy, type WorldMoment,
} from "./logic";
import { CATEGORIES, type Category } from "./roster";
import { toFailure, type Result } from "@/lib/result";
import type { CatchResult, CollectionsStore } from "./store";

const ERRORS: Record<string, [number, string]> = {
  unavailable: [503, "Collections aren't available yet."],
  already_donated: [409, "Someone donated that first. You could sell yours instead."],
  not_owned: [409, "You need one in your pockets to donate it."],
  not_donatable: [422, "The museum doesn't collect that."],
  rate_limited: [429, "That's plenty of those for this hour. Try again later."],
  failed: [500, "Something went wrong. Try again."],
};
const fail = <T>(err: unknown): Result<T> => toFailure(ERRORS, err);

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
