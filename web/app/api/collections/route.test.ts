/**
 * Server-authoritative catches (roadmap "Server-authoritative catch rolls"):
 * the client asks for a roll at a place; the server checks the place, rolls
 * species and size, and records only what it rolled.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { villageNodes } from "@/lib/game/islandNodes";
import { fishingSpot, villageWater } from "@/lib/game/fishingSpots";
import { isGroundAtWorld } from "@/lib/game/grid";
import { DEFAULT_GOALS, SEASONAL_GOALS } from "@/lib/progression/defaults";
import { memoryCraftingStore } from "@/lib/crafting/memoryStore";
import { RECIPE_DROPS, RECIPE_DROP_CHANCE } from "@/lib/crafting/recipes";
import { seededRandom } from "@/lib/game/weatherSystem";
import { MINING, ROSTER } from "@/lib/collections/roster";
import { BROKEN_SUDO } from "@/lib/collections/digLoot";
import { fishRoll } from "@/lib/collections/rolls";
import { village } from "@/lib/game/villageMap";

const mock = vi.hoisted(() => ({ ctx: null as unknown, weather: "clear", goals: [] as unknown[], friends: [] as unknown[] }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  withStore: async () => mock.ctx,
}));
vi.mock("@/lib/server/weather", () => ({ islandWeatherNow: async () => mock.weather }));
// The roll itself, watched: which rod tier the server rolls a cast with (the held one, specs/game-ui.md).
vi.mock("@/lib/collections/rolls", async (original) => {
  const real = await original<typeof import("@/lib/collections/rolls")>();
  return { ...real, fishRoll: vi.fn(real.fishRoll) };
});
// The club goals carry the seasonal events (20260929120000); none unless a test sets them.
vi.mock("@/lib/progression/supabaseStore", () => ({ supabaseProgressionStore: () => ({ listGoals: async () => mock.goals }) }));

// Fishing together: the caller's friends (world_friends), none unless a test sets them.
vi.mock("@/lib/world/friendsSupabase", () => ({ supabaseFriendStore: () => ({ friends: async () => mock.friends }) }));

import { POST } from "./route";

const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
let clock: Date;
let m: ReturnType<typeof memoryCollectionsStore>;
const as = (userId: string) => (mock.ctx = { userId, tier: 4, now: clock, db: null, store: m.store });
const post = async (body: unknown) => {
  (mock.ctx as { now: Date }).now = clock;
  const res = await POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const later = (ms: number) => (clock = new Date(clock.getTime() + ms));

// A shore point with water in casting reach, and one in the middle of the land with none, on the island the server
// checks (the new world's cell view, lib/game/villageMap.ts village()).
const v = village();
const classify = villageWater(v).classify;
const cells = Array.from({ length: v.map.width * v.map.depth }, (_, i) => [v.map.originX + (i % v.map.width) + 0.5, v.map.originZ + Math.floor(i / v.map.width) + 0.5] as [number, number]);
const SHORE = cells.find(([x, z]) => fishingSpot(v.map, classify, x, z))!;
const INLAND = cells.find(([x, z]) => isGroundAtWorld(v.map, x, z) && !fishingSpot(v.map, classify, x, z))!;
/** Everyone's tier-1 tools (lib/game/tools.ts), held for a cast, a bug or a dig. */
const ROD = "rod_flimsy", NET = "net-basic", SHOVEL = "shovel-basic", PICK = "pickaxe-basic";
/** Rocks take Mayor Eliza's pickaxe once mining is out (the cave update, MINING); until then the shovel, as always. */
const ROCK_TOOL = MINING ? PICK : SHOVEL;
const nodes = villageNodes(v);
const node = (prefix: string) => [...nodes.forage, ...nodes.bugs].find((n) => n.id.startsWith(prefix))!;

beforeEach(() => {
  clock = new Date("2026-09-24T16:00:00Z"); // noon in Toronto
  m = memoryCollectionsStore(() => clock);
  mock.weather = "clear";
  mock.goals = [];
  mock.friends = [];
  as(A);
  // Mayor Eliza's pickaxe is nobody's starter (m6): A has been given it.
  m.own(A, [PICK]);
});

