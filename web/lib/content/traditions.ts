/**
 * The traditions calendar (specs/v1-drop.md §9; design principle 8): yearly date ranges, edited by admins on the
 * Traditions page, that switch event content on and off on the shared clock. A tradition is a Toronto calendar
 * window (`starts_on` to `ends_on`, both MM-DD and inclusive, wrapping the new year when it ends before it starts)
 * and the content it switches on. The island only knows how to dress the content kinds listed in TRADITION_CONTENT;
 * a new kind is code, its dates and on/off are content.
 *
 * Pure: the island (lib/game/useTraditions.ts), the server routes (trick-or-treat, the look check) and the admin
 * editor share it. Times are epoch milliseconds read on the world clock; days and nights are Toronto's.
 */
import { torontoParts } from "@/lib/time";

/** What a tradition can switch on (each is a system the island has). */
export const TRADITION_CONTENT = ["pumpkins", "costumes", "trick_or_treat", "fog_nights"] as const;
export type TraditionContentKind = (typeof TRADITION_CONTENT)[number];
export type TraditionContent = Partial<Record<TraditionContentKind, boolean>>;
export const CONTENT_LABEL: Record<TraditionContentKind, { label: string; hint: string }> = {
  pumpkins: { label: "Pumpkin lanterns", hint: "Carved pumpkins by the lamp posts, doors and gathering spots, glowing after dark" },
  costumes: { label: "Costume closet", hint: "The tradition's costumes are free to wear in the wardrobe while it runs" },
  trick_or_treat: { label: "Trick-or-treat", hint: "Knock at a resident's door at night for a treat, once per resident a night" },
  fog_nights: { label: "Fog nights", hint: "Low ground fog and a cooler moon after dark" },
};

export interface Tradition {
  /** Lowercase with dashes ("halloween"): the row's key, and the costume tag (`event`) on its catalogue parts. */
  id: string;
  title: string;
  /** "MM-DD", Toronto, inclusive. */
  starts_on: string;
  ends_on: string;
  content: TraditionContent;
  position: number;
  active: boolean;
}

/** The seeded traditions (20261013210000_traditions.sql): the island's fallback when the table can't be read. */
export const DEFAULT_TRADITIONS: readonly Tradition[] = [
  { id: "halloween", title: "Halloween", starts_on: "10-25", ends_on: "11-01", content: { pumpkins: true, costumes: true, trick_or_treat: true, fog_nights: true }, position: 1, active: true },
];

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** "MM-DD" as a comparable number (month × 100 + day), or null when it isn't a real day of the year. */
export function monthDay(s: string): number | null {
  if (!MMDD.test(s)) return null;
  const [m, d] = s.split("-").map(Number);
  return d <= DAYS[m - 1] ? m * 100 + d : null;
}

/** The Toronto calendar day at `epochMs` as month × 100 + day. */
export function torontoMonthDay(epochMs: number): number {
  const p = torontoParts(new Date(epochMs));
  return p.month * 100 + p.day;
}

/** Is the tradition running at `epochMs`? Inclusive of both Toronto days; a window ending before it starts wraps the new year. */
export function traditionOpen(t: Pick<Tradition, "starts_on" | "ends_on" | "active">, epochMs: number): boolean {
  const a = monthDay(t.starts_on), b = monthDay(t.ends_on);
  if (!t.active || a === null || b === null) return false;
  const d = torontoMonthDay(epochMs);
  return a <= b ? d >= a && d <= b : d >= a || d <= b;
}

/** The traditions running now, in their order. */
export function runningTraditions<T extends Tradition>(rows: readonly T[], epochMs: number): T[] {
  return rows.filter((t) => traditionOpen(t, epochMs)).sort((x, y) => x.position - y.position);
}

/** What's switched on now: any running tradition's content. */
export function contentOn(rows: readonly Tradition[], epochMs: number): Required<TraditionContent> {
  const on = Object.fromEntries(TRADITION_CONTENT.map((k) => [k, false])) as Required<TraditionContent>;
  for (const t of runningTraditions(rows, epochMs)) for (const k of TRADITION_CONTENT) if (t.content[k]) on[k] = true;
  return on;
}

/** The traditions whose costumes are free to wear now (their ids are the costume parts' `event` tags). */
export function costumeEvents(rows: readonly Tradition[], epochMs: number): Set<string> {
  return new Set(runningTraditions(rows, epochMs).filter((t) => t.content.costumes).map((t) => t.id));
}

/**
 * The night a moment belongs to, as the Toronto date of its evening ("YYYY-MM-DD"): from noon to noon, so 1 a.m. on
 * the 26th is still the night of the 25th. Trick-or-treat is once per resident per night.
 */
export function nightKey(epochMs: number): string {
  return torontoParts(new Date(epochMs - 12 * 3_600_000)).date;
}

/** A row from the table (or a draft) as a Tradition, unknown content keys dropped. */
export function normalizeTradition(row: Record<string, unknown>): Tradition {
  const raw = row.content && typeof row.content === "object" ? (row.content as Record<string, unknown>) : {};
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    starts_on: String(row.starts_on ?? ""),
    ends_on: String(row.ends_on ?? ""),
    content: Object.fromEntries(TRADITION_CONTENT.filter((k) => raw[k] === true).map((k) => [k, true])),
    position: Number(row.position ?? 0) || 0,
    active: row.active !== false,
  };
}

/** The admin draft check (lib/content/drafts.ts DRAFT_VALIDATORS), run in the editor and again on the server. */
export function validateTraditionDraft(d: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof d.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(d.id)) errors.push("Id: lowercase letters, digits and dashes, up to 40.");
  if (typeof d.title !== "string" || !d.title.trim() || d.title.length > 60) errors.push("Title: 1 to 60 characters.");
  for (const k of ["starts_on", "ends_on"] as const) if (typeof d[k] !== "string" || monthDay(d[k] as string) === null) errors.push(`${k === "starts_on" ? "Start" : "End"}: a real day of the year, MM-DD.`);
  const c = d.content;
  if (!c || typeof c !== "object" || Array.isArray(c)) errors.push("Content: pick what the tradition switches on.");
  else {
    const keys = Object.keys(c as object);
    const unknown = keys.filter((k) => !(TRADITION_CONTENT as readonly string[]).includes(k));
    if (unknown.length) errors.push(`Content: unknown ${unknown.join(", ")}.`);
    if (!keys.some((k) => (c as Record<string, unknown>)[k] === true)) errors.push("Content: switch at least one thing on.");
  }
  if (!Number.isInteger(d.position)) errors.push("Order: a whole number.");
  if (typeof d.active !== "boolean") errors.push("Active: on or off.");
  return errors;
}

/** "Oct 25 to Nov 1" for an admin list or a sheet. */
export function windowLabel(t: Pick<Tradition, "starts_on" | "ends_on">): string {
  const name = (s: string) => {
    const md = monthDay(s);
    if (md === null) return s;
    return new Date(Date.UTC(2026, Math.floor(md / 100) - 1, md % 100)).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
  };
  return `${name(t.starts_on)} to ${name(t.ends_on)}`;
}
