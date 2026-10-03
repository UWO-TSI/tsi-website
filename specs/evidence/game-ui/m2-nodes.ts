// Milestone 2 evidence: which village nodes the collections demo's member (?collections=demo) can pick up by hand
// this hour, as the server rolls them (lib/collections/rolls.ts nodeRoll, clear weather), and where to stand for two
// at once; and a bag for the phone companion (it has no demo), from the real service on its memory store.
// shoot-m2.mjs runs it:  npx vite-node -c web/vitest.config.ts <this file> [iso time]
import { villageNodes } from "@/lib/game/islandNodes";
import { nodeRoll } from "@/lib/collections/rolls";
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { bagView, donate } from "@/lib/collections/service";

const ME = "00000000-0000-4000-8000-000000000001";
const now = new Date(process.argv[2] ?? Date.now());
const forage = villageNodes().forage.filter(n => !n.canopy).flatMap(n => {
  const sp = nodeRoll(ME, n, now, "clear");
  return sp && sp.tool === "hand" ? [{ id: n.id, x: n.x, z: n.z, key: sp.key, category: sp.category }] : [];
});
const branches = villageNodes().forage.filter(n => n.drop?.key === "wood_branch").map(n => ({ id: n.id, x: n.x, z: n.z }));
const pairs = forage.flatMap((a, i) => forage.slice(i + 1).filter(b => b.key !== a.key && Math.hypot(a.x - b.x, a.z - b.z) < 2.6)
  .map(b => ({ a, b, at: [(a.x + b.x) / 2, (a.z + b.z) / 2] })));
const m = memoryCollectionsStore(() => now);
for (const [key, n] of [["wood_branch", 29], ["rock_stone", 12], ["rock_iron_nugget", 4], ["apple", 9], ["fruit_orange", 3], ["flower_rose", 4], ["shell_scallop", 3],
  ["fish_dace", 1], ["fish_black_bass", 1], ["fish_carp", 1], ["bug_monarch_butterfly", 1], ["bug_ladybug", 1], ["sea_sea_star", 1], ["mushroom_round", 3], ["rock_gold_nugget", 1]] as const) m.give(ME, key, n);
m.record(ME, "fish_black_bass", 42);
m.give("00000000-0000-4000-8000-0000000001a1", "fish_dace", 1);
await donate(m.store, "00000000-0000-4000-8000-0000000001a1", "fish_dace", "demo-don-1");
const phone = await bagView(m.store, ME);
console.log(JSON.stringify({ now: now.toISOString(), forage, pairs, branches: branches.slice(0, 6), phoneBag: phone.ok ? phone.data : null }));
