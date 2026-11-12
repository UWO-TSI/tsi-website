/**
 * The nav's one call to action changes with the season (David, 2026-11-11):
 * an open hiring round wins, then the nonprofit application window, then GENESIS sponsorship.
 */

export type SeasonCta = { kind: "students" | "nonprofits" | "sponsors"; label: string; href: string };

/** Nonprofit applications run Aug 10 to Aug 31, Toronto time, every year. */
export const NPO_WINDOW = { opens: { month: 8, day: 10 }, closes: { month: 8, day: 31 } } as const;

type PositionTimes = { is_active: boolean; archived_at?: string | null; opens_at?: string | null; closes_at?: string | null };

/** A role the public can apply to right now (same rule as `isPositionOpen` in lib/recruitment.ts). */
export function isOpenRound(p: PositionTimes, now: Date): boolean {
  if (!p.is_active || p.archived_at) return false;
  if (p.opens_at && new Date(p.opens_at) > now) return false;
  if (p.closes_at && new Date(p.closes_at) <= now) return false;
  return true;
}

/** Month and day in Toronto, where the club's dates are set. */
function torontoMonthDay(now: Date): { month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "numeric", day: "numeric" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { month: get("month"), day: get("day") };
}

export function inNpoWindow(now: Date): boolean {
  const { month, day } = torontoMonthDay(now);
  const { opens, closes } = NPO_WINDOW;
  return month === opens.month && day >= opens.day && day <= closes.day;
}

export function seasonCta(now: Date, positions: PositionTimes[]): SeasonCta {
  if (positions.some((p) => isOpenRound(p, now))) return { kind: "students", label: "Join the team", href: "/student/apply" };
  if (inNpoWindow(now)) return { kind: "nonprofits", label: "Apply for the program", href: "/npo#apply" };
  return { kind: "sponsors", label: "Sponsor GENESIS", href: "/genesis#sponsor" };
}
