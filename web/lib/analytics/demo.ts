/**
 * A made-up snapshot for the dev page (/dev/analytics) and the tests: players who join over ten weeks, walk the funnel
 * with a drop at each step, play sessions and use features. Seeded, so the same every run. No real data, made-up names.
 */
import { STEP_IDS, FEATURES } from "./steps";
import type { Snapshot } from "./report";

const DAY = 86_400_000;
const NAMES = ["Pebble", "Moss", "Juniper", "Kelp", "Linden", "Clover", "Pip", "Sorrel", "Bramble", "Fern", "Tansy", "Quill", "Nettle", "Rook", "Sable", "Thistle", "Briar", "Cobble", "Dune", "Ember"];
const SCREENS = ["village", "village", "village", "hq", "museum", "shop", "bag", "sell", "journal", "cafe", "home"];

function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function demoSnapshot(now: Date, players = 140, seed = 7): Snapshot {
  const r = rng(seed);
  const end = now.getTime();
  const snap: Snapshot = { players: [], steps: [], sessions: [], uses: [], days: [] };
  const iso = (t: number) => new Date(t).toISOString();
  const funnel = STEP_IDS.filter((s) => s !== "signed_in" && s !== "day_2" && s !== "day_7");
  for (let i = 0; i < players; i++) {
    const id = `demo-${i}`;
    const joined = end - r() ** 1.3 * 70 * DAY;
    snap.players.push({ id, name: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ""}`, joined: iso(joined), last: null });
    // The walk: each step a little less likely; the opening's creator and the HQ's key tour lose the most.
    let t = joined + 20_000, last = "signed_in";
    for (const s of funnel) {
      const keep = s === "creator" ? 0.86 : s === "hq_tour" ? 0.8 : s === "tut_cast" ? 0.9 : s === "first_quest" ? 0.75 : 0.97;
      if (r() > keep) break;
      t += (s.startsWith("hq_") ? 25 : 60) * 1000 * (0.5 + r() * 1.5);
      snap.steps.push({ m: id, s, at: iso(t) });
      last = s;
    }
    // Sessions: the first runs through the walk; then more, fewer for those who stopped early.
    const loyal = funnel.indexOf(last as never) / funnel.length;
    const visits = 1 + Math.floor(r() * 14 * loyal * loyal);
    let at = joined;
    for (let v = 0; v < visits && at < end; v++) {
      const len = v === 0 ? t - joined + 60_000 : (4 + r() * 40) * 60_000;
      const stop = Math.min(at + len, end);
      snap.sessions.push({ m: id, start: iso(at), end: iso(stop), last_step: v === 0 ? last : null, screen: v === 0 && last !== "first_quest" ? "opening" : SCREENS[Math.floor(r() * SCREENS.length)] });
      snap.days.push({ m: id, d: iso(at).slice(0, 10) });
      for (const f of FEATURES) if (r() < (f === "fishing" || f === "selling" || f === "daily_gift" ? 0.7 : 0.12) * (v ? 1 : 0.5)) snap.uses.push({ m: id, f, d: iso(at).slice(0, 10) });
      at = stop + (0.3 + r() ** 2 * 6) * DAY;
    }
    snap.players[i].last = snap.sessions.at(-1)!.end;
  }
  return snap;
}
