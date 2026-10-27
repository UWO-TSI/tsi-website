/**
 * The two-account test's places in the active world (NEXT_PUBLIC_GAME_WORLD, as the server judges it), printed as JSON:
 * the campfire, a river cast spot the server accepts, the river's fish, the rock and shell nodes (the server's ids), the
 * sushi bar's entrance, exit and stools, the benches by the fire (lib/collections/rolls.ts castWater) and a walking route from the
 * spawn to the fire (a breadth-first search over the walker's standable ground, half a unit a step, never climbing faster
 * than the walker can, thinned to a waypoint every few units) to each of the fire, the bench and the bar's entrance.
 * Run 3 adds the collision targets (`hits`: the plaza fountain, a plaza bench, a plaza lamp post, the shop's wall and the
 * campfire's stone ring, each a drawn shape with a start 2.5 past it on open ground, the run's way one of the 8 a keyboard
 * walks, and a route there), three wharf deck edges over the sea (`edges`: the edge's point and outward normal, a start on
 * the deck 2 inside), and the HQ's and the shop's doors.
 *   cd web && NEXT_PUBLIC_GAME_WORLD=new npx vite-node -c vitest.config.ts ../specs/evidence/launch-check/spots.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { activeVillage, castWater } from "@/lib/collections/rolls";
import { FISH } from "@/lib/game/fishing";
import { villageNodes } from "@/lib/game/islandNodes";
import { ENTRY, STOOLS, STOOL_Z, SUSHI_BAR, barPoint } from "@/lib/game/sushiBar";
import { objectById, objectsOf } from "@/lib/game/villageMap";
import { BUILDING_SOLID, DECK_SQUARE_HALF, FIRE_PIT_RING, barDecks, islandOf, landmark, landmarkPoint, propFootprint, turn, wharfDecks } from "@/lib/game/defaultIsland";
import { NEW_LAMPS } from "@/lib/game/propModels";
import { dockToWorld } from "@/lib/game/wharf";
import { terrainHeight } from "@/lib/game/world/terrain";
import { village, villageSpawnPoint } from "@/lib/game/villageMap";
import { campfireSite } from "@/lib/game/campfireSite";
import { loadWorldFromDisk } from "@/lib/game/world/disk";
import { villageOfWorld } from "@/lib/game/world/village";
import { GAME_WORLD } from "@/lib/game/world/active";

const w = GAME_WORLD === "new" ? loadWorldFromDisk(join(process.cwd(), "data/world")) : null;
const v = w ? villageOfWorld(w) : village();
const fire = campfireSite(v)!;
const [sx, sz] = villageSpawnPoint(v);

// Everything walkable from the spawn (BFS over standable ground, nearest first).
const island = islandOf(v), S = 0.5, x0 = v.bounds.minX - 5, z0 = v.bounds.minZ - 5, nx = Math.ceil((v.bounds.maxX - x0 + 5) / S), nz = Math.ceil((v.bounds.maxZ - z0 + 5) / S);
const px = (i: number) => x0 + i * S, pz = (k: number) => z0 + k * S, idx = (x: number, z: number) => Math.round((z - z0) / S) * nx + Math.round((x - x0) / S);
const prev = new Int32Array(nx * nz).fill(-2), queue = [idx(sx, sz)];
prev[queue[0]] = -1;
for (let q = 0; q < queue.length; q++) {
  const j = queue[q], i = j % nx, k = (j - i) / nx, h = island.ground(px(i), pz(k));
  for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = (k + dk) * nx + i + di, x = px(i + di), z = pz(k + dk);
    if (i + di < 0 || k + dk < 0 || i + di >= nx || k + dk >= nz || prev[c] !== -2 || !island.standable(x, z) || island.ground(x, z) - h > 0.4) continue;
    prev[c] = j; queue.push(c);
  }
}
// A river cast spot: ground a player walks to from the spawn with the river in reach (the server's own check), nearest the middle of the world's River
// annotation (the village: nearest the fire).
const cells = w?.annotations.find(a => a.name === "River")?.cells ?? [];
const mid = cells.length ? cells[cells.length >> 1] : null;
const [cx, cz] = mid && w ? [mid[0] + w.terrain.originX, mid[1] + w.terrain.originZ] : [fire.x, fire.z];
let cast: [number, number] | null = null;
for (let r = 0; r < 200 && !cast; r += 1) for (let a = 0; a < 64 && !cast; a++) {
  const x = Math.round(cx + r * Math.cos((a / 64) * 2 * Math.PI)), z = Math.round(cz + r * Math.sin((a / 64) * 2 * Math.PI));
  if (prev[idx(x, z)] !== -2 && castWater("village", [x, z]) === "river") cast = [x, z];
}

/** The shortest walk from the spawn to within `r` of (x, z), a waypoint every 4 u. */
function routeTo(x: number, z: number, r: number): [number, number][] {
  const goal = queue.find(j => Math.hypot(px(j % nx) - x, pz(Math.floor(j / nx)) - z) < r) ?? -1, path: [number, number][] = [];
  for (let j = goal; j >= 0; j = prev[j]) path.unshift([px(j % nx), pz(Math.floor(j / nx))]);
  return path.filter((_, i) => i % 8 === 0 || i === path.length - 1);
}
const bar = objectById("prop", SUSHI_BAR, v);
const sushi = bar && { entrance: barPoint(bar, ...ENTRY), exit: barPoint(bar, 0, 5.3), stools: STOOLS.map(lx => barPoint(bar, lx, STOOL_Z)) };
const benches = objectsOf("bench", v).filter(b => b.id.startsWith("fire-bench"));
const route = routeTo(fire.x, fire.z, 3.2);
const nodes = villageNodes(activeVillage()).forage, pick = (p: string) => nodes.filter(n => n.id.startsWith(p)).map(({ id, x, z }) => ({ id, x, z }));
const riverFish = FISH.filter(f => (f.zone ?? "river") === "river").map(f => f.key);
// ── Run 3: what's drawn, to run into ──────────────────────────────────
const t = w?.terrain;
const reached = (x: number, z: number) => prev[idx(x, z)] !== -2;
const clear = (x: number, z: number) => island.standable(x, z) && island.top(x, z) === island.ground(x, z);
const WAYS = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)] as const);
type Shape = { kind: "round"; x: number; z: number; r: number } | { kind: "box"; x: number; z: number; a: [number, number]; b: [number, number]; hw: number; hd: number };
/** How far from the shape's middle its edge is along (ux, uz). */
const reachOf = (s: Shape, ux: number, uz: number) => s.kind === "round" ? s.r
  : Math.min(s.hw / (Math.abs(ux * s.a[0] + uz * s.a[1]) || 1e-9), s.hd / (Math.abs(ux * s.b[0] + uz * s.b[1]) || 1e-9));
