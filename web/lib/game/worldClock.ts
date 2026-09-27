/**
 * World clock (look spec §7.2, row 238): the one time every world animation
 * reads, so two clients with correct clocks see the same rain, leaves, waves
 * and sway at the same moment.
 *
 * - **Source:** real UTC time (`Date.now()`), smoothed through
 *   `performance.now()` so frames advance evenly; it re-anchors whenever the
 *   wall clock jumps (sleep, NTP), so it never drifts from UTC.
 * - **Multiplayer:** `setWorldClockOffset` is the one place a server clock
 *   offset plugs in (server minus local, in ms). Nothing else changes.
 * - **Wrap:** seconds since the most recent 08:00 UTC, i.e. 04:00 Toronto in
 *   summer (EDT) and 03:00 in winter (EST). A fixed UTC hour, so there is no
 *   time-zone or DST arithmetic and every day is exactly 86 400 s. Anything
 *   periodic may pop once, at that quiet hour.
 * - **Precision:** the value stays under 86 400 < 2^17, so as a float32
 *   uniform it resolves 2^-7 s (7.8 ms, under half a 60 Hz frame). A shader
 *   phase `t * w` then steps in w/128 rad, invisible for sway and swell speeds.
 *   JS consumers work in doubles and are unaffected.
 */

const DAY_MS = 86_400_000;
/** 08:00 UTC: 04:00 EDT / 03:00 EST in Toronto. */
const WRAP_UTC_MS = 8 * 3_600_000;

let serverOffsetMs = 0;
let anchor: number | null = null;

/** Multiplayer hook: server time minus local time, in ms. 0 until a server says otherwise. */
export function setWorldClockOffset(ms: number): void {
  serverOffsetMs = ms;
}

/** World seconds for a UTC instant (pure; ms since the epoch). */
export function worldTimeAt(epochMs: number): number {
  const ms = (epochMs - WRAP_UTC_MS) % DAY_MS;
  return (ms < 0 ? ms + DAY_MS : ms) / 1000;
}

/** Wall-clock ms with sub-ms steps: performance.now() on a Date.now() anchor. */
function nowMs(): number {
  const wall = Date.now();
  if (typeof performance === "undefined") return wall;
  const mono = performance.now();
  if (anchor === null || Math.abs(anchor + mono - wall) > 250) anchor = wall - mono;
  return anchor + mono;
}

/** Seconds of world time, now: identical on every client with a correct clock. */
export function worldTime(): number {
  return worldTimeAt(nowMs() + serverOffsetMs);
}
