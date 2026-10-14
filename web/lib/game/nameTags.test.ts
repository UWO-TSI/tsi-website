import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { FADE_RUN, LABEL_PRIORITY, LabelLayout } from "./labelLayout";
import { NAME_TAG_RANGE, residentTag, type TagElement } from "./nameTags";

const W = 1600, H = 900;
const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 120);
camera.position.set(0, 10, -20);
camera.lookAt(0, 1, 0);
camera.updateMatrixWorld();

/** A stand-in for the tag's element: what the layout writes, and a box to measure. */
function fakeEl(): TagElement & { measured: number } {
  const e = {
    hidden: true, measured: 0, style: { opacity: "", transform: "" },
    getBoundingClientRect: () => { e.measured++; return { width: 64, height: 18 } as DOMRect; },
  };
  return e;
}
const settle = (layout: LabelLayout, focus: THREE.Vector3Like) => { layout.solve(camera, W, H, focus, 0); for (let i = 0; i < 60; i++) layout.solve(camera, W, H, focus, 1 / 60); };

describe("name tags (specs/v1-drop.md §3)", () => {
  it("about 8 steps", () => expect(NAME_TAG_RANGE).toBe(8));

  it("a resident's name shows within range of you and fades out past it", () => {
    const layout = new LabelLayout(), el = fakeEl(), at = new THREE.Vector3(0, 2, 0);
    const spec = residentTag(out => { out.copy(at); return true; }, () => el);
    expect(spec.priority).toBe(LABEL_PRIORITY.resident);
    layout.add(spec);
    settle(layout, { x: 0, y: 0, z: -5 });
    expect(el.hidden).toBe(false);
    expect(el.style.opacity).toBe("");
    expect(el.measured).toBe(1);
    // Past the range and its fade: gone.
    settle(layout, { x: 0, y: 0, z: -(NAME_TAG_RANGE + FADE_RUN + 0.5) });
    expect(el.hidden).toBe(true);
    // Back in range: shown again, measured once only.
    settle(layout, { x: 0, y: 0, z: -3 });
    expect(el.hidden).toBe(false);
    expect(el.measured).toBe(1);
  });

  it("hides while the owner says it isn't showing (a talk, a bubble, out of sight)", () => {
    const layout = new LabelLayout(), el = fakeEl();
    let on = true;
    layout.add(residentTag(out => { out.set(0, 2, 0); return on; }, () => el));
    settle(layout, { x: 0, y: 0, z: -2 });
    expect(el.hidden).toBe(false);
    on = false;
    settle(layout, { x: 0, y: 0, z: -2 });
    expect(el.hidden).toBe(true);
  });

  it("steps up out of a player's tag rather than covering it; squeezed out, it hides", () => {
    const layout = new LabelLayout(), el = fakeEl();
    layout.add({ priority: LABEL_PRIORITY.player, size: { w: 80, h: 18 }, anchor: out => { out.set(0, 2, 0); return true; }, place: () => {} });
    layout.add(residentTag(out => { out.set(0.02, 2, 0.3); return true; }, () => el));
    settle(layout, { x: 0, y: 0, z: -2 });
    expect(el.hidden).toBe(false);
    expect(el.style.transform).toMatch(/^translateY\(-\d+px\)$/);
    // A crowd of players on the same spot: no room left, so the resident's name waits.
    for (let i = 1; i < 6; i++) layout.add({ priority: LABEL_PRIORITY.player, size: { w: 80, h: 18 }, anchor: out => { out.set(0, 2 + i * 0.01, -0.05 * i); return true; }, place: () => {} });
    settle(layout, { x: 0, y: 0, z: -2 });
    expect(el.hidden).toBe(true);
  });
});

describe("your own name", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  it("is hidden: PlayerAvatar draws no nameplate unless asked, and no scene asks", () => {
    expect(read("../../components/game/PlayerAvatar.tsx")).toMatch(/showNameplate = false/);
    for (const f of ["DefaultIslandWorld.tsx", "home/HomeIslandScene.tsx", "study/CafeInterior.tsx", "combat/RuinsScene.tsx"]) {
      const src = read(`../../components/game/${f}`);
      expect(src, f).toMatch(/<PlayerAvatar/);
      expect(src, f).not.toMatch(/showNameplate(?!=\{false\})/);
    }
  });
  it("leaves no stand-in for it in the label layout", () => {
    expect(read("../../components/game/LabelLayer.tsx")).not.toMatch(/LABEL_PRIORITY\.self/);
  });
});