describe("POST /api/collections: the server rolls every catch", () => {
  it("has the fixtures it needs", () => {
    expect(SHORE).toBeDefined();
    expect(INLAND).toBeDefined();
    // Every world has rocks to strike and shells to dig (the shovel's quest, lib/game/arrival/hq/teachers.ts); only the
    // new world has things buried in the sand and the dirt (m3).
    for (const prefix of ["rock-", "shell-", "mush-", "bug-flower-"]) expect(node(prefix), prefix).toBeDefined();
    for (const prefix of ["dig-sand-", "dig-soil-"]) expect(!!nodes.forage.find((n) => n.id.startsWith(prefix)), prefix).toBe(true);
  });

  it("refuses a client-reported species and size", async () => {
    expect((await post({ item_key: "fish_golden_koi", size_cm: 95 })).status).toBe(400);
    expect(await m.store.memberItems(A)).toEqual([]);
  });

  it("records what it rolled at the cast, not what the client says it landed", async () => {
    const cast = await post({ action: "cast", site: "village", at: SHORE, power: 1, tool: ROD, item_key: "fish_golden_koi", size_cm: 999 });
    expect(cast.status).toBe(200);
    const { roll, item_key, size_cm } = cast.body.catch;
    expect(typeof roll).toBe("string");
    later(4000);
    const land = await post({ action: "land", roll, item_key: "fish_golden_koi", size_cm: 999 });
    expect(land.status).toBe(200);
    expect(land.body.catch).toMatchObject({ item_key, count: 1 });
    const mine = await m.store.memberItems(A);
    expect(mine.map((r) => r.item_key)).toEqual([item_key]);
    expect(mine[0].best_size_cm === null || mine[0].best_size_cm === size_cm).toBe(true);
    expect(item_key).not.toBe("fish_golden_koi"); // tier 1 rod: no legendaries
  });

  it("lands a roll once, only its own member's, only the latest cast", async () => {
    const first = (await post({ action: "cast", site: "village", at: SHORE, power: 0.5, tool: ROD })).body.catch.roll;
    later(5000);
    const second = (await post({ action: "cast", site: "village", at: SHORE, power: 0.5, tool: ROD })).body.catch.roll;
    later(4000);
    expect((await post({ action: "land", roll: first })).status).toBe(410);
    as(B);
    expect((await post({ action: "land", roll: second })).status).toBe(404);
    as(A);
    expect((await post({ action: "land", roll: second })).status).toBe(200);
    expect((await post({ action: "land", roll: second })).status).toBe(409);
  });

  it("refuses the wrong place", async () => {
    expect((await post({ action: "cast", site: "village", at: INLAND, power: 1, tool: ROD })).status).toBe(422);
    expect((await post({ action: "harvest", node: "no-such-node", at: [0, 0] })).status).toBe(422);
    const rock = node("rock-");
    expect((await post({ action: "harvest", node: rock.id, at: [rock.x + 20, rock.z], tool: ROCK_TOOL })).status).toBe(422);
    expect((await post({ action: "harvest", node: rock.id, at: [rock.x + 1, rock.z], tool: ROCK_TOOL })).status).toBe(200);
  });

  it("refuses the wrong season or time", async () => {
    const mush = node("mush-");
    clock = new Date("2026-06-15T16:00:00Z"); // June: no mushrooms
    expect((await post({ action: "harvest", node: mush.id, at: [mush.x, mush.z] })).status).toBe(409);
    const bug = node("bug-flower-");
    clock = new Date("2026-01-15T17:00:00Z"); // January noon: no flower bugs out
    expect((await post({ action: "harvest", node: bug.id, at: [bug.x, bug.z], tool: NET })).status).toBe(409);
    clock = new Date("2026-01-16T03:00:00Z"); // 22:00: the night butterflies are
    expect((await post({ action: "harvest", node: bug.id, at: [bug.x, bug.z], tool: NET })).status).toBe(200);
  });

  // m3, David 2026-10-28: a dig rolls the server's loot (relics, coins, ore, a rare gem, a very rare broken sudo) with the held shovel's tier.
  it("a dig spot gives the server's loot: a shovel needed, once an hour, a purse into the wallet, every dig counted", async () => {
    const spot = node("dig-soil-");
    const at: [number, number] = [spot.x, spot.z];
    expect((await post({ action: "harvest", node: spot.id, at })).status).toBe(422); // no shovel in hand
    // The roll: 0 is the very rarest, the broken sudo; it lands in the bag like any find.
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const first = await post({ action: "harvest", node: spot.id, at, tool: SHOVEL });
    random.mockRestore();
    expect(first.status).toBe(200);
    expect(first.body.catch.item_key).toBe(BROKEN_SUDO);
    expect(m.countOf(A, BROKEN_SUDO)).toBe(1);
    expect((await post({ action: "harvest", node: spot.id, at, tool: SHOVEL })).status).toBe(409); // once an hour
    // A purse (0.99: past every other kind's odds): coins into the wallet, nothing into the bag.
    const sand = node("dig-sand-");
    const coins = vi.spyOn(Math, "random").mockReturnValue(0.99);
    const purse = await post({ action: "harvest", node: sand.id, at: [sand.x, sand.z], tool: SHOVEL });
    coins.mockRestore();
    expect(purse.status).toBe(200);
    expect(purse.body.catch.purse).toEqual({ currency: "coins", amount: 50 });
    expect(m.purseOf(A)).toEqual({ coins: 50, gems: 0, digs: 2 });
  });

  it("refuses too fast: casts 4 s apart, a reel of at least 3 s, one harvest per node per hour", async () => {
    const roll = (await post({ action: "cast", site: "village", at: SHORE, power: 1, tool: ROD })).body.catch.roll;
    later(1000);
    expect((await post({ action: "land", roll })).status).toBe(429);
    expect((await post({ action: "cast", site: "village", at: SHORE, power: 1, tool: ROD })).status).toBe(429);
    const rock = node("rock-");
    const at = [rock.x, rock.z];
    expect((await post({ action: "harvest", node: rock.id, at, tool: ROCK_TOOL })).status).toBe(200);
    expect((await post({ action: "harvest", node: rock.id, at, tool: ROCK_TOOL })).status).toBe(409);
    later(3_600_000);
    expect((await post({ action: "harvest", node: rock.id, at, tool: ROCK_TOOL })).status).toBe(200);
  });

  it("keeps the hourly caps (epic: 6 per species per hour)", async () => {
    for (let i = 0; i < 6; i++) await m.store.harvest(A, `n${i}`, "2026-09-24T12", "fish_golden_koi", 70, true);
    await expect(m.store.harvest(A, "n6", "2026-09-24T12", "fish_golden_koi", 70, true)).rejects.toMatchObject({ code: "rate_limited" });
    expect(m.countOf(A, "fish_golden_koi")).toBe(6);
    // The refused harvest didn't use up its node.
    later(3_600_000);
    await m.store.harvest(A, "n6", "2026-09-24T12", "fish_golden_koi", 70, true);
    expect(m.countOf(A, "fish_golden_koi")).toBe(7);
  });

  it("tells the catch card the size it records: every catch is a roster fish with a size (row 260)", async () => {
    const random = seededRandom(7);
    vi.spyOn(Math, "random").mockImplementation(random);
    for (let i = 0; i < 40; i++) {
      const { item_key, size_cm } = (await post({ action: "cast", site: "village", at: SHORE, power: 0.5, tool: ROD })).body.catch;
      const sp = ROSTER.find((r) => r.key === item_key);
      expect(sp?.size, item_key).toBeTruthy();
      expect(size_cm).toBeGreaterThanOrEqual(sp!.size![0]);
      expect(size_cm).toBeLessThanOrEqual(sp!.size![1]);
      later(5000);
    }
    vi.restoreAllMocks();
  });

  it("passes through signed-out", async () => {
    mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    expect((await POST(new Request("http://localhost/api", { method: "POST", body: "{}" }))).status).toBe(401);
  });
});

