// Forage, crafting, museum and shop evidence (specs/polish/forage-craft-museum.md): what the demo member
// (?collections=demo, signed out) finds at each village node this real hour, as the server rolls it
// (lib/collections/rolls.ts nodeRoll, clear weather), and where the scenes stand. shoot.mjs runs it:
//   npx vite-node -c web/vitest.config.ts specs/evidence/polish-forage/nodes.ts [iso time]
import { villageNodes, villageBottleSpot } from "@/lib/game/islandNodes";
import { nodeRoll } from "@/lib/collections/rolls";
import { objectsOf } from "@/lib/game/villageMap";
import { landmark, landmarkPoint } from "@/lib/game/defaultIsland";
import { FRUIT_MODEL } from "@/lib/game/treeFruit";
import { SPECIES as CRITTERS } from "@/components/game/Critters";
import { torontoDay } from "@/lib/wallet/rules";
import { ROSTER } from "@/lib/collections/roster";
import { villageIsland } from "@/lib/game/defaultIsland";
import { glideSpot } from "@/lib/game/glideGuide";

const ME = "00000000-0000-4000-8000-000000000001";
const now = new Date(process.argv[2] ?? Date.now());
const MODELLED = new Set(CRITTERS.map(c => c.key));
const { forage, bugs } = villageNodes();
const rolled = forage.map(n => ({ n, sp: nodeRoll(ME, n, now, "clear") })).filter(e => e.sp);
/** Each kind of reward card, as its event (lib/game/reward.ts): the detail VillageLife, the workbench and the bottle send. */
const got = (key: string, kind: string, size: number | null, isNew = false) => {
  const sp = ROSTER.find(r => r.key === key)!;
  return { type: "tsi:peaceful-got", detail: { key, name: sp.name, rarity: sp.rarity, one_liner: sp.oneLiner, size, isNew, kind } };
};
const buriedKey = ROSTER.find(r => r.tool === "shovel" && r.category !== "mineral")!.key;
const cards = [
  ["bug", got("bug_common_butterfly", "bug", 7.2, true)],
  ["bug-rare", got("bug_emperor_butterfly", "bug", 11.4)],
  ["forage", got("apple", "forage", null)],
  ["dig", got(buriedKey, "dig", 4.1, true)],
  ["craft", { type: "tsi:crafted", detail: { id: "furn-floor-lamp", name: "Floor lamp", kind: "furniture" } }],
  ["glider", { type: "tsi:crafted", detail: { id: "glider-leaf", name: "Leaf glider", kind: "item" } }],
  ["bottle", { type: "tsi:recipe-learned", detail: { id: "rod-glass", name: "Glass rod" } }],
];
/** A ledge for the guided first glide that runs off toward +z (the follow camera looks that way): where to stand, and its spot. */
const island = villageIsland();
let glide: { stand: [number, number]; spot: ReturnType<typeof glideSpot> } | null = null;
for (let z = -30; z <= 30 && !glide; z += 1) for (let x = -30; x <= 30 && !glide; x += 1) {
  const spot = glideSpot(island.map, x, z);
  if (spot && spot.dir[1] === 1 && Math.hypot(spot.edge[0] - x, spot.edge[1] - z) < 3 && z < spot.edge[1] - 1.5) glide = { stand: [x, z], spot };
}
const pick = (f: (e: (typeof rolled)[number]) => boolean) => rolled.filter(f).map(({ n, sp }) => ({ id: n.id, x: n.x, z: n.z, key: sp!.key, tool: sp!.tool, rarity: sp!.rarity, tree: n.tree ?? null }));
console.log(JSON.stringify({
  now: now.toISOString(),
  fruit: pick(e => !!e.n.canopy && e.sp!.category === "fruit" && !!FRUIT_MODEL[e.sp!.key]),
  branches: pick(e => e.sp!.key === "wood_branch"),
  rocks: pick(e => e.sp!.category === "mineral" && e.sp!.key !== "wood_branch"),
  flowers: pick(e => e.sp!.sub === "flower"),
  shells: pick(e => e.sp!.sub === "shell" && e.sp!.tool === "hand"),
  buried: pick(e => e.sp!.tool === "shovel" && e.sp!.category !== "mineral"),
  ground: pick(e => !e.n.canopy && e.sp!.category === "fruit"),
  bugs: bugs.map(n => ({ n, sp: nodeRoll(ME, { ...n, bug: true }, now, "clear") })).filter(e => e.sp && MODELLED.has(e.sp.key))
    .map(({ n, sp }) => ({ id: n.id, x: n.x, z: n.z, key: sp!.key, rarity: sp!.rarity })),
  puddles: objectsOf("puddle").map(({ x, z }) => ({ x, z })),
  bushes: objectsOf("bush").map(({ x, z }) => ({ x, z })).slice(0, 6),
  bottle: villageBottleSpot(torontoDay(now)),
  shop: landmark("shop"),
  hqDoor: landmarkPoint("hq", "door"),
  museum: landmark("museum"),
  cards,
  glide,
}));
