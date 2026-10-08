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
    expect(y("top")).toBeGreaterThan(y("crown"));
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
  it("has every hairstyle, hat and face accessory fitted to this skull (refit them after a skull change)", () => {
    const onHead = PARTS.filter(p => p.slot === "bangs" || p.slot === "back" || p.group === "head" || p.group === "face");
    expect(onHead.length).toBeGreaterThan(30);
    for (const p of onHead) expect((p as { skull?: string }).skull, p.id).toBe(SKULL.version);
  });
});
