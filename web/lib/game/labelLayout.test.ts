import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { boxOccluder } from "./occluders";
import { FADE_RUN, LABEL_GAP, LABEL_PRIORITY, LabelLayout, type LabelOut, type LabelSpec } from "./labelLayout";

const W = 1600, H = 900;
const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 120);
camera.position.set(0, 10, -20);
camera.lookAt(0, 1, 0);
camera.updateMatrixWorld();
const focus = { x: 0, y: 0, z: 0 };

/** A label at a fixed world point; `seen` keeps the last result handed to it. */
function label(at: [number, number, number], extra: Partial<LabelSpec> = {}) {
  const seen: { out: LabelOut | null } = { out: null };
  const spec: LabelSpec = {
    priority: LABEL_PRIORITY.player, size: { w: 120, h: 26 },
    anchor: out => { out.set(...at); return true; },
    place: o => { seen.out = { ...o }; },
    ...extra,
  };
  return { spec, seen };
}
/** Solve until the eased values settle. */
const settle = (layout: LabelLayout) => { layout.solve(camera, W, H, focus, 0); for (let i = 0; i < 60; i++) layout.solve(camera, W, H, focus, 1 / 60); };

describe("the label layout (world audit item 2)", () => {
  it("stacks a farther plate above a nearer one at the same spot instead of piling them up", () => {
    const layout = new LabelLayout(), near = label([0, 2, 0]), far = label([0.05, 2.02, 0.6]);
    layout.add(near.spec); layout.add(far.spec);
    settle(layout);
    const a = near.seen.out!, b = far.seen.out!;
    expect(a.shown && b.shown).toBe(true);
    expect(a.dy).toBeCloseTo(0, 3);
    // The farther one sits fully above the nearer one's box.
    expect(b.y + b.dy + 13).toBeLessThanOrEqual(a.y - 13 - LABEL_GAP + 1);
    expect(a.dot || b.dot).toBe(false);
  });

  it("squeezes a plate pushed past a few heights to a dot, nearest kept whole", () => {
    const layout = new LabelLayout(), plates = [0, 1, 2, 3, 4, 5].map(i => label([0, 2, i * 0.3]));
    plates.forEach(p => layout.add(p.spec));
    settle(layout);
    expect(plates[0].seen.out!.dot).toBe(false);
    expect(plates.filter(p => p.seen.out!.dot).length).toBeGreaterThan(0);
    // The dots are the farthest.
    expect(plates[5].seen.out!.dot).toBe(true);
  });

  it("lets a higher priority keep its place whatever the depth", () => {
    const layout = new LabelLayout(), plate = label([0, 2, 0]), bubble = label([0, 2, 0.5], { priority: LABEL_PRIORITY.speech });
    layout.add(plate.spec); layout.add(bubble.spec);
    settle(layout);
    expect(bubble.seen.out!.dy).toBeCloseTo(0, 3);
    expect(plate.seen.out!.dy).toBeLessThan(-20);
  });

  it("fades a tag that doesn't nudge rather than moving it", () => {
    const layout = new LabelLayout(), plate = label([0, 2, 0]), tag = label([0, 2, 0.4], { priority: LABEL_PRIORITY.landmark, nudge: false });
    layout.add(plate.spec); layout.add(tag.spec);
    settle(layout);
    expect(tag.seen.out!.dy).toBeCloseTo(0, 3);
    expect(tag.seen.out!.alpha).toBe(0);
    expect(tag.seen.out!.shown).toBe(false);
  });

  it("shows a ranged tag only near the focus, fading over the last stretch", () => {
    const layout = new LabelLayout(), close = label([3, 2, 4], { range: 8, nudge: false }), edge = label([-8.8, 2, 0], { range: 8, nudge: false }), far = label([-14, 2, 6], { range: 8, nudge: false });
    [close, edge, far].forEach(l => layout.add(l.spec));
    settle(layout);
    expect(close.seen.out!.alpha).toBeCloseTo(1, 2);
    expect(edge.seen.out!.alpha).toBeCloseTo((8 + FADE_RUN - 8.8) / FADE_RUN, 2);
    expect(far.seen.out?.shown ?? false).toBe(false);
  });

  it("hides a label behind a building, but not its own tag on the building's face", () => {
    const layout = new LabelLayout();
    // A house between the camera (z -20) and a plate at z 6; another house with a tag on its front face (z 1).
    const behind = label([0, 2, 6]), onFace = label([4, 3.6, 1], { nudge: false, priority: LABEL_PRIORITY.landmark }), clear = label([-6, 2, 0]);
    layout.setOccluders([boxOccluder(0, 3, 3, 2, 0, 5), boxOccluder(4, 3, 1.5, 2, 0, 5)]);
    [behind, onFace, clear].forEach(l => layout.add(l.spec));
    settle(layout);
    expect(behind.seen.out!.shown).toBe(false);
    expect(onFace.seen.out!.shown).toBe(true);
    expect(clear.seen.out!.shown).toBe(true);
  });

  it("hands a label one last hidden result when it stops showing, and forgets it once removed", () => {
    const layout = new LabelLayout();
    let on = true;
    const l = label([0, 2, 0], { anchor: out => { out.set(0, 2, 0); return on; } });
    const remove = layout.add(l.spec);
    settle(layout);
    expect(l.seen.out!.shown).toBe(true);
    on = false;
    layout.solve(camera, W, H, focus, 1 / 60);
    expect(l.seen.out!.shown).toBe(false);
    remove();
    expect(layout.size).toBe(0);
  });

  it("scales a drei label's box with distance as drei does", () => {
    // A tag beside a plate (about 70 px off its middle): at its CSS size it overlaps and fades; drawn small at drei's scale it clears.
    const run = (distanceFactor?: number) => {
      const layout = new LabelLayout(), plate = label([0, 2, 0]), tag = label([1.5, 2, 0], { nudge: false, size: { w: 40, h: 20 }, distanceFactor });
      layout.add(plate.spec); layout.add(tag.spec);
      settle(layout);
      return tag.seen.out!.shown;
    };
    expect(run()).toBe(false);
    expect(run(3)).toBe(true);
  });
});