describe("POST /api/collections: seasonal events on the server's catches", () => {
  const fall = SEASONAL_GOALS[0];
  const entries = () => m.store.tourneyEntries(fall.id, 2026);
  beforeEach(() => {
    mock.goals = DEFAULT_GOALS;
    clock = new Date("2026-09-20T16:00:00Z"); // the fall tourney is on
  });
  afterEach(() => vi.restoreAllMocks());

  it("never lands a limited-time fish outside its window, even one rolled inside it", async () => {
    clock = new Date("2026-10-01T03:59:58Z"); // 23:59:58 on Sep 30 in Toronto
    const roll = await m.store.cast(A, "fish_yellow_perch", 25, true);
    later(5000); // the window closed at midnight
    const land = await post({ action: "land", roll });
    expect(land).toMatchObject({ status: 409, body: { code: "out_of_season" } });
    expect(await m.store.memberItems(A)).toEqual([]);
    expect(await entries()).toEqual([]);
    // With no club goals at all the limited-time fish stay shut too.
    mock.goals = [];
    later(60_000);
    const shut = await m.store.cast(A, "fish_sturgeon", 150, true);
    later(5000);
    expect((await post({ action: "land", roll: shut })).status).toBe(409);
  });

  it("enters exactly one tourney entry for a landed catch in the window, from the server's roll", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.02); // first species in the pool, near its smallest size
    const cast = await post({ action: "cast", site: "village", at: SHORE, power: 0.4, tool: ROD, item_key: "fish_sturgeon", size_cm: 200 });
    expect(cast.status).toBe(200);
    const { roll, item_key } = cast.body.catch;
    later(4000);
    const land = await post({ action: "land", roll });
    expect(land.status).toBe(200);
    expect(land.body.catch.item_key).toBe(item_key);
    const [entry, ...rest] = await entries();
    expect(rest).toEqual([]);
    expect(entry).toMatchObject({ member_id: A, item_key, size_cm: land.body.catch.size_cm });
    expect(entry.item_key).not.toBe("fish_sturgeon");
    expect((await post({ action: "land", roll })).status).toBe(409);
    expect(await entries()).toHaveLength(1);
  });

  it("still refuses a client-reported species during the tourney", async () => {
    expect((await post({ item_key: "fish_sturgeon", size_cm: 200 })).status).toBe(400);
    expect((await post({ action: "land", roll: crypto.randomUUID(), item_key: "fish_sturgeon", size_cm: 200 })).status).toBe(404);
    expect(await m.store.memberItems(A)).toEqual([]);
    expect(await entries()).toEqual([]);
  });
});

