import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOOK, FREE_HAIR_COLOURS, PALETTE, PARTS, STARTER_PARTS, randomLook, seeded, wear } from "@/lib/game/character/look";
import { CATALOGUE as PIECES, EVENT_PIECE_IDS } from "@/lib/homes/catalogue";
import { CRAFTED_ITEMS, RECIPES } from "@/lib/crafting/recipes";
import { defaultLayout, type HomeLayoutDoc } from "@/lib/homes/layout";
import { memoryHomesStore } from "@/lib/homes-sync/memoryStore";
import { CATALOGUE, EVENT_ITEMS, OWNERSHIP_ITEMS, STARTER_REFS } from "./catalogue";
import { memoryEconomyStore } from "./memoryStore";
import { seedItems } from "./rules";
import { eventItemsSeedSql, ownershipSeedSql } from "./seed";
import { buy, getInventory, ownedRefs } from "./service";

const A = "00000000-0000-4000-8000-0000000000aa";
const noon = new Date("2026-09-24T16:00:00Z");
const mock = vi.hoisted(() => ({ eco: null as unknown, ctx: null as unknown, userWrites: [] as unknown[], adminWrites: [] as unknown[] }));
vi.mock("@/lib/wallet/supabaseStore", () => ({ supabaseEconomyStore: () => mock.eco }));
vi.mock("@/lib/server/memberContext", async (original) => ({ ...(await original<typeof import("@/lib/server/memberContext")>()), withStore: async () => mock.ctx }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: A } } }) },
    from: () => ({ update: (u: unknown) => ({ eq: async () => (mock.userWrites.push(u), { error: null }) }) }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (u: unknown) => ({ eq: async () => (mock.adminWrites.push(u), { error: null }) }),
      select: () => ({ eq: () => ({ single: async () => ({ data: { id: A }, error: null }) }) }),
    }),
  }),
}));

import { PATCH as patchProfile } from "../../app/api/profile/route";
import { PUT as putLayout } from "../../app/api/homes/layout/route";

let eco: ReturnType<typeof memoryEconomyStore>;
let homes: ReturnType<typeof memoryHomesStore>;
const slug = (s: string) => eco.items.find((i) => i.slug === s)!.id;
const saveLook = (look: unknown) => patchProfile(new Request("http://x/api/profile", { method: "PATCH", body: JSON.stringify({ avatar_config: { look } }) }));
let saves = 0;
const saveLayout = (layout: HomeLayoutDoc, base_revision = 0) =>
  putLayout(new Request("http://x/api/homes/layout", { method: "PUT", body: JSON.stringify({ layout, base_revision, save_key: `save-key-${++saves}` }) }));
const withPiece = (doc: HomeLayoutDoc, piece: string, cell: [number, number]): HomeLayoutDoc =>
  ({ ...doc, rooms: [{ ...doc.rooms[0], items: [...doc.rooms[0].items, { uid: `${piece}-${cell}`, piece, cell, rot: 0 }] }] });

beforeEach(() => {
  eco = memoryEconomyStore(() => noon);
  homes = memoryHomesStore();
  mock.eco = eco.store;
  mock.ctx = { userId: A, tier: 4, now: noon, store: { homes: homes.store, economy: eco.store } };
  mock.userWrites.length = 0;
  mock.adminWrites.length = 0;
});

describe("ownership catalogue", () => {
  it("sells every wearable part, the six dyes and every homes piece; starter clothes are only granted", () => {
    const items = seedItems();
    const byRef = (ref: string) => items.filter((i) => i.catalogue_ref === ref);
    for (const p of PARTS.filter((x) => x.slot !== "bangs" && x.slot !== "back" && !x.variantOf)) {
      if (p.item) { // crafted wearables: owning the crafted item unlocks the part; never sold as a wear- row
        expect([...CATALOGUE, ...CRAFTED_ITEMS].filter((c) => c.catalogue_ref === p.id).map((c) => c.slug), p.id).toEqual([p.item]);
        expect(byRef(p.id).filter((i) => i.active), p.id).toHaveLength(0);
        continue;
      }
      expect(byRef(p.id), p.id).toHaveLength(1);
      expect(byRef(p.id)[0].active, p.id).toBe(!STARTER_PARTS.includes(p.id));
    }
    // every crafted outfit or accessory has a wearable part
    const crafted = [...CATALOGUE, ...CRAFTED_ITEMS].filter((c) => (c.category === "outfit" || c.category === "accessory") && RECIPES.some((r) => r.output.key === c.slug));
    expect(crafted.map((c) => c.slug).sort()).toEqual(PARTS.flatMap((p) => p.item ?? []).sort());
    for (let h = FREE_HAIR_COLOURS; h < PALETTE.hair.length; h++) expect(byRef(`hair:${h}`)[0]?.active, `dye ${h}`).toBe(true);
    expect(items.filter((i) => i.category === "hair" && i.active)).toHaveLength(6);
    // Seasonal event furniture is only given by its event, never sold.
    for (const p of PIECES) expect(byRef(p.id).filter((i) => i.category === "furniture" && i.active), p.id).toHaveLength(EVENT_PIECE_IDS.has(p.id) ? 0 : 1);
    expect(EVENT_ITEMS.map((c) => c.catalogue_ref).sort()).toEqual([...EVENT_PIECE_IDS].sort());
    for (const ref of STARTER_REFS.keys()) expect(byRef(ref), ref).toHaveLength(1);
    expect([...STARTER_REFS.values()].filter((_, i) => i >= STARTER_PARTS.length).reduce((a, b) => a + b, 0)).toBe(14); // 4 home pieces + the 10-piece pack
  });
  it("is mirrored in 20260926180000_ownership.sql and never reads as money", () => {
    expect(readFileSync(join(__dirname, "../../supabase/migrations/20260926180000_ownership.sql"), "utf8")).toContain(ownershipSeedSql());
    expect(readFileSync(join(__dirname, "../../supabase/migrations/20260929120000_seasonal_events.sql"), "utf8")).toContain(eventItemsSeedSql());
    expect(JSON.stringify([...CATALOGUE, ...OWNERSHIP_ITEMS, ...EVENT_ITEMS])).not.toMatch(/\$|CAD|dollar|USD|≈/i);
  });
  it("the creator's random look uses only starters and free colours", () => {
    const starters = new Set(STARTER_PARTS);
    for (let i = 0; i < 100; i++) {
      const look = randomLook(seeded(i), starters);
      expect(look.hair).toBeLessThan(FREE_HAIR_COLOURS);
      for (const id of [look.top, look.bottom, look.onepiece, look.shoes, ...Object.values(look.acc)]) if (id) expect(starters.has(id.replace(/_hood$/, "")), id).toBe(true);
    }
  });
});

