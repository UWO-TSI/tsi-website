import { FISH, WATER, RAR } from "./data.mjs";
import { writeFileSync } from "node:fs";
const OUT = new URL(".", import.meta.url).pathname;
const SEAS = ["Sp", "Su", "Au", "Wi"];
const BANDS = ["c", "u", "r", "e"];
const fish = FISH.map(([name, water, rarity, seasons, hours, weather, status, material, also, task]) => ({ name, water, rarity, seasons: seasons === "all" ? SEAS : seasons.split(" "), hours, weather, status, material, also, task, tourney: /tourney/.test(also) }));
const inHours = (h, hrs) => { if (hrs === "any") return true; const [a, b] = hrs.split("-").map(Number); return a < b ? h >= a && h < b : h >= a || h < b; };
function out(f, s, h, w) {
  if (!f.seasons.includes(s)) return 0;
  const win = inHours(h, f.hours);
  switch (f.weather) {
    case "rain+": return win || w === "rain" ? 1 : 0;
    case "rain": return win && w === "rain" ? 1 : 0;
    case "snow": return win && w === "snow" ? 1 : 0;
    case "cloudy": return win && (w === "cloudy" || w === "snow") ? 1 : 0;
    case "sunny": return win && w === "sunny" ? 1 : 0;
    case "rainx2": return win ? (w === "rain" ? 2 : 1) : 0;
    case "rainx3": return win ? (w === "rain" ? 3 : 1) : 0;
    default: return win ? 1 : 0;
  }
}
// Proposed odds
export const BASE = { R: { c: 62, u: 28, r: 8, e: 2 }, S: { c: 62, u: 28, r: 8, e: 2 }, P: { c: 64, u: 28, r: 6.5, e: 1.5 }, C: { c: 52, u: 30, r: 12, e: 6 }, D: { c: 48, u: 30, r: 13, e: 9 } };
export const LEG_N = { R: 2500, S: 2500, P: 2500, C: 1200, D: 1000 };
export const DIV_N = 20000;
const LIFT = { r: 0.8, e: 0.6, l: 0.4, d: 0.2 };
const lift = (r, L) => 1 + LIFT[r] * L;
const ORDER = ["c", "u", "r", "e", "l", "d"];
export const RODS = [
  { name: "Flimsy rod", rarity: "c", source: "starter", s: [10, 10, 10, 10, 10, 10], st: "today" },
  { name: "Driftwood rod", rarity: "c", source: "found", s: [15, 10, 5, 10, 15, 10], st: "later" },
  { name: "Cedar rod", rarity: "u", source: "shop", s: [30, 30, 20, 20, 30, 20], st: "today" },
  { name: "Bamboo rod", rarity: "u", source: "shop", s: [20, 30, 30, 30, 20, 30], st: "later" },
  { name: "Glass rod", rarity: "r", source: "shop", s: [40, 40, 30, 40, 30, 50], st: "today" },
  { name: "Coral rod", rarity: "r", source: "crafted", s: [55, 40, 35, 40, 50, 40], st: "later" },
  { name: "Lighthouse rod", rarity: "r", source: "crafted", s: [50, 60, 50, 50, 50, 40], st: "today" },
  { name: "Tidewarden rod", rarity: "e", source: "crafted", s: [70, 80, 70, 60, 60, 60], st: "today" },
  { name: "Abyss rod", rarity: "e", source: "crafted", s: [60, 60, 85, 75, 55, 65], st: "later" },
  { name: "Fallen Star rod", rarity: "l", source: "crafted", s: [85, 75, 80, 80, 70, 90], st: "new" },
];
const rodLuck = (stat) => 0.04 * (Math.min(100, stat) - 10) / 10;
const cap = (rr) => ORDER[Math.min(ORDER.indexOf(rr) + 1, 5)];
const hooks = (rod, r) => ORDER.indexOf(r) <= ORDER.indexOf(cap(rod.rarity));
const luckAlone = (rod) => rodLuck(rod.s[0]);
const luckFull = (rod) => 0.3 + rodLuck(rod.s[0] + 20) + 0.6;
// Band shares (percent) for a water in a slot, given which bands have fish out.
function bands(water, rod, L, present) {
  const b = BASE[water]; const sh = {};
  let rare = 0;
  for (const r of ["r", "e"]) if (hooks(rod, r)) { sh[r] = b[r] * lift(r, L); rare += sh[r]; } else sh[r] = 0;
  const cu = 100 - rare; sh.c = cu * b.c / (b.c + b.u); sh.u = cu * b.u / (b.c + b.u);
  // empty bands drop one rung
  for (const r of ["e", "r", "u"]) if (!present[r] && sh[r]) { const lo = ORDER[ORDER.indexOf(r) - 1]; sh[lo] += sh[r]; sh[r] = 0; }
  return sh;
}
const slots = []; for (const s of SEAS) for (let h = 0; h < 24; h++) slots.push([s, h]);
function poolAt(water, s, h, w, f0) { return fish.filter(f => f.water === water && (!f.tourney || f === f0) && ORDER.indexOf(f.rarity) < 4).map(f => [f, out(f, s, h, w)]).filter(([, x]) => x > 0); }
function bandAvg(water, rod, L, w = "sunny") {
  const acc = { c: 0, u: 0, r: 0, e: 0 };
  for (const [s, h] of slots) { const pool = poolAt(water, s, h, w); const present = {}; for (const [f] of pool) present[f.rarity] = true; const sh = bands(water, rod, L, present); for (const r of BANDS) acc[r] += sh[r]; }
  for (const r of BANDS) acc[r] /= slots.length; return acc;
}
const homeWeather = (f) => ({ rain: "rain", "rain+": "sunny", snow: "snow", cloudy: "cloudy", sunny: "sunny" }[f.weather] ?? "sunny");
function fishChance(f, rod, L) {
  if (f.rarity === "l" || f.rarity === "d") {
    if (!hooks(rod, f.rarity)) return null;
    const N = f.rarity === "l" ? LEG_N[f.water] : DIV_N; return 100 / N * lift(f.rarity, L);
  }
  if (!hooks(rod, f.rarity)) return null;
  const w = homeWeather(f); let sum = 0, n = 0;
  for (const [s, h] of slots) {
    const x = out(f, s, h, w); if (!x) continue;
    const pool = poolAt(f.water, s, h, w, f); const present = {}; for (const [g] of pool) present[g.rarity] = true;
    const sh = bands(f.water, rod, L, present);
    const tot = pool.filter(([g]) => g.rarity === f.rarity).reduce((a, [, y]) => a + y, 0);
    sum += sh[f.rarity] * x / tot; n++;
  }
  return n ? sum / n : null;
}
const R = (n) => RODS.find(r => r.name.startsWith(n));
const firstRod = { c: R("Flimsy"), u: R("Flimsy"), r: R("Cedar"), e: R("Glass"), l: R("Tidewarden"), d: R("Fallen") };
const best = (f) => f.rarity === "d" ? R("Fallen") : R("Tidewarden");
const fmt = (x, leg) => x == null ? "no" : leg ? `1 in ${Math.round(100 / x).toLocaleString("en-US")}` : x >= 1 ? x.toFixed(1) : x >= 0.1 ? x.toFixed(2) : `1 in ${Math.round(100 / x).toLocaleString("en-US")}`;
const res = { counts: {}, perFish: [], gaps: [], bandTables: [], today: [] };
for (const wk of Object.keys(WATER)) {
  const c = {}; for (const r of ORDER) c[r] = fish.filter(f => f.water === wk && f.rarity === r).length; res.counts[wk] = c;
}
for (const f of fish) {
  const a = fishChance(f, firstRod[f.rarity], luckAlone(firstRod[f.rarity]));
  const b = fishChance(f, best(f), luckFull(best(f)));
  const lg = f.rarity === "l" || f.rarity === "d"; res.perFish.push({ ...f, alone: fmt(a, lg), full: fmt(b, lg) });
}
// gaps: per water, season, day (06-17) / night (18-05), rarity, fair weather (sunny or cloudy)
for (const wk of Object.keys(WATER)) for (const s of SEAS) for (const [tod, hs] of [["day", [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]], ["night", [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5]]]) for (const r of BANDS) {
  const names = new Set(); for (const h of hs) for (const w of ["sunny", "cloudy"]) for (const [f] of poolAt(wk, s, h, w)) if (f.rarity === r) names.add(f.name);
  if (names.size === 0) res.gaps.push(`${WATER[wk]} ${s} ${tod} ${RAR[r]}`);
}
// band tables
for (const wk of Object.keys(WATER)) for (const rod of RODS) for (const [label, L] of [["rod alone", luckAlone(rod)], ["full stack", luckFull(rod)]]) {
  const b = bandAvg(wk, rod, L);
  const leg = hooks(rod, "l") ? `1 in ${Math.round(LEG_N[wk] / lift("l", L)).toLocaleString("en-US")}` : "no";
  const div = hooks(rod, "d") && (wk === "D" || wk === "S") ? `1 in ${Math.round(DIV_N / lift("d", L)).toLocaleString("en-US")}` : hooks(rod, "d") ? "none here" : "no";
  res.bandTables.push({ water: WATER[wk], rod: rod.name, st: rod.st, label, L: L.toFixed(2), c: b.c.toFixed(1), u: b.u.toFixed(1), r: b.r.toFixed(1), e: b.e.toFixed(1), leg, div });
}
// today's formula for comparison: weights c100 u48 r18 e7, rare+ x(1+luck); river = today's river + cliff fish, sea = today's sea + moved
const W = { c: 100, u: 48, r: 18, e: 7 };
function todayBands(waterSet, rodR, L) {
  const acc = { c: 0, u: 0, r: 0, e: 0 };
  for (const [s, h] of slots) {
    const pool = fish.filter(f => waterSet(f) && !f.tourney && (f.status === "T" || f.status === "M")).map(f => [f, out(f, s, h, "sunny")]).filter(([, x]) => x);
    const ok = pool.filter(([f]) => ORDER.indexOf(f.rarity) <= ORDER.indexOf(cap(rodR)));
    let tot = 0; const by = { c: 0, u: 0, r: 0, e: 0 };
    for (const [f, x] of ok) { const wt = W[f.rarity] * x * (ORDER.indexOf(f.rarity) >= 2 ? 1 + L : 1); by[f.rarity] += wt; tot += wt; }
    for (const r of BANDS) acc[r] += 100 * by[r] / tot;
  }
  for (const r of BANDS) acc[r] /= slots.length; return acc;
}
for (const [name, set] of [["River", f => f.water === "R" || (f.water === "C" && f.status === "T")], ["Sea", f => f.water === "S" || f.status === "M"]]) for (const [label, rodR, L] of [["Glass, MAX cast", "r", 1.3 + 0.12], ["Tidewarden + Lucky bobber, MAX cast", "e", 1.3 + 0.32], ["Tidewarden, every boost (MAX, bobber, full book, best meal, a friend)", "e", 1.3 + 0.32 + 0.4 + 0.35 + 0.1]]) {
  const b = todayBands(set, rodR, L); res.today.push({ water: name, label, L: L.toFixed(2), c: b.c.toFixed(1), u: b.u.toFixed(1), r: b.r.toFixed(1), e: b.e.toFixed(1) });
}
writeFileSync(OUT + "res.json", JSON.stringify(res, null, 1));
console.log(JSON.stringify(res.counts));
console.log("gaps:", res.gaps.length, res.gaps.join(" | "));
console.log("total", fish.length);
