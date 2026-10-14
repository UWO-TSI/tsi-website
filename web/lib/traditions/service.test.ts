import { describe, expect, it } from "vitest";
import { DEFAULT_TRADITIONS } from "@/lib/content/traditions";
import { TREATS, treatFor } from "@/lib/collections/treats";
import { answersAtNight, knock, memoryTraditionsStore, tonight, type DoorResident } from "./service";

const ODILE: DoorResident = { slug: "curator", display_name: "Odile", schedule: { home: "museum", night: ["museum", "home"] } };
const BRAM: DoorResident = { slug: "wharf-keeper", display_name: "Bram", schedule: { night: ["wharf", "beach", "wharf"] } };
const PIM: DoorResident = { slug: "crafter", display_name: "Pim", schedule: { night: ["hq", "plaza", "home"] } };
const M = "00000000-0000-4000-8000-000000000001";
// Halloween night in Toronto: Oct 27, 9 p.m. EDT (sunset about 6:10 p.m.); the next night at 1 a.m. still counts as the 27th's.
const NIGHT = new Date("2026-10-28T01:00:00Z"), LATE = new Date("2026-10-28T05:00:00Z"), NEXT = new Date("2026-10-29T01:00:00Z");

describe("trick-or-treat (lib/traditions/service.ts)", () => {
  it("answers with a treat and a line, once per resident per night", async () => {
    const store = memoryTraditionsStore([ODILE, PIM]);
    const first = await knock(store, M, { resident: "curator" }, NIGHT);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data).toMatchObject({ resident: "curator", name: "Odile", night: "2026-10-27", count: 1 });
    expect(TREATS.map((t) => t.key)).toContain(first.data.item_key);
    expect(first.data.line.length).toBeGreaterThan(10);
    // Again tonight (even after midnight): refused, and nothing more in the bag.
    const again = await knock(store, M, { resident: "curator" }, LATE);
    expect(again).toMatchObject({ ok: false, code: "already_treated" });
    expect([...store.bag.values()].reduce((a, b) => a + b, 0)).toBe(1);
    // Another resident tonight, and Odile again tomorrow night: both answer.
    expect((await knock(store, M, { resident: "crafter" }, LATE)).ok).toBe(true);
    expect((await knock(store, M, { resident: "curator" }, NEXT)).ok).toBe(true);
    const t = await tonight(store, M, LATE);
    expect(t.ok && t.data).toMatchObject({ on: true, night: "2026-10-27" });
    expect(t.ok && t.data.treated.sort()).toEqual(["crafter", "curator"]);
  });

  it("only at night, only while a tradition has trick-or-treat on", async () => {
    const store = memoryTraditionsStore([ODILE]);
    expect(await knock(store, M, { resident: "curator" }, new Date("2026-10-27T17:00:00Z"))).toMatchObject({ ok: false, code: "not_night" });
    expect(await knock(store, M, { resident: "curator" }, new Date("2026-10-14T02:00:00Z"))).toMatchObject({ ok: false, code: "not_running" });
    const off = memoryTraditionsStore([ODILE], [{ ...DEFAULT_TRADITIONS[0], content: { pumpkins: true } }]);
    expect(await knock(off, M, { resident: "curator" }, NIGHT)).toMatchObject({ ok: false, code: "not_running" });
    const t = await tonight(store, M, new Date("2026-10-27T17:00:00Z"));
    expect(t.ok && t.data.on).toBe(false);
  });

  it("nobody answers a door they aren't home behind, or a resident who doesn't exist", async () => {
    const store = memoryTraditionsStore([ODILE, BRAM]);
    expect(answersAtNight(BRAM)).toBe(false);
    expect(answersAtNight({ schedule: {} })).toBe(true); // no night routine: home
    expect(await knock(store, M, { resident: "wharf-keeper" }, NIGHT)).toMatchObject({ ok: false, code: "nobody_home" });
    expect(await knock(store, M, { resident: "nobody" }, NIGHT)).toMatchObject({ ok: false, code: "nobody_home" });
    expect(await knock(store, M, { resident: "Not A Slug!" }, NIGHT)).toMatchObject({ ok: false, code: "invalid" });
  });

  it("a full bag says so, and the door can be knocked again once there's room", async () => {
    const store = memoryTraditionsStore([ODILE], undefined, 0);
    expect(await knock(store, M, { resident: "curator" }, NIGHT)).toMatchObject({ ok: false, code: "bag_full" });
    const t = await tonight(store, M, NIGHT);
    expect(t.ok && t.data.treated).toEqual([]);
  });

  it("the treat is the same however often it's asked: by member, resident and night", () => {
    expect(treatFor(M, "curator", "2026-10-27")).toBe(treatFor(M, "curator", "2026-10-27"));
    const all = new Set(Array.from({ length: 60 }, (_, i) => treatFor(`m${i}`, "curator", "2026-10-27").key));
    expect(all.size).toBe(3);
  });
});
