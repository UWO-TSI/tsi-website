/**
 * The performance budget's deterministic checks (specs/perf/budget.md, budget.ts): every shipped character, hair,
 * accessory, weapon, tool, effect, enemy and building GLB within its category; the character look within its LOD tiers'
 * triangles, with a LOD 1 for every part; every particle pool registered and within its cap, every juice event and
 * combat recipe within its particles; no light in a character effect; the bots' network rates within the per-player
 * budget. A new asset or pool over budget fails here with its name and the budget it broke.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pack } from "msgpackr";
import { glbStats, imageSize, type GlbStats } from "./glbStats";
import {
  ASSET_CATEGORIES, ASSET_EXCEPTIONS, CHARACTER_BUDGET, CHARACTER_EFFECT_FILES, EFFECT_BUDGET, JUICE_EVENT_PARTICLES, NETWORK_BUDGET, PARTICLE_POOLS, SHARD, type AssetBudget,
} from "./budget";
import { BASE_URL, PARTS, type CatalogPart } from "@/lib/game/character/look";
import { FX_KEYS } from "./fxBench";
import { ParticlePool } from "@/lib/game/fx/particles";
import { FX, FX_BUDGET, FX_POOLS, recipeCost } from "@/lib/game/fx/combat";
import * as juice from "@/lib/game/movement/juice";
import { createBots } from "@/lib/net/botBrain";
import type { PosePacket } from "@/lib/net/protocol";

const web = join(__dirname, "../../..");
const assets = join(web, "public/assets");
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const stats = new Map<string, GlbStats>();
const statsOf = (rel: string) => { let s = stats.get(rel); if (!s) stats.set(rel, (s = glbStats(readFileSync(join(assets, rel))))); return s; };

describe("asset budgets (budget.ts ASSET_CATEGORIES)", () => {
  const glbs = walk(assets).filter(f => f.endsWith(".glb")).map(f => relative(assets, f));
  const categoryOf = (rel: string) => ASSET_CATEGORIES.find(c => c.prefixes.some(p => rel.startsWith(p)));
  const fields: (keyof AssetBudget)[] = ["triangles", "primitives", "materials", "texture", "bones"];
  const measured = (s: GlbStats): AssetBudget => ({ triangles: s.triangles, primitives: s.primitives, materials: s.materials, texture: s.maxTexture, bones: s.bones });

  it("covers the character, hair, accessory, weapon, tool, effect, enemy and building folders", () => {
    for (const c of ASSET_CATEGORIES) expect(glbs.some(g => c.prefixes.some(p => g.startsWith(p))), c.name).toBe(true);
  });
  it("keeps every shipped GLB in a budgeted folder within its category (or its listed exception)", () => {
    const over: string[] = [];
    for (const rel of glbs) {
      const c = categoryOf(rel);
      if (!c) continue;
      const s = measured(statsOf(rel)), x = ASSET_EXCEPTIONS[rel];
      for (const f of fields) {
        const cap = x?.[f] ?? c[f];
        if (s[f] > cap) over.push(`${rel}: ${f} ${s[f]} over the ${x?.[f] !== undefined ? "exception's" : `${c.name} budget's`} ${cap} (specs/perf/budget.md; lighten it, or list it in budget.ts ASSET_EXCEPTIONS with why)`);
      }
    }
    expect(over, over.join("\n")).toEqual([]);
  });
  it("lists only exceptions that are still needed, each tighter than its category", () => {
    for (const [rel, x] of Object.entries(ASSET_EXCEPTIONS)) {
      expect(existsSync(join(assets, rel)), `${rel} no longer ships: drop its exception`).toBe(true);
      const c = categoryOf(rel)!, s = measured(statsOf(rel));
      expect(c, `${rel} is in no budgeted folder`).toBeDefined();
      const needed = fields.some(f => s[f] > c[f]);
      expect(needed, `${rel} is within the ${c.name} budget now: drop its exception`).toBe(true);
      for (const f of fields) if (x[f] !== undefined) expect(x[f]! > c[f], `${rel}: its ${f} exception is no looser than the category`).toBe(true);
    }
  });
  it("reads image sizes from PNG, JPEG and WebP headers", () => {
    const png = readFileSync(join(web, "public/assets/characters/v6/decal_tsi_mark.png"));
    expect(imageSize(png)?.width).toBeGreaterThan(0);
  });
});

describe("character budget (budget.ts CHARACTER_BUDGET)", () => {
  const lodOf = (p: CatalogPart) => `characters/v6/lod1/${p.glb}`;
  const fullOf = (p: CatalogPart) => `characters/v6/${p.glb}`;
  /** The base the engine loads (the catalogue's clip base), under public/assets. */
  const BASE_REL = BASE_URL.replace(/^\/assets\//, "");
  /** The base's skin and face (what the engine keeps of the base GLB), and the LOD 1 skin. */
  const base = (() => {
    const buf = readFileSync(join(assets, BASE_REL));
    const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")) as {
      meshes: { primitives: { indices: number; material: number }[] }[]; materials: { name: string }[]; accessors: { count: number }[];
    };
    let tris = 0;
    for (const m of gltf.meshes) for (const p of m.primitives) if (["M_Skin", "M_Face"].includes(gltf.materials[p.material].name)) tris += gltf.accessors[p.indices].count / 3;
    return tris;
  })();
  const face = (() => {
    const buf = readFileSync(join(assets, BASE_REL));
    const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")) as { meshes: { primitives: { indices: number; material: number }[] }[]; materials: { name: string }[]; accessors: { count: number }[] };
    let tris = 0;
    for (const m of gltf.meshes) for (const p of m.primitives) if (gltf.materials[p.material].name === "M_Face") tris += gltf.accessors[p.indices].count / 3;
    return tris;
  })();
  /** The heaviest look a member can wear, by any one measure (each slot's heaviest part; a hat or hood replaces the back hair). */
  function heaviest(tris: (p: CatalogPart) => number) {
    const most = (f: (p: CatalogPart) => boolean) => Math.max(0, ...PARTS.filter(f).map(tris));
    const outfit = Math.max(most(p => p.slot === "top") + most(p => p.slot === "bottom"), most(p => p.slot === "onepiece"));
    const accessories = (["face", "bag", "neck"] as const).reduce((s, g) => s + most(p => p.group === g), 0);
    // the hair: bangs with a back (and a band over it), or a whole hairstyle that replaces both (look.ts wornParts), or
    // a hat (which replaces the back and keeps the bangs)
    const band = most(p => p.group === "head" && !p.hidesBackHair);
    const hair = Math.max(most(p => p.slot === "bangs") + most(p => p.slot === "back" && !p.full) + band,
      most(p => p.slot === "back" && !!p.full) + band, most(p => p.slot === "bangs") + most(p => p.group === "head" && !!p.hidesBackHair));
    return hair + outfit + most(p => p.slot === "shoes") + accessories;
  }

  it("ships a LOD 1 for every part, no heavier than the full part", () => {
    for (const p of PARTS) {
      expect(existsSync(join(assets, lodOf(p))), `${p.glb} has no LOD 1 (art/characters/build_lod.py)`).toBe(true);
      expect(statsOf(lodOf(p)).triangles, `${p.glb}'s LOD 1`).toBeLessThanOrEqual(statsOf(fullOf(p)).triangles);
    }
    for (const rel of walk(join(assets, "characters/v6/lod1")).filter(f => f.endsWith(".glb")).map(f => relative(join(assets, "characters/v6/lod1"), f))) {
      if (rel.startsWith("base/")) continue;
      expect(PARTS.some(p => p.glb === rel), `lod1/${rel} has no catalogue part`).toBe(true);
    }
  });
  it("keeps the heaviest look within the Full and LOD 1 tiers' triangles, on the 22-bone rig", () => {
    const full = base + heaviest(p => statsOf(fullOf(p)).triangles);
    const lod1 = statsOf("characters/v6/lod1/base/skin.glb").triangles + face + heaviest(p => statsOf(lodOf(p)).triangles);
    expect(full, `the heaviest full look: ${full} triangles`).toBeLessThanOrEqual(CHARACTER_BUDGET.full.triangles);
    expect(lod1, `the heaviest LOD 1 look: ${lod1} triangles`).toBeLessThanOrEqual(CHARACTER_BUDGET.lod1.triangles);
    for (const p of PARTS) expect(statsOf(fullOf(p)).bones, p.glb).toBeLessThanOrEqual(CHARACTER_BUDGET.full.bones);
    expect(statsOf(BASE_REL).bones).toBe(CHARACTER_BUDGET.full.bones);
  });
});

