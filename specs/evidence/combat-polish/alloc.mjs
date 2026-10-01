// Combat polish 12: bytes the encounter tick allocates per 60 Hz frame in a full pack fight (17 enemies, 3 totems).
// Run from web/: node --expose-gc ../specs/evidence/combat-polish/alloc.mjs   (PROFILE=1 lists the allocation sites)
import { createRequire } from "node:module";
const { createJiti } = createRequire(`${process.cwd()}/package.json`)("jiti");
const jiti = createJiti(`${process.cwd()}/`, { alias: { "@": process.cwd() } });
const { createRuntime } = await jiti.import("./lib/game/combat/runtime.ts");
const { stepCombat } = await jiti.import("./lib/game/combat/encounter.ts");
const { spawnWave, attack } = await jiti.import("./lib/game/combat/actions.ts");
const { equipKit, fireSlot } = await jiti.import("./lib/game/combat/abilities.ts");
const { subclassByKey } = await jiti.import("./lib/combat/kits.ts");
const { WAVES } = await jiti.import("./lib/game/combat/spawns.ts");
const rt = createRuntime(), me = { x: 0, z: 8.2 };
rt.player.safe = false; rt.player.maxHp = rt.player.hp = 1e9;
equipKit(rt, subclassByKey("shaman"));
for (const w of WAVES["survive-sanctum"]) spawnWave(rt, w);
for (const w of WAVES["survive-circle"]) spawnWave(rt, w.map(s => ({ ...s, x: s.x - 6.5, z: s.z + 22 })));
for (const e of rt.enemies) e.hp = 1e9;
let seed = 1; const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
rt.player.aim = { x: 1, z: 9 };
for (let i = 0; i < 4; i++) { rt.cooldowns[`slot${i + 1}`] = 0; fireSlot(rt, i % 3, me, random); }
let n = 0;
const tick = () => {
  if (n++ % 60 === 0) { rt.player.energy = 100; for (let i = 0; i < 3; i++) { rt.cooldowns[`slot${i + 1}`] = 0; fireSlot(rt, i, me, random); } for (const u of rt.units) u.hp = 1e9; }
  stepCombat(rt, me, 1 / 60, () => true, random); rt.cues.length = 0; if (n % 25 === 0) { rt.player.attackCd = 0; attack(rt, me, random); }
};
for (let i = 0; i < 6000; i++) tick(); // warm up (JIT)
const N = 60, out = [];
for (let k = 0; k < 15; k++) { globalThis.gc(); const before = process.memoryUsage().heapUsed; for (let i = 0; i < N; i++) tick(); out.push((process.memoryUsage().heapUsed - before) / N); }
out.sort((a, b) => a - b);
console.log(`${rt.enemies.length} enemies, ${rt.units.length} units, ${rt.projectiles.length} shots: median ${Math.round(out[7])} bytes per tick (min ${Math.round(out[0])}, max ${Math.round(out[14])})`);
if (process.env.PROFILE) {
  const { Session } = await import("node:inspector/promises");
  const s = new Session(); s.connect();
  await s.post("HeapProfiler.startSampling", { samplingInterval: 64, includeObjectsCollectedByMinorGC: true, includeObjectsCollectedByMajorGC: true });
  for (let i = 0; i < 600; i++) tick();
  const { profile } = await s.post("HeapProfiler.stopSampling");
  const agg = new Map();
  const walk = (n, path) => { const cf = n.callFrame, name = `${cf.functionName || "(anon)"} ${cf.url.split("/").pop()}:${cf.lineNumber + 1}`; if (n.selfSize) agg.set(path.slice(-3).concat(name).join(" < "), (agg.get(path.slice(-3).concat(name).join(" < ")) ?? 0) + n.selfSize); n.children.forEach(c => walk(c, [...path, name])); };
  walk(profile.head, []);
  [...agg].sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, v]) => console.log(Math.round(v / 600), k.split(" < ").slice(-2).join(" < ")));
}