describe("free starters", () => {
  it("are granted exactly once per account under retries", async () => {
    const results = await Promise.all([getInventory(eco.store, A), getInventory(eco.store, A), ownedRefs(eco.store, A), eco.store.grantStarters(A)]);
    expect(results.every((r) => !("ok" in r) || r.ok)).toBe(true);
    const owned = await ownedRefs(eco.store, A);
    expect(owned.ok && owned.data).toEqual(new Map(STARTER_REFS));
    expect(await eco.store.grantStarters(A)).toEqual({ granted: false });
    // A bought lamp adds to the starter one; a later grant call never tops it up.
    eco.fund(A, 1000);
    await buy(eco.store, A, { item_id: slug("furn-floor-lamp"), qty: 1, idempotency_key: "buy-lamp-1" }, noon);
    await getInventory(eco.store, A);
    const after = await ownedRefs(eco.store, A);
    expect(after.ok && after.data.get("floor-lamp")).toBe(2);
  });
});

describe("look save (PATCH /api/profile)", () => {
  it("refuses a part or dye the member doesn't own, server-side", async () => {
    const cardigan = await saveLook(wear(DEFAULT_LOOK, "top", "top_cardigan"));
    expect(cardigan.status).toBe(403);
    expect(await cardigan.json()).toMatchObject({ code: "not_owned", missing: ["top_cardigan"] });
    const dyed = await saveLook({ ...DEFAULT_LOOK, hair: 10 });
    expect(await dyed.json()).toMatchObject({ code: "not_owned", missing: ["hair:10"] });
    expect(mock.adminWrites).toEqual([]);
    expect(mock.userWrites).toEqual([]);
  });
  it("saves starters and anything bought, as the server", async () => {
    expect((await saveLook(wear(DEFAULT_LOOK, "onepiece", "onepiece_raincape_hood"))).status).toBe(200);
    eco.fund(A, 1000);
    await buy(eco.store, A, { item_id: slug("wear-top-cardigan"), qty: 1, idempotency_key: "buy-card-1" }, noon);
    await buy(eco.store, A, { item_id: slug("dye-blossom-pink"), qty: 1, idempotency_key: "buy-dye-1" }, noon);
    expect((await saveLook({ ...wear(DEFAULT_LOOK, "top", "top_cardigan"), hair: 10 })).status).toBe(200);
    expect(mock.adminWrites).toHaveLength(2);
    expect(mock.adminWrites[1]).toMatchObject({ avatar_config: { look: { top: "top_cardigan", hair: 10 } } });
    expect(mock.userWrites.every((u) => !("avatar_config" in (u as object)))).toBe(true);
  });
});

describe("home save (PUT /api/homes/layout)", () => {
  it("refuses a piece, an extra copy or a finish the member doesn't own, server-side", async () => {
    expect((await saveLayout(defaultLayout())).status).toBe(200); // the starter room is granted
    const sofa = await saveLayout(withPiece(defaultLayout(), "lounge-sofa", [2, 1]), 1);
    expect(sofa.status).toBe(422);
    expect(await sofa.json()).toMatchObject({ code: "not_owned" });
    expect((await saveLayout(withPiece(defaultLayout(), "floor-lamp", [5, 2]), 1)).status).toBe(422); // one lamp owned, two placed
    expect((await saveLayout({ ...defaultLayout(), rooms: [{ ...defaultLayout().rooms[0], wallpaper: "brick00" }] }, 1)).status).toBe(422);
    expect((await homes.store.getHome(A)).revision).toBe(1);
  });
  it("accepts them once bought", async () => {
    eco.fund(A, 2000);
    await buy(eco.store, A, { item_id: slug("furn-lounge-sofa"), qty: 1, idempotency_key: "buy-sofa-1" }, noon);
    await buy(eco.store, A, { item_id: slug("wall-brick"), qty: 1, idempotency_key: "buy-brick-1" }, noon);
    const doc = withPiece(defaultLayout(), "lounge-sofa", [2, 1]);
    expect((await saveLayout({ ...doc, rooms: [{ ...doc.rooms[0], wallpaper: "brick00" }] })).status).toBe(200);
  });
});