const box = (x: number, z: number, yaw: number, hw: number, hd: number): Shape => ({ kind: "box", x, z, a: turn(1, 0, yaw), b: turn(0, 1, yaw), hw, hd });
/** A start 2.5 past the shape on open, reached ground, the run aimed at its middle (square on to a face first). */
function target(id: string, s: Shape, avoid?: [number, number]) {
  const face = (ux: number, uz: number) => s.kind === "round" ? 1 : Math.max(Math.abs(ux * s.a[0] + uz * s.a[1]), Math.abs(ux * s.b[0] + uz * s.b[1]));
  for (const [ux, uz] of [...WAYS].sort((p, q) => face(...q) - face(...p))) {
    const e = reachOf(s, ux, uz), start: [number, number] = [s.x + ux * (e + 2.5), s.z + uz * (e + 2.5)];
    if (avoid && Math.hypot(start[0] - avoid[0], start[1] - avoid[1]) < 3) continue;
    let ok = reached(...start);
    for (let d = e + 0.35; ok && d <= e + 2.5; d += 0.25) ok = clear(s.x + ux * d, s.z + uz * d);
    if (ok) return { id, shape: s, start, way: [-ux, -uz], route: routeTo(...start, 0.6) };
  }
  return { id, shape: s, start: null };
}
const all = w ? w.objects : [];
const fountain = all.find(o => o.model === "plaza-fountain");
const near = (o: { x: number; z: number }) => fountain ? Math.hypot(o.x - fountain.x, o.z - fountain.z) : 0;
const plazaBench = all.filter(o => /bench/.test(o.model ?? "") && propFootprint(o)).sort((p, q) => near(p) - near(q))[0];
const lamp = all.filter(o => o.kind === "lamp" && o.model === "village" && o.id.startsWith("lamp-plaza")).sort((p, q) => near(p) - near(q))[0];
const shop = landmark("shop", v), shopDoor = landmarkPoint("shop", "door", v);
const hits = [
  fountain && target("the plaza fountain", { kind: "round", x: fountain.x, z: fountain.z, r: propFootprint(fountain)![0] }),
  plazaBench && (() => { const f = propFootprint(plazaBench)!, [dx, dz] = turn(f[2], f[3], plazaBench.yaw); return target(`a plaza bench (${plazaBench.id})`, box(plazaBench.x + dx, plazaBench.z + dz, plazaBench.yaw ?? 0, f[0], f[1])); })(),
  lamp && target(`a lamp post (${lamp.id})`, box(lamp.x, lamp.z, 0, NEW_LAMPS.village.post, NEW_LAMPS.village.post)),
  shop && (() => { const [cx, cz, hw, hd] = BUILDING_SOLID.shop!, k = shop.scale ?? 1, [dx, dz] = turn(cx * k, cz * k, shop.yaw); return target("the shop's wall", box(shop.x + dx, shop.z + dz, shop.yaw ?? 0, hw * k, hd * k), shopDoor ?? undefined); })(),
  target("the campfire's stone ring", { kind: "round", x: fire.x, z: fire.z, r: FIRE_PIT_RING * (fire.scale ?? 1) }),
].filter(Boolean);

