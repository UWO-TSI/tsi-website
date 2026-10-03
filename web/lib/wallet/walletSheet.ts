/**
 * What the wallet sheet shows (specs/polish/reachability.md deliverable 2): the balance, today's gift and the recent
 * earnings and spends, from the existing wallet read (GET /api/economy/wallet). Each move is said plainly ("Sold Dace",
 * "Bought Straw hat") with the time in Toronto, grouped by day. Amounts are TC and Gems only: nothing here is priced in
 * money and no rate between the two ever appears (lib/economy.ts). Pure; the sheet is components/economy/EconomySheets.
 */
import { ROSTER } from "@/lib/collections/roster";
import { iconUrl, shopIcon } from "@/lib/icons/keys";
import { torontoInstant, torontoParts } from "@/lib/time";
import { CATALOGUE, EVENT_ITEMS, OWNERSHIP_ITEMS } from "./catalogue";
import type { WalletView } from "./service";
import type { LedgerEntry } from "./store";

/** The kind of move, for its icon. */
export type WalletKind = "sell" | "shop" | "gift" | "study" | "chapter" | "quest" | "event" | "grant" | "room" | "goal" | "refund" | "carry" | "merch" | "path" | "mission" | "repair" | "bounty" | "other";
export interface WalletLine {
  key: string; kind: WalletKind; title: string; detail: string;
  /** The thing itself, when there is one: the catch's or the shop item's own icon (else the kind's). */
  icon: string | null;
  amount: number; currency: "coins" | "gems"; balanceAfter: number;
}
export interface WalletDay { label: string; lines: WalletLine[] }
export interface WalletSheetModel {
  coins: number; gems: number;
  /** Today's gift: opened or waiting, and when the next one comes (Toronto midnight). */
  gift: { opened: boolean; next: string | null };
  earned: WalletDay[]; spent: WalletDay[];
  /** TC earned and spent across what's shown (Gems apart). */
  totals: { earned: number; spent: number };
}

const SPECIES = new Map(ROSTER.map(s => [s.key, s.name]));
const ITEMS = new Map([...CATALOGUE, ...OWNERSHIP_ITEMS, ...EVENT_ITEMS].map(e => [e.slug, e]));
const humanize = (s: string) => { const w = s.replace(/[-_]+/g, " ").trim(); return w ? w[0].toUpperCase() + w.slice(1) : "Something new"; };

/** Each source said plainly, with its icon (sources from the economy functions and the legacy Gem ledger's types). */
const SAY: Record<string, [WalletKind, string]> = {
  study: ["study", "Study session"], chapter: ["chapter", "Chapter reward"], quest: ["quest", "Quest reward"], event: ["event", "Club event check-in"],
  admin: ["grant", "Club grant"], room: ["room", "A new room for your house"], goal: ["goal", "Chipped in to a club goal"], refund: ["refund", "Refund"],
  migration: ["carry", "Carried over"], merch: ["merch", "Merch reservation"], stat_reset: ["path", "Stats reset"], mission: ["mission", "Mission reward"],
  repair: ["repair", "Weapon repair"], earn_bounty: ["bounty", "Bounty"], earn_event: ["event", "Club event"], earn_admin: ["grant", "Club grant"],
  earn_quest: ["quest", "Quest"], spend_shop: ["shop", "Shop purchase"], spend_merch: ["merch", "Merch reservation"], refund_merch: ["refund", "Merch refund"],
};

const TIME = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", weekday: "short", month: "short", day: "numeric" });

function line(e: LedgerEntry, i: number, today: string): WalletLine {
  const at = new Date(e.created_at), time = TIME.format(at), base = { key: `${e.created_at}:${i}`, amount: e.amount, currency: e.currency, balanceAfter: e.balance_after };
  const ref = e.ref ?? "";
  if (e.source === "sell") {
    const name = SPECIES.get(ref);
    return { ...base, kind: "sell", title: `Sold ${name ?? humanize(ref || "a catch")}`, detail: time, icon: name ? iconUrl(ref) : null };
  }
  if (e.source === "shop") {
    const it = ITEMS.get(ref);
    return { ...base, kind: "shop", title: it ? `Bought ${it.display_name}` : "Bought at the shop", detail: time, icon: it ? shopIcon(it) : null };
  }
  if (e.source === "daily_gift") return { ...base, kind: "gift", title: ref === today ? "Today's gift" : "Daily gift", detail: time, icon: null };
  if (e.source === "respec") return { ...base, kind: "path", title: /subclass/i.test(ref) ? "Changed your subclass" : "Asked the Oracle again", detail: time, icon: null };
  const [kind, title] = SAY[e.source] ?? ["other", humanize(e.source)];
  // The Gem ledger's own note ("Bounty: accessibility audit") says what it was for.
  return { ...base, kind, title, detail: e.currency === "gems" && ref ? `${time} · ${ref}` : time, icon: null };
}

/** Group lines by their Toronto day, newest first: Today, Yesterday, then "Thu, Oct 1". */
function byDay(entries: readonly LedgerEntry[], now: Date, today: string): WalletDay[] {
  const yesterday = torontoParts(new Date(torontoInstant(today, 0).getTime() - 1)).date;
  const days: WalletDay[] = [];
  let last = "";
  [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at)).forEach((e, i) => {
    const at = new Date(e.created_at), d = torontoParts(at).date;
    if (d !== last) { days.push({ label: d === today ? "Today" : d === yesterday ? "Yesterday" : DAY.format(at), lines: [] }); last = d; }
    days[days.length - 1].lines.push(line(e, i, today));
  });
  return days;
}

/** How long until the next gift: Toronto's next midnight (25 hours away on the night the clocks go back). */
export function giftCountdown(now: Date): string {
  const today = torontoParts(now).date, left = torontoInstant(today, 24).getTime() - now.getTime();
  const h = Math.floor(left / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000);
  return h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : m > 0 ? `${m} min` : "under a minute";
}

export function walletSheet(view: WalletView, now: Date): WalletSheetModel {
  const today = torontoParts(now).date;
  const earned = view.recent.filter(e => e.amount > 0), spent = view.recent.filter(e => e.amount < 0);
  const sum = (list: LedgerEntry[]) => list.reduce((n, e) => n + (e.currency === "coins" ? Math.abs(e.amount) : 0), 0);
  return {
    coins: view.coins, gems: view.gems,
    gift: { opened: view.daily_claimed, next: view.daily_claimed ? giftCountdown(now) : null },
    earned: byDay(earned, now, today), spent: byDay(spent, now, today),
    totals: { earned: sum(earned), spent: sum(spent) },
  };
}
