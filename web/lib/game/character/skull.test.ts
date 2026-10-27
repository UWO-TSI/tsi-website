import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SKULL, SKULL_ANCHORS, skullAnchor, type SkullAnchor } from "./skull";
import { PARTS } from "./look";

const web = join(__dirname, "../../..");

/** Head fit (specs/characters/head-fit.md): the shared skull's fit points, as exported by art/characters/skull/skull.py. */
describe("the shared skull", () => {
  it("is the synced copy of art/characters/skull/skull.json", () => {
    expect(readFileSync(join(web, "data/characters/skull.json"), "utf8")).toBe(readFileSync(join(web, "../art/characters/skull/skull.json"), "utf8"));
  });
  it("declares every fit point, each a finite position and a unit quaternion", () => {
    for (const name of SKULL_ANCHORS) {
      const a: SkullAnchor = skullAnchor(name);
      expect(a.p.every(Number.isFinite), name).toBe(true);
      expect(Math.hypot(...a.q), name).toBeCloseTo(1, 4);
    }
  });
  it("mirrors left and right fit points across the face's centre line", () => {
    for (const side of ["hairline", "temple", "ear", "eye"]) {
      const l = skullAnchor(`${side}_L`).p, r = skullAnchor(`${side}_R`).p;
      expect(l[0], side).toBeGreaterThan(0); // the character's left is +X
      expect(l[0]).toBeCloseTo(-r[0], 4);
      expect(l[1]).toBeCloseTo(r[1], 4);
      expect(l[2]).toBeCloseTo(r[2], 4);
    }
  });
  it("keeps the fit points in head order: top over crown over hairline over eyes over mouth, the nape low at the back", () => {
    const y = (n: string) => skullAnchor(n).p[1], z = (n: string) => skullAnchor(n).p[2];
    expect(y("top")).toBeGreaterThanOrEqual(y("crown"));   // v9: the crown sits on the classic head's flat top
    expect(y("crown")).toBeGreaterThan(y("hairline_C"));
    expect(y("hairline_C")).toBeGreaterThan(y("eye_L"));
    expect(y("eye_L")).toBeGreaterThan(y("mouth"));
    expect(y("mouth")).toBeGreaterThan(y("neck"));
    expect(y("nape")).toBeLessThan(y("ear_L"));
    expect(z("face_front")).toBeGreaterThan(0.15); // the face looks toward +Z (glTF)
    expect(z("crown")).toBeLessThan(0);
    expect(z("nape")).toBeLessThan(0);
  });
  it("puts the hat line above the brows in front and above the ear zone all round", () => {
    const hat = SKULL.lines.hatline, ear = SKULL.lines.ear;
    for (const [lon, lat] of hat) expect(lat, `lon ${lon}`).toBeGreaterThan(ear.top_lat);
    expect(skullAnchor("hat_C").p[1]).toBeGreaterThan(skullAnchor("eye_L").p[1]);
    expect(SKULL.lines.hairline.every(([, lat]) => lat > 0)).toBe(true);
  });
  it("lays the shells outward: hair undersides under the scalp, lock tops over the hair volume", () => {
    expect(SKULL.shells.inner).toBeLessThan(0);
    SKULL.shells.hair_outer.forEach(([lat, off], i) => expect(off, `lat ${lat}`).toBeGreaterThan(SKULL.shells.hair_vol[i][1]));
  });
  it("puts Roblox's HairAttachment on the classic head's top centre, over the crown (head-roblox, v9)", () => {
    const att = skullAnchor("hair_att"), top = skullAnchor("top");
    expect(att.p[1]).toBeCloseTo(top.p[1], 3);               // the classic head's flat top is our crown
    expect(Math.abs(att.p[0])).toBeLessThan(1e-4);             // on the centre line
    expect(att.p[2]).toBeLessThan(0);                          // a little behind the head centre (CLASSIC_DY)
    const r = (SKULL as unknown as { roblox: { stud_m: number; classic_head_studs: { R: number } } }).roblox;
    expect(r.stud_m * 2 * r.classic_head_studs.R).toBeCloseTo(2 * (SKULL as unknown as { skull: { A: number } }).skull.A, 4);   // as wide as ours
  });
  it("attaches every one of David's hairstyles by a complete Roblox attachment (hair/roblox_attachments.json)", () => {
    const data = JSON.parse(readFileSync(join(web, "../art/characters/hair/roblox_attachments.json"), "utf8")) as {
      hairs: { id: string; asset_id: number; position: number[]; orientation: number[]; mesh_scale: number[]; provisional: boolean }[] };
    const roblox = PARTS.filter(p => p.roblox && p.full);
    expect(roblox.length).toBe(37);   // 21 less #14 (round 3), wardrobe batch 2's five, less #8, #9 and #24 (the hair shelf); batch 3's 15
    const byId = new Map(data.hairs.map(h => [h.id, h]));
    for (const p of roblox) {
      const h = byId.get(p.id);
      expect(h, p.id).toBeDefined();
      for (const v of [h!.position, h!.orientation, h!.mesh_scale]) {
        expect(v, p.id).toHaveLength(3);
        expect(v.every(Number.isFinite), p.id).toBe(true);
      }
      expect(h!.mesh_scale.every(x => x > 0), p.id).toBe(true);
      expect(typeof h!.provisional, p.id).toBe("boolean");
      expect(p.roblox!.provisional, p.id).toBe(h!.provisional);
    }
    // the three read from Roblox's own accessory files
    expect(data.hairs.filter(h => !h.provisional).map(h => h.id).sort()).toEqual(["hair_baby_sprout", "hair_bowl_cut", "hair_windy_bob"]);
  });
  it("attaches every one of David's batch-2 accessories by a complete Roblox attachment, sized as David asked (accessories/roblox_attachments.json)", () => {
    type Entry = { id: string; key: string; attachment: string; position: number[]; orientation: number[]; mesh_scale: number[]; provisional: boolean; override?: { scale?: number }; coversHair?: boolean };
    const data = JSON.parse(readFileSync(join(web, "../art/characters/accessories/roblox_attachments.json"), "utf8")) as { items: Entry[] };
    const roblox = PARTS.filter(p => p.roblox?.attachment);
    expect(roblox.length).toBe(25);   // round 2: #07 in silver too; batch 3's three face items
    const byId = new Map(data.items.map(e => [e.id, e]));
    for (const p of roblox) {
      const e = byId.get(p.id)!;
      expect(e, p.id).toBeDefined();
      expect([e.key, e.attachment, e.provisional, !!e.coversHair], p.id).toEqual([p.key, p.roblox!.attachment, p.roblox!.provisional, !!p.coversHair]);
      for (const v of [e.position, e.orientation, e.mesh_scale]) expect(v.length === 3 && v.every(Number.isFinite), p.id).toBe(true);
    }
    // row 314 (David, 2026-10-17): the shrunk ones back at Roblox scale; the hats bigger, covering the hair; #07 smaller;
    // round 2: #17 a little smaller again, #07's silver version sized as #07
    const scaled = Object.fromEntries(data.items.filter(e => e.override?.scale).map(e => [e.key, e.override!.scale!]));
    for (const k of ["acc-02", "acc-19", "acc-23"]) expect(scaled[k], k).toBeUndefined();
    for (const k of ["acc-01", "acc-18", "acc-21", "acc-22", "acc-24"]) expect(scaled[k], k).toBeGreaterThan(1);
    for (const k of ["acc-07", "acc-07s", "acc-17"]) expect(scaled[k], k).toBeLessThan(1);
    // #16 (the sci-fi visor) is skipped; #12 and #13 are deleted
    expect(data.items.some(e => ["acc-12", "acc-13", "acc-16"].includes(e.key))).toBe(false);
  });
  it("has every hairstyle, hat and face accessory fitted to this skull (refit them after a skull change)", () => {
    const onHead = PARTS.filter(p => p.slot === "bangs" || p.slot === "back" || p.group === "head" || p.group === "face");
    expect(onHead.length).toBeGreaterThan(30);
    for (const p of onHead) expect((p as { skull?: string }).skull, p.id).toBe(SKULL.version);
  });
});
