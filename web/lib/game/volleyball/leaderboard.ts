/**
 * The court's leaderboard (specs/minigames/beach-volleyball.md, phase 3's board): the top casual wins this week. Until
 * phase 3's ratings table, it's sample residents plus your own wins this week counted on this device, and says so
 * (`sample`). Phase 3 swaps `weeklyBoard` for the real query; the board's sheet only reads what it returns. World names
 * only, never real names.
 */

export interface BoardRow { rank: number; name: string; wins: number; you: boolean }
export interface Board { rows: BoardRow[]; sample: boolean }

/** Sample players (made-up world names) and their wins, so the board isn't empty before phase 3. */
const SAMPLE: readonly (readonly [string, number])[] = [["Kelpie", 14], ["Sandpiper", 11], ["Driftwood", 9], ["Pebble", 7], ["Tidepool", 5], ["Coralie", 4], ["Gull", 2]];
const KEY = "tsi.volley.wins.v1";
const TOP = 10;

/** This week's key (Monday-start, UTC): a counter from last week doesn't carry over. */
export function weekKey(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

type Store = Pick<Storage, "getItem" | "setItem">;
const local = (): Store | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };

/** Your casual wins this week on this device. */
export function myWeekWins(now = new Date(), store: Store | null = local()): number {
  try {
    const v = JSON.parse(store?.getItem(KEY) ?? "null") as { week: string; wins: number } | null;
    return v && v.week === weekKey(now) ? v.wins : 0;
  } catch { return 0; }
}

/** A casual win: one more on your weekly count (call once per won match). */
export function noteCasualWin(now = new Date(), store: Store | null = local()): void {
  try { store?.setItem(KEY, JSON.stringify({ week: weekKey(now), wins: myWeekWins(now, store) + 1 })); } catch { /* private mode: the board just won't count it */ }
}

/** The top casual wins this week, you among them when you have any (`me`: your world name). */
export function weeklyBoard(me: string, now = new Date(), store: Store | null = local()): Board {
  const mine = myWeekWins(now, store);
  const all = [...SAMPLE.map(([name, wins]) => ({ name, wins, you: false })), ...(mine > 0 ? [{ name: me, wins: mine, you: true }] : [])]
    .sort((a, b) => b.wins - a.wins || Number(b.you) - Number(a.you));
  return { rows: all.slice(0, TOP).map((r, i) => ({ ...r, rank: i + 1 })), sample: true };
}