describe("POST /api/collections: rare catches can teach a recipe (rows 199, 258)", () => {
  // The drop's own dice (crafting_catch_drop's random()): 0 always drops, 0.999 never.
  let dice: () => number;
  let c: ReturnType<typeof memoryCraftingStore>;
  const TIERS = ["rare", "epic", "legendary"];
  const pool = (rarity: string) => Object.keys(RECIPE_DROPS).filter((id) => TIERS.indexOf(RECIPE_DROPS[id]) <= TIERS.indexOf(rarity));
  const byCatch = async (member = A) => (await c.store.learned(member)).filter((r) => r.source === "catch").map((r) => r.recipe_id);
  const fish = async (key: string) => {
    later(10_000);
    const roll = await m.store.cast(A, key, 50, true);
    later(5000);
    return post({ action: "land", roll });
  };
  beforeEach(() => {
    dice = () => 0;
    c = memoryCraftingStore(undefined, () => clock, () => dice());
    m = memoryCollectionsStore(() => clock, c.catchDrop);
    as(A);
    m.own(A, [PICK]);
  });

  it("never takes a recipe from the client", async () => {
    const forged = { recipe_id: "rod-tidewarden", recipe: { id: "rod-tidewarden" }, learn: "rod-tidewarden" };
    expect((await post({ action: "learn", ...forged })).status).toBe(400);
    const rock = node("rock-");
    const harvest = await post({ action: "harvest", node: rock.id, at: [rock.x, rock.z], tool: ROCK_TOOL, ...forged });
    expect(harvest.status).toBe(200);
    const land = await fish("fish_black_bass");
    const landed = await post({ action: "land", roll: crypto.randomUUID(), ...forged });
    expect(landed.status).toBe(404);
    // Whatever was taught is the server's pick from the drop pool, never the named quest recipe.
    const got = [harvest.body.catch.recipe, land.body.catch.recipe].filter(Boolean).map((r) => r.id);
    expect(got.length).toBeGreaterThan(0); // the black bass is rare: the dice always drop
    expect(await byCatch()).toEqual(got);
    for (const id of got) expect(Object.keys(RECIPE_DROPS)).toContain(id);
    expect(await byCatch()).not.toContain("rod-tidewarden");
  });

  it("teaches a rare catch a recipe with the catch, shown by name", async () => {
    const land = await fish("fish_black_bass");
    expect(land.status).toBe(200);
    const { recipe } = land.body.catch;
    expect(pool("rare")).toContain(recipe.id);
    expect(typeof recipe.name).toBe("string");
    expect(recipe.name).not.toBe(recipe.id);
    expect(await byCatch()).toEqual([recipe.id]);
  });

  it("never teaches from common or uncommon catches, or a quiet dice", async () => {
    expect((await fish("fish_dace")).body.catch.recipe).toBeNull();
    expect((await fish("fish_carp")).body.catch.recipe).toBeNull();
    dice = () => 0.999;
    expect((await fish("fish_black_bass")).body.catch.recipe).toBeNull();
    expect(await c.store.learned(A)).toEqual([]);
  });

  it("teaches each recipe once: a known recipe never drops again", async () => {
    const bottle = (await c.store.openBottle(A)).recipe_id;
    const got: (string | null)[] = [];
    for (let i = 0; i < pool("rare").length + 4; i++) {
      later(3_600_000); // a new hour: clear of the hourly caps
      got.push((await m.store.harvest(A, `n${i}`, `h${i}`, "bug_mantis", null, false)).recipe?.id ?? null);
    }
    const taught = got.filter((id): id is string => id !== null);
    expect(new Set(taught).size).toBe(taught.length);
    expect(new Set(taught)).toEqual(new Set(pool("rare").filter((id) => id !== bottle)));
    expect(got.slice(-4)).toEqual([null, null, null, null]); // the rare pool is spent
    expect(taught).not.toContain(bottle);
    // The epic-only recipes wait for an epic catch.
    const epic = (await m.store.harvest(A, "gold", "h-gold", "rock_gold_nugget", null, false)).recipe?.id;
    expect(pool("epic").filter((id) => !pool("rare").includes(id))).toContain(epic);
    expect((await c.store.learned(A)).filter((r) => r.recipe_id === epic)).toHaveLength(1);
  });

  it("records the drop with the catch: a refused land or harvest teaches nothing", async () => {
    // Too fast: the reel was under 3 s.
    later(10_000);
    const quick = await m.store.cast(A, "fish_black_bass", 40, true);
    later(1000);
    expect((await post({ action: "land", roll: quick })).status).toBe(429);
    // Out of season: a limited-time rare fish with its event shut.
    expect((await fish("fish_giant_trevally")).status).toBe(409);
    // Over the hourly cap: twelve rare mantises this hour on a quiet dice, then the dice would drop.
    dice = () => 0.999;
    for (let i = 0; i < 12; i++) await m.store.harvest(A, `cap${i}`, "h-cap", "bug_mantis", null, false);
    dice = () => 0;
    await expect(m.store.harvest(A, "cap12", "h-cap", "bug_mantis", null, false)).rejects.toMatchObject({ code: "rate_limited" });
    expect(await c.store.learned(A)).toEqual([]);
    // A landed one does.
    expect((await fish("fish_black_bass")).body.catch.recipe).toMatchObject({ id: expect.any(String) });
  });

  it("drops at the documented chance per rarity over many server rolls", () => {
    const random = seededRandom(258);
    c = memoryCraftingStore(undefined, () => clock, random);
    const N = 10_000;
    const close = (observed: number, p: number) => Math.abs(observed - p) <= 4 * Math.sqrt((p * (1 - p)) / N) + 0.002;
    for (const [key, rarity] of [["bug_mantis", "rare"], ["rock_gold_nugget", "epic"], ["fish_golden_koi", "epic"]] as const) {
      let hits = 0;
      for (let i = 0; i < N; i++) if (c.catchDrop(`${rarity}-${i}`, key)) hits++;
      expect(close(hits / N, RECIPE_DROP_CHANCE[rarity]), `${rarity}: ${hits}/${N}`).toBe(true);
    }
    for (const key of ["fish_dace", "fish_carp", "wood_branch", "no_such_species"]) {
      expect(Array.from({ length: 2000 }, (_, i) => c.catchDrop(`plain-${i}`, key)).filter(Boolean)).toEqual([]);
    }
  }, 30_000); // 38k seeded rolls: ~3 s alone, past the 5 s default when other agents load the machine
});