describe("effect budgets (budget.ts PARTICLE_POOLS, JUICE_EVENT_PARTICLES; fx/combat.ts FX_BUDGET)", () => {
  const sources = ["components", "lib"].flatMap(d => walk(join(web, d))).filter(f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  /** Each file's particle pool capacities, from its `new ParticlePool(<capacity>` calls (a literal, a const in the file, or FX_POOLS.<pool>). */
  function poolsIn(file: string): number[] {
    const src = readFileSync(file, "utf8"), out: number[] = [];
    for (const m of src.matchAll(/new ParticlePool\(\s*([A-Za-z_.0-9]+)/g)) {
      const arg = m[1];
      if (/^\d+$/.test(arg)) out.push(Number(arg));
      else if (arg.startsWith("FX_POOLS.")) out.push(FX_POOLS[arg.slice(9) as keyof typeof FX_POOLS] as number);
      else {
        const def = new RegExp(`\\b${arg}\\s*=\\s*(\\d+)`).exec(src);
        expect(def, `${relative(web, file)}: can't read the capacity ${arg}; use a literal or a const in the file`).not.toBeNull();
        out.push(Number(def![1]));
      }
    }
    return out;
  }
  it("registers every particle pool, each file within its cap", () => {
    const seen = new Set<string>();
    for (const file of sources) {
      const pools = poolsIn(file);
      if (!pools.length) continue;
      const rel = relative(web, file), cap = PARTICLE_POOLS[rel], total = pools.reduce((a, b) => a + b, 0);
      seen.add(rel);
      expect(cap, `${rel} makes particle pools (${pools.join(" + ")}): register it in budget.ts PARTICLE_POOLS with its budget`).toBeDefined();
      expect(total, `${rel}: ${total} particles over its budget of ${cap}`).toBeLessThanOrEqual(cap);
    }
    for (const rel of Object.keys(PARTICLE_POOLS)) expect(seen.has(rel), `${rel} makes no pool any more: drop it from PARTICLE_POOLS`).toBe(true);
  });
  it("keeps every combat recipe within its tier's particles and lights", () => {
    for (const [key, r] of Object.entries(FX)) {
      const c = recipeCost(r);
      expect(c.particles, `${key}: ${c.particles} particles over the ${r.tier} budget`).toBeLessThanOrEqual(FX_BUDGET[r.tier].particles);
      expect(c.lights, key).toBeLessThanOrEqual(FX_BUDGET[r.tier].lights);
    }
  });
  it(`keeps each movement event within ${JUICE_EVENT_PARTICLES} particles on any ground`, () => {
    const grounds: juice.GroundKind[] = ["grass", "sand", "wetSand", "soil", "stone", "wood", "snow", "water"];
    const events: [string, (p: ParticlePool, g: juice.GroundKind) => void][] = [
      ["footstep", (p, g) => juice.footstep(p, g, 0, 0, 0, 1, 1, true)],
      ["takeoff", (p, g) => juice.takeoff(p, g, 0, 0, 0, 1, 1)],
      ["landing heavy", (p, g) => juice.landing(p, g, "heavy", 0, 0, 0, 1, 1)],
      ["dash", (p, g) => juice.dashBurst(p, g, false, 0, 0, 0, 0, 1, 0)],
      ["dash aloft", (p, g) => juice.dashBurst(p, g, true, 0, 2, 0, 0, 1, 0)],
      ["slide burst", (p, g) => juice.slideBurst(p, g, 0, 0, 0, 1, 1)],
      ["slide pop", (p, g) => juice.slidePop(p, g, 0, 0, 0, 1, 1)],
      ["glide open", p => juice.glideOpen(p, 0, 2, 0, 0)],
      ["glide set-down", (p, g) => juice.glideSetDown(p, g, 0, 0, 0)],
      ["splash big", p => juice.splash(p, 0, 0, 0, 1, 3)],
      ["mantle", (p, g) => juice.mantleGrab(p, g, 0, 1, 0, 1, 0)],
      ["roll", (p, g) => juice.rollTumble(p, g, 0, 0, 0, 1, 1)],
    ];
    for (const [name, fire] of events) for (const g of grounds) {
      const pool = new ParticlePool(512);
      fire(pool, g);
      expect(pool.alive, `${name} on ${g}`).toBeLessThanOrEqual(JUICE_EVENT_PARTICLES);
    }
  });
  it("budgets every character effect the bench can switch, and keeps the auras' motes within theirs", () => {
    for (const k of FX_KEYS) expect(EFFECT_BUDGET[k], `${k}: give it an EFFECT_BUDGET entry`).toBeDefined();
    expect(EFFECT_BUDGET.juice.particles).toBe(JUICE_EVENT_PARTICLES);
    const sub = /const MOTES = (\d+), SECOND = (\d+)/.exec(readFileSync(join(web, "components/game/oracle/SubclassAura.tsx"), "utf8"));
    const fam = /const MOTES = (\d+);/.exec(readFileSync(join(web, "components/game/oracle/FamilyAura.tsx"), "utf8"));
    expect(sub && fam, "the auras' mote counts (MOTES) are where this test reads them").toBeTruthy();
    expect(Number(sub![1]) + Number(sub![2]) + 1, "the subclass aura's motes and its ring").toBeLessThanOrEqual(EFFECT_BUDGET.auraSubclass.particles);
    expect(Number(fam![1]), "the family aura's motes").toBeLessThanOrEqual(EFFECT_BUDGET.auraFamily.particles);
  });
  it("puts no light in any character effect (a light appearing recompiles every lit material)", () => {
    for (const rel of CHARACTER_EFFECT_FILES) {
      const src = readFileSync(join(web, rel), "utf8");
      expect(/PointLight|SpotLight|pointLight|spotLight|RectAreaLight/.test(src), `${rel} adds a light`).toBe(false);
    }
    expect(FX_POOLS.lights).toBeLessThanOrEqual(2);
  });
});

describe("network budget (budget.ts NETWORK_BUDGET; specs/multiplayer.md §4.3)", () => {
  it("keeps every bot's pose stream within the per-player budget up, and a full shard of them down", () => {
    const n = 12, seconds = 60, bots = createBots(n, 7);
    const bytes = new Array<number>(n).fill(0), packets = new Array<number>(n).fill(0);
    bots.forEach((b, i) => {
      for (let t = 0; t <= seconds * 1000; t += 100) b.advance(t, { pose: (p: PosePacket) => { bytes[i] += pack(p).length; packets[i]++; }, slow: () => {} });
    });
    const perSecond = bytes.map(b => b / seconds), rate = packets.map(p => p / seconds);
    for (let i = 0; i < n; i++) {
      expect(perSecond[i], `bot ${i}: ${perSecond[i].toFixed(0)} B/s up`).toBeLessThanOrEqual(NETWORK_BUDGET.upBytesPerSecond);
      expect(rate[i], `bot ${i}: ${rate[i].toFixed(1)} packets/s`).toBeLessThanOrEqual(NETWORK_BUDGET.packetsPerSecond);
    }
    const busiest = Math.max(...perSecond);
    expect(busiest * (SHARD.players - 1), "a full shard of the busiest mover, down").toBeLessThanOrEqual(NETWORK_BUDGET.downBytesPerSecond);
  });
});
