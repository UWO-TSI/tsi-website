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
import { village } from "@/lib/game/villageMap";
import { isGroundAtWorld } from "@/lib/game/grid";
import { DEFAULT_GOALS, SEASONAL_GOALS } from "@/lib/progression/defaults";

const mock = vi.hoisted(() => ({ ctx: null as unknown, weather: "clear", goals: [] as unknown[] }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  withStore: async () => mock.ctx,
}));
vi.mock("@/lib/server/weather", () => ({ islandWeatherNow: async () => mock.weather }));
// The club goals carry the seasonal events (20260929120000); none unless a test sets them.
vi.mock("@/lib/progression/supabaseStore", () => ({ supabaseProgressionStore: () => ({ listGoals: async () => mock.goals }) }));

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

// A shore point with water in casting reach, and one in the middle of the land with none.
const v = village();
const classify = villageWater(v).classify;
const cells = Array.from({ length: v.map.width * v.map.depth }, (_, i) => [v.map.originX + (i % v.map.width) + 0.5, v.map.originZ + Math.floor(i / v.map.width) + 0.5] as [number, number]);
const SHORE = cells.find(([x, z]) => fishingSpot(v.map, classify, x, z))!;
const INLAND = cells.find(([x, z]) => isGroundAtWorld(v.map, x, z) && !fishingSpot(v.map, classify, x, z))!;
const node = (prefix: string) => [...villageNodes().forage, ...villageNodes().bugs].find((n) => n.id.startsWith(prefix))!;

beforeEach(() => {
  clock = new Date("2026-09-24T16:00:00Z"); // noon in Toronto
  m = memoryCollectionsStore(() => clock);
  mock.weather = "clear";
  mock.goals = [];
  as(A);
});

describe("POST /api/collections: the server rolls every catch", () => {
  it("has the fixtures it needs", () => {
    expect(SHORE).toBeDefined();
    expect(INLAND).toBeDefined();
  });

  it("refuses a client-reported species and size", async () => {
    expect((await post({ item_key: "fish_golden_koi", size_cm: 95 })).status).toBe(400);
    expect(await m.store.memberItems(A)).toEqual([]);
  });

  it("records what it rolled at the cast, not what the client says it landed", async () => {
    const cast = await post({ action: "cast", site: "village", at: SHORE, power: 1, item_key: "fish_golden_koi", size_cm: 999 });
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
    const first = (await post({ action: "cast", site: "village", at: SHORE, power: 0.5 })).body.catch.roll;
    later(5000);
    const second = (await post({ action: "cast", site: "village", at: SHORE, power: 0.5 })).body.catch.roll;
    later(4000);
    expect((await post({ action: "land", roll: first })).status).toBe(410);
    as(B);
    expect((await post({ action: "land", roll: second })).status).toBe(404);
    as(A);
    expect((await post({ action: "land", roll: second })).status).toBe(200);
    expect((await post({ action: "land", roll: second })).status).toBe(409);
  });

  it("refuses the wrong place", async () => {
    expect((await post({ action: "cast", site: "village", at: INLAND, power: 1 })).status).toBe(422);
    expect((await post({ action: "harvest", node: "no-such-node", at: [0, 0] })).status).toBe(422);
    const rock = node("rock-");
    expect((await post({ action: "harvest", node: rock.id, at: [rock.x + 20, rock.z] })).status).toBe(422);
    expect((await post({ action: "harvest", node: rock.id, at: [rock.x + 1, rock.z] })).status).toBe(200);
  });

  it("refuses the wrong season or time", async () => {
    const mush = node("mush-");
    clock = new Date("2026-06-15T16:00:00Z"); // June: no mushrooms
    expect((await post({ action: "harvest", node: mush.id, at: [mush.x, mush.z] })).status).toBe(409);
    const bug = node("bug-flower-");
    clock = new Date("2026-01-15T17:00:00Z"); // January noon: no flower bugs out
    expect((await post({ action: "harvest", node: bug.id, at: [bug.x, bug.z] })).status).toBe(409);
    clock = new Date("2026-01-16T03:00:00Z"); // 22:00: the night butterflies are
    expect((await post({ action: "harvest", node: bug.id, at: [bug.x, bug.z] })).status).toBe(200);
  });

  it("refuses too fast: casts 4 s apart, a reel of at least 3 s, one harvest per node per hour", async () => {
    const roll = (await post({ action: "cast", site: "village", at: SHORE, power: 1 })).body.catch.roll;
    later(1000);
    expect((await post({ action: "land", roll })).status).toBe(429);
    expect((await post({ action: "cast", site: "village", at: SHORE, power: 1 })).status).toBe(429);
    const rock = node("rock-");
    const at = [rock.x, rock.z];
    expect((await post({ action: "harvest", node: rock.id, at })).status).toBe(200);
    expect((await post({ action: "harvest", node: rock.id, at })).status).toBe(409);
    later(3_600_000);
    expect((await post({ action: "harvest", node: rock.id, at })).status).toBe(200);
  });

  it("keeps the hourly caps (legendary: 3 per species per hour)", async () => {
    for (let i = 0; i < 3; i++) await m.store.harvest(A, `n${i}`, "2026-09-24T12", "fish_golden_koi", 70, true);
    await expect(m.store.harvest(A, "n3", "2026-09-24T12", "fish_golden_koi", 70, true)).rejects.toMatchObject({ code: "rate_limited" });
    expect(m.countOf(A, "fish_golden_koi")).toBe(3);
    // The refused harvest didn't use up its node.
    later(3_600_000);
    await m.store.harvest(A, "n3", "2026-09-24T12", "fish_golden_koi", 70, true);
    expect(m.countOf(A, "fish_golden_koi")).toBe(4);
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
    const cast = await post({ action: "cast", site: "village", at: SHORE, power: 0.4, item_key: "fish_sturgeon", size_cm: 200 });
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