describe("POST /api/collections: the held tool (row 279, specs/game-ui.md)", () => {
  const rolledTier = () => vi.mocked(fishRoll).mock.calls.at(-1)![2].tier;
  const cast = (tool?: unknown) => post({ action: "cast", site: "village", at: SHORE, power: 0.5, ...(tool === undefined ? {} : { tool }) });

  it("casts only with a rod in hand", async () => {
    expect(await cast()).toMatchObject({ status: 422, body: { code: "no_tool" } });
    expect(await cast(NET)).toMatchObject({ status: 422, body: { code: "wrong_tool" } });
    expect(await cast("rod_made_up")).toMatchObject({ status: 422, body: { code: "wrong_tool" } });
    expect((await cast(ROD)).status).toBe(200);
  });

  it("refuses a rod the member doesn't own", async () => {
    expect(await cast("rod_tidewarden")).toMatchObject({ status: 403, body: { code: "tool_not_owned" } });
    m.own(A, ["rod_tidewarden"]);
    expect((await cast("rod_tidewarden")).status).toBe(200);
  });

  it("rolls with the held rod's tier, not the best one owned", async () => {
    m.own(A, ["rod_glass", "rod_tidewarden"]);
    expect((await cast("rod_glass")).status).toBe(200);
    expect(rolledTier()).toBe(3);
    later(5000);
    expect((await cast(ROD)).status).toBe(200);
    expect(rolledTier()).toBe(1);
    later(5000);
    expect((await cast("rod_tidewarden")).status).toBe(200);
    expect(rolledTier()).toBe(5);
  });

  it("nets a bug only with a net the member owns", async () => {
    const bug = node("bug-flower-"), at = [bug.x, bug.z];
    clock = new Date("2026-01-16T03:00:00Z"); // 22:00: the night butterflies are out
    expect(await post({ action: "harvest", node: bug.id, at })).toMatchObject({ status: 422, body: { code: "no_tool" } });
    expect(await post({ action: "harvest", node: bug.id, at, tool: SHOVEL })).toMatchObject({ status: 422, body: { code: "wrong_tool" } });
    expect(await post({ action: "harvest", node: bug.id, at, tool: "net-emperor" })).toMatchObject({ status: 403, body: { code: "tool_not_owned" } });
    expect(await m.store.memberItems(A)).toEqual([]);
    m.own(A, ["net-emperor"]);
    expect((await post({ action: "harvest", node: bug.id, at, tool: "net-emperor" })).status).toBe(200);
  });

  it("rocks take the shovel while mining is parked, digs only a shovel; picking by hand needs none", async () => {
    const rock = node("rock-"), at = [rock.x, rock.z];
    expect(await post({ action: "harvest", node: rock.id, at })).toMatchObject({ status: 422, body: { code: "no_tool" } });
    // Mayor Eliza's pickaxe is the cave update's (David 2026-10-28): until then a rock is struck with the shovel, as before.
    expect(MINING).toBe(false);
    expect(await post({ action: "harvest", node: rock.id, at, tool: PICK })).toMatchObject({ status: 422, body: { code: "wrong_tool" } });
    expect((await post({ action: "harvest", node: rock.id, at, tool: SHOVEL })).status).toBe(200);
    const spot = node("dig-soil-"), there = [spot.x, spot.z];
    expect(await post({ action: "harvest", node: spot.id, at: there, tool: PICK })).toMatchObject({ status: 422, body: { code: "wrong_tool" } });
    expect(await post({ action: "harvest", node: spot.id, at: there, tool: "shovel-gold" })).toMatchObject({ status: 403, body: { code: "tool_not_owned" } });
    // A relic roll (0.3: past the sudo, gem and ore odds, inside the relics'): one of the dirt's finds.
    const relic = vi.spyOn(Math, "random").mockReturnValue(0.3);
    const dug = await post({ action: "harvest", node: spot.id, at: there, tool: SHOVEL });
    relic.mockRestore();
    expect(dug.status).toBe(200);
    expect(ROSTER.find((x) => x.key === dug.body.catch.item_key)?.biome).toBe("dig_soil");
    // A mushroom is picked by hand: whatever is held (or nothing), the tool never refuses it.
    const mush = node("mush-");
    for (const tool of [undefined, ROD, "shovel-gold"]) {
      const res = await post({ action: "harvest", node: mush.id, at: [mush.x, mush.z], ...(tool ? { tool } : {}) });
      expect(["no_tool", "wrong_tool", "tool_not_owned"]).not.toContain(res.body.code);
    }
  });
});