// Three deck edges over the sea: the edge's middle, its outward normal within 23 degrees of a keyboard way, sea 1 past it
// (no deck, no ground), the deck 2 inside it standable and reached.
const H = DECK_SQUARE_HALF, at = { x: 0, z: 0 }, rects = [...wharfDecks(v), ...barDecks(v)];
const onDeckOrLand = (x: number, z: number) => rects.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)
  || objectsOf("deck", v).some(o => { const [lx, lz] = turn(x - o.x, z - o.z, -(o.yaw ?? 0)); return Math.abs(lx) <= H && Math.abs(lz) <= H; })
  || (t ? terrainHeight(t, x, z) >= t.seaLevel : true);
const cands: { square: string; edge: [number, number]; normal: [number, number]; start: [number, number]; off: number }[] = [];
for (const o of objectsOf("deck", v)) for (const [lx, lz, nx, nz] of [[0, -H, 0, -1], [0, H, 0, 1], [-H, 0, -1, 0], [H, 0, 1, 0]]) {
  const d = { x: o.x, z: o.z, yaw: o.yaw ?? 0 };
  dockToWorld(d, lx, lz, at); const edge: [number, number] = [at.x, at.z];
  dockToWorld({ ...d, x: 0, z: 0 }, nx, nz, at); const normal: [number, number] = [at.x, at.z];
  const ang = Math.atan2(normal[1], normal[0]), off = Math.abs(((ang / (Math.PI / 4)) % 1 + 1.5) % 1 - 0.5) * 45;
  const start: [number, number] = [edge[0] - normal[0] * 2, edge[1] - normal[1] * 2];
  if (off > 23 || onDeckOrLand(edge[0] + normal[0], edge[1] + normal[1]) || !island.standable(...start) || !reached(...start)) continue;
  cands.push({ square: o.id, edge, normal, start, off });
}
// Spread along the wharf: the northmost, the middle and the southmost candidate.
const byZ = [...cands].sort((p, q) => p.edge[1] - q.edge[1]);
const edges = (byZ.length ? [...new Set([byZ[0], byZ[byZ.length >> 1], byZ[byZ.length - 1]])] : []).map(c => ({ ...c, route: routeTo(...c.start, 0.6) }));
const doors = { hq: landmarkPoint("hq", "door", v), shop: shopDoor };
const doorRoutes = Object.fromEntries(Object.entries(doors).map(([k, d]) => [k, d ? routeTo(d[0], d[1], 1.2) : []]));

// The walk tree itself (each reached cell's step back toward the spawn), for routes between any two places (PREV_OUT).
if (process.env.PREV_OUT) writeFileSync(process.env.PREV_OUT, Buffer.from(prev.buffer));
const grid = { x0, z0, nx, nz, S };

console.log(JSON.stringify({ grid, hits, edges, deckEdgeCandidates: cands.length, doors, doorRoutes, world: GAME_WORLD, spawn: [sx, sz], fire: { x: fire.x, z: fire.z }, cast, riverFish, rocks: pick("rock-"), shells: pick("shell-"), route,
  sushi: sushi && { ...sushi, route: routeTo(...sushi.entrance, 0.6) }, benches: benches.map(b => ({ id: b.id, x: b.x, z: b.z, route: routeTo(b.x, b.z, 1.4) })) }));
