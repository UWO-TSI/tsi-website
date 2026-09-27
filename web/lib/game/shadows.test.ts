import { describe, expect, it } from "vitest";
import { contactSize, meshShadow, shadowClassFor, sunShadow } from "./shadows";

const A = "/assets/acnh/";

describe("shadow classification (look spec §9.2)", () => {
  it("puts every asset the islands use in one class by its URL", () => {
    const table: Record<string, string[]> = {
      solid: ["buildings/hq-office.glb", "buildings/chalet-wall-a.glb", "props/streetlamp.glb", "props/bench-wood.glb", "props/fence-rope-a.glb",
        "props/fence-country-b.glb", "props/bridge-wooden.glb", "props/rock-c.glb", "props/stone-lantern.glb", "props/bulletin-board.glb",
        "furniture/mailbox.glb", "furniture/ruins-pillar.glb", "furniture/study-chair.glb", "furniture/monument-rock.glb"].map(u => A + u)
        .concat(["/assets/game/props/workbench.glb", "/assets/game/weapons/sword-iron.glb"]),
      foliage: ["tree-hardwood-a", "tree-hardwood-b", "tree-blossom", "tree-hardwood-snow", "tree-cedar", "tree-cedar-snow", "bush-holly", "bush-azalea", "bush-holly-snow"]
        .map(p => `${A}plants/${p}.glb`),
      small: [`${A}plants/flower-rose.glb`, `${A}props/shell-scallop.glb`, `${A}furniture/lounge-book.glb`, "/assets/nature/grass-tufts.glb",
        "/assets/nature/rock_smallA.glb", "/assets/nature/mushroom_red.glb", "/assets/game/props/branch.glb", "/assets/game/props/message-bottle.glb"],
      none: [`${A}critters/firefly.glb`, `${A}critters/common-butterfly.glb`, `${A}furniture/lounge-rug.glb`, `${A}furniture/yellow-message-mat.glb`, `${A}props/distant-view-01.glb`],
    };
    for (const [cls, urls] of Object.entries(table)) for (const url of urls) expect(shadowClassFor(url), url).toBe(cls);
  });

  it("gives ACNH's tree casters the shadow and takes it from the leaf cards", () => {
    const oak = { casters: true };
    expect(meshShadow("foliage", "mShadow", oak)).toEqual({ cast: true, receive: false, caster: "static" });
    expect(meshShadow("foliage", "mShadowShake", oak)).toEqual({ cast: true, receive: false, caster: "sway" });
    for (const leaf of ["mTreeOakLeaf", "mTreeOakLeafBack", "mTreeOakSakuraBloom", "mTreeOakSakuraBack", "mTreeOakLeafSnow", "mTreeOakLeafSphSnow"])
      expect(meshShadow("foliage", leaf, oak), leaf).toEqual({ cast: false, receive: false });
    // The hull covers the trunk: it receives (the canopy shades it) but does not cast twice.
    expect(meshShadow("foliage", "mPltTreeOakTrunk", oak)).toEqual({ cast: false, receive: true });
  });

  it("casts foliage without ACNH casters from its light-facing faces, never onto itself", () => {
    for (const leaf of ["PltTreeCedar__PltTreeCedar4_mat0", "mPltTreeCedarLeafSnow", "PltBushHolly__PltBushHolly4_mat0"])
      expect(meshShadow("foliage", leaf), leaf).toEqual({ cast: true, receive: false, front: true });
    for (const trunk of ["PltTreeCedar__PltTreeCedar4_mat1", "mTreeCedarTrunkSnow"])
      expect(meshShadow("foliage", trunk), trunk).toEqual({ cast: true, receive: true });
  });

  it("lets solids cast and receive, small and none receive only, glass shells cast nothing", () => {
    expect(meshShadow("solid", "mReBody")).toEqual({ cast: true, receive: true });
    expect(meshShadow("small", "PltFlwRose__PltFlwRose2_mat0")).toEqual({ cast: false, receive: true });
    expect(meshShadow("none", "mRug")).toEqual({ cast: false, receive: true });
    expect(meshShadow("solid", "mGlassF", { glass: true })).toEqual({ cast: false, receive: true });
  });
});

describe("contact size", () => {
  const box = (x0: number, x1: number, z0: number, z1: number, h: number) => ({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: h, z: z1 } });
  it("sits on the footprint, a little wider, with the model's height", () => {
    const c = contactSize(`${A}plants/bush-holly.glb`, "foliage", box(-0.57, 0.55, -0.82, 0.06, 1.06))!;
    expect(c.cx).toBeCloseTo(-0.01);
    expect(c.cz).toBeCloseTo(-0.38);
    expect(c.rx).toBeGreaterThan(0.56);
    expect(c.rz).toBeGreaterThan(0.44);
    expect(c.height).toBeCloseTo(1.06);
  });
  it("is tighter and flat for small things, and absent for none and for pieces over water", () => {
    const flower = contactSize(`${A}plants/flower-rose.glb`, "small", box(-0.5, 0.5, -0.3, 0.43, 0.6))!;
    expect(flower.rx).toBeLessThan(0.5);
    expect(flower.height).toBe(0);
    expect(contactSize(`${A}critters/firefly.glb`, "none", box(-1, 1, -1, 1, 1))).toBeNull();
    expect(contactSize(`${A}props/bridge-wooden.glb`, "solid", box(-3, 3, -1, 1, 1))).toBeNull();
  });
});

describe("Light tier sun-directed shadow", () => {
  const round = { x: 2, z: 3, rx: 0.5, rz: 0.5, yaw: 0 };
  it("runs away from the sun, as long as the caster's shadow on flat ground", () => {
    // Sun at 45° in the +x direction: a 2-tall caster throws 2 units toward -x.
    const s = sunShadow(round, 2, [1, 1, 0])!;
    expect(s.x).toBeCloseTo(1);
    expect(s.z).toBeCloseTo(3);
    expect(s.rz).toBeCloseTo(1.5); // half the length plus the footprint along it
    expect(s.rx).toBeCloseTo(0.5);
    // Its long axis (local z) points along -x.
    expect(Math.sin(s.yaw)).toBeCloseTo(-1);
  });
  it("follows the sun's azimuth and lengthens as it sinks, within bounds", () => {
    const high = sunShadow(round, 2, [0, 3, 1])!, low = sunShadow(round, 2, [0, 0.2, 1])!;
    expect(high.z).toBeLessThan(3);
    expect(high.x).toBeCloseTo(2);
    expect(low.rz).toBeGreaterThan(high.rz);
    expect(low.rz).toBeLessThanOrEqual(2 * 3 / 2 + 0.5 + 1e-9);
  });
  it("measures a rotated footprint along and across the sun", () => {
    const bench = { x: 0, z: 0, rx: 1, rz: 0.3, yaw: Math.PI / 2 }; // long axis along world z
    const s = sunShadow(bench, 1.2, [1, 1, 0])!; // shadow along -x: across it is world z
    expect(s.rx).toBeCloseTo(1);
    expect(s.rz).toBeCloseTo(0.6 + 0.3);
  });
  it("is absent for short casters, an overhead sun and a sun below the horizon", () => {
    expect(sunShadow(round, 0.6, [1, 1, 0])).toBeNull();
    expect(sunShadow(round, 2, [0, 1, 0])).toBeNull();
    expect(sunShadow(round, 2, [1, -0.2, 0])).toBeNull();
  });
});