describe("POST /api/collections: tools come from people after the tour (row 312, specs/hq-onboarding.md)", () => {
  // What the shovel digs: the new world's buried things, the village's rocks.
  const bug = () => node("bug-flower-"), spot = () => node("dig-sand-");
  const net = () => post({ action: "harvest", node: bug().id, at: [bug().x, bug().z], tool: NET });
  const dig = () => post({ action: "harvest", node: spot().id, at: [spot().x, spot().z], tool: SHOVEL });
  beforeEach(() => { clock = new Date("2026-01-16T03:00:00Z"); }); // 22:00: the night butterflies are out

  it("refuses a new arrival's starter net and shovel until a resident has handed them over", async () => {
    m.teach(A);
    expect(await net()).toMatchObject({ status: 403, body: { code: "tool_not_owned" } });
    expect(await dig()).toMatchObject({ status: 403, body: { code: "tool_not_owned" } });
    expect(await m.store.memberItems(A)).toEqual([]);
    // Odile's net (lib/game/arrival/hq/grant.ts puts it in the inventory): now it nets; the shovel still waits for Pim.
    m.own(A, ["net-basic"]);
    expect((await net()).status).toBe(200);
    expect(await dig()).toMatchObject({ status: 403, body: { code: "tool_not_owned" } });
    m.own(A, ["net-basic", "shovel-basic"]);
    expect((await dig()).status).toBe(200);
  });

  it("lets existing players keep the tools they already had", async () => {
    // B arrived before row 312 (or never arrived): the starters are theirs, as they always were.
    as(B);
    expect((await net()).status).toBe(200);
    expect((await dig()).status).toBe(200);
    // A new arrival who owns a better tier outright has it whatever the rule.
    as(A); m.teach(A); m.own(A, ["net-mid"]);
    later(3_600_000);
    expect((await post({ action: "harvest", node: bug().id, at: [bug().x, bug().z], tool: "net-mid" })).status).toBe(200);
  });

  it("never gates the rod: Bram's rod is everyone's", async () => {
    m.teach(A);
    expect((await post({ action: "cast", site: "village", at: SHORE, power: 1, tool: ROD })).status).toBe(200);
  });
});

describe("POST /api/collections: a full backpack refuses the pickup (rows 279–283, specs/game-ui.md §5)", () => {
  // Exactly twenty slots: nineteen fish (a slot each) and a partial stack of 29 branches.
  const FISH19 = ROSTER.filter((s) => s.category === "fish").slice(0, 19).map((s) => s.key);
  const fill = (member = A) => { m.give(member, "wood_branch", 29); FISH19.forEach((k) => m.give(member, k, 1)); };
  const harvest = (prefix: string, tool?: string) => { const n = node(prefix); return post({ action: "harvest", node: n.id, at: [n.x, n.z], ...(tool ? { tool } : {}) }); };
  const cast = () => post({ action: "cast", site: "village", at: SHORE, power: 0.5, tool: ROD });

  it("refuses a harvest that needs a new slot, and leaves it in the world for later", async () => {
    fill();
    expect(await harvest("rock-", ROCK_TOOL)).toMatchObject({ status: 409, body: { code: "bag_full", error: "Your backpack is full." } });
    expect(m.countOf(A, "wood_branch")).toBe(29);
    expect((await m.store.memberItems(A)).length).toBe(20);
    // Room again (one fish fewer): the same rock, the same hour, is still there to strike.
    m.give(A, FISH19[0], -1);
    expect((await harvest("rock-", ROCK_TOOL)).status).toBe(200);
  });

  it("still tops up a partial stack at a full bag, but not past it", async () => {
    fill();
    expect((await harvest("branch-")).status).toBe(200); // the 30th branch fills its stack
    expect(m.countOf(A, "wood_branch")).toBe(30);
    later(3_600_000);
    expect(await harvest("branch-")).toMatchObject({ status: 409, body: { code: "bag_full" } }); // the 31st needs a slot
    expect(m.countOf(A, "wood_branch")).toBe(30);
  });

  it("refuses a cast with no slot for a fish, and a land if the bag filled since the cast; the roll waits for room", async () => {
    fill();
    expect(await cast()).toMatchObject({ status: 409, body: { code: "bag_full" } });
    m.give(A, FISH19[0], -1);
    const roll = (await cast()).body.catch.roll;
    m.give(A, "apple", 1); // something else took the last slot while the line was out
    later(4000);
    expect(await post({ action: "land", roll })).toMatchObject({ status: 409, body: { code: "bag_full" } });
    m.give(A, "apple", -1);
    expect((await post({ action: "land", roll })).status).toBe(200);
  });

  it("keeps everything a member already over capacity has, and they pick nothing up until they're back under", async () => {
    fill();
    m.give(A, "apple", 4); m.give(A, "bug_mantis", 1); m.give(A, "bug_firefly", 1); // 23 slots in a 20-slot bag
    const before = await m.store.memberItems(A);
    expect(await harvest("branch-")).toMatchObject({ status: 409, body: { code: "bag_full" } }); // not even the branches' partial stack
    await expect(m.store.harvest(A, "n1", "h1", "apple", null, false)).rejects.toMatchObject({ code: "bag_full" });
    expect(await m.store.memberItems(A)).toEqual(before);
    m.give(A, "bug_mantis", -1); m.give(A, "bug_firefly", -1); m.give(A, "apple", -4); // full again, not over
    expect((await harvest("branch-")).status).toBe(200);
  });

  it("takes more once the member owns a bigger pocket", async () => {
    fill();
    m.own(A, ["bag:30", PICK]);
    expect((await harvest("rock-", ROCK_TOOL)).status).toBe(200);
    expect((await cast()).status).toBe(200);
  });
});

describe("fishing together (s-fishtogether)", () => {
  it("rolls a cast with a friend nearby a little luckier and names them for the card; a stranger gets nothing", async () => {
    const { fishRoll: watched } = await import("@/lib/collections/rolls");
    mock.friends = [{ member_id: B, world_name: "Mika", since: "2026-10-01" }];
    const together = await post({ action: "cast", site: "village", at: SHORE, power: 0.5, tool: ROD, with: B });
    expect(together.body.catch.together).toBe("Mika");
    expect(vi.mocked(watched).mock.calls.at(-1)?.[8]).toBe(true);
    later(60_000);
    mock.friends = [];
    const alone = await post({ action: "cast", site: "village", at: SHORE, power: 0.5, tool: ROD, with: B });
    expect(alone.body.catch.together).toBeNull();
    expect(vi.mocked(watched).mock.calls.at(-1)?.[8]).toBe(false);
  });
});
