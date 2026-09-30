import { describe, expect, it } from "vitest";
import { EXPRESSIONS, FaceAnimator, blinkFrame, canBlink, faceSlots, restPose } from "./face";
import { DEFAULT_LOOK, FACE, PALETTE, seeded, type CharacterLook } from "./look";

const look = (x: Partial<CharacterLook> = {}): CharacterLook => ({ ...DEFAULT_LOOK, ...x });

/** Run an animator for `secs` at 60 fps, recording each frame's pose. */
function run(anim: FaceAnimator, secs: number, l: CharacterLook, clip: string | null = null, talking = false) {
  const out = [];
  for (let i = 0; i < secs * 60; i++) out.push({ t: (i + 1) / 60, ...anim.update(1 / 60, l, clip, talking) });
  return out;
}

describe("face layers (avatar v7)", () => {
  it("draws the default face from the atlas: hair-tinted mirrored brows, F1.1 both sides, M1.1", () => {
    const l = look({ hair: 9 });
    const s = faceSlots(l, restPose(l, "neutral"));
    expect(s).toHaveLength(7);
    expect(s.slice(0, 3).map(x => x.src)).toEqual([null, null, null]); // no extras on the default look
    const [brows, eyeR, eyeL, mouth] = s.slice(3);
    expect([brows.mirror, brows.tint]).toEqual([1, PALETTE.hair[9]]);
    expect([eyeR.mirror, eyeL.mirror]).toEqual([0, 2]); // the right eye as drawn, the left its mirror image
    expect(eyeR.src).toEqual(eyeL.src);
    const [x, y, w, h] = FACE.layers.eyes.items["F1.1"].open, [W, H] = FACE.atlas_size;
    expect(eyeR.src).toEqual([x / W, y / H, w / W, h / H]);
    expect(mouth.src![0]).toBeCloseTo(FACE.layers.mouth.items["M1.1"][0] / W);
    // each cell is placed so its anchor point sits on the measured anchor
    for (const [sl, a] of [[eyeR, FACE.anchors.eye], [mouth, FACE.anchors.mouth], [brows, FACE.anchors.brow]] as const) {
      expect(sl.dst[0] < a[0] && a[0] < sl.dst[2] && sl.dst[1] < a[1] && a[1] < sl.dst[3]).toBe(true);
    }
  });
  it("adds the extras a look chooses: blush and freckles mirrored, the mole as placed", () => {
    const s = faceSlots(look({ extras: ["blush", "mole", "freckles"] }), restPose(DEFAULT_LOOK, "neutral"));
    expect(s.slice(0, 3).map(x => [x.src !== null, x.mirror])).toEqual([[true, 1], [true, 1], [true, 0]]);
  });
  it("gives each of the six expressions its eyes, mouth and brow pose from David's picks", () => {
    const got = Object.fromEntries(EXPRESSIONS.map(e => [e, restPose(DEFAULT_LOOK, e)]));
    expect(got.neutral).toEqual({ eyes: "F1.1", eyeFrame: "open", mouth: "M1.1", brow: [0, 0] });
    expect([got.happy.eyes, got.happy.mouth]).toEqual(["E8.1", "M2.1"]);
    expect([got.surprised.eyes, got.surprised.mouth, got.surprised.brow[0] < 0]).toEqual(["F1.1", "M6.1", true]);
    expect([got.sad.eyeFrame, got.sad.mouth, got.sad.brow[1] > 0]).toEqual(["half", "M4.3", true]); // inner ends up
    expect([got.angry.mouth, got.angry.brow[1] < 0]).toEqual(["M2.2", true]);                         // inner ends down
    expect([got.sleepy.eyes, got.sleepy.mouth]).toEqual(["E1.6", "M3.1"]);
    for (const e of EXPRESSIONS) for (const sl of faceSlots(DEFAULT_LOOK, got[e])) if (sl.src) {
      expect(sl.src[0] + sl.src[2] <= 1 && sl.src[1] + sl.src[3] <= 1).toBe(true);
    }
  });
});

describe("face animation", () => {
  it("blinks at random 2-6 s intervals: half, closed, half, about 0.15 s", () => {
    expect([blinkFrame(0.01), blinkFrame(0.06), blinkFrame(0.13), blinkFrame(0.2)]).toEqual(["half", "closed", "half", null]);
    const frames = run(new FaceAnimator(seeded(3)), 60, DEFAULT_LOOK);
    const starts = frames.filter((f, i) => f.eyeFrame !== "open" && frames[i - 1]?.eyeFrame === "open").map(f => f.t);
    expect(starts.length).toBeGreaterThanOrEqual(10);
    starts.slice(1).forEach((t, i) => {
      expect(t - starts[i]).toBeGreaterThanOrEqual(2);
      expect(t - starts[i]).toBeLessThanOrEqual(6.3);
    });
    expect(frames.some(f => f.eyeFrame === "closed")).toBe(true);
  });
  it("only blinks eyes that have lids to close: shut and flat styles stay as drawn", () => {
    expect([canBlink("F1.1"), canBlink("E5.5"), canBlink("E8.1"), canBlink("E6.1")]).toEqual([true, true, false, false]);
    const frames = run(new FaceAnimator(seeded(5)), 20, look({ eyes: "E6.1" }));
    expect(frames.every(f => f.eyeFrame === "open")).toBe(true);
  });
  it("moves the mouth while talking, never the same cell twice running, and rests after", () => {
    const anim = new FaceAnimator(seeded(8));
    const frames = run(anim, 3, DEFAULT_LOOK, null, true).map(f => f.mouth);
    const changes = frames.filter((m, i) => i > 0 && m !== frames[i - 1]);
    expect(changes.length).toBeGreaterThan(20);  // about 9 a second
    expect(changes.length).toBeLessThan(40);
    expect(new Set(frames)).toEqual(new Set(["M1.1", ...FACE.talk.frames]));
    expect(run(anim, 0.2, DEFAULT_LOOK).every(f => f.mouth === "M1.1")).toBe(true);
  });
  it("laughs with the emote's mouths and the clip's expression", () => {
    const frames = run(new FaceAnimator(seeded(1)), 1, DEFAULT_LOOK, "Laugh");
    expect(new Set(frames.map(f => f.mouth))).toEqual(new Set(FACE.emoteMouth.Laugh.frames));
    expect(frames.every(f => f.eyes === "E8.1")).toBe(true);
  });
  it("takes a forced face (portraits, the avatar bench)", () => {
    const anim = new FaceAnimator(seeded(2));
    const pose = anim.update(0.016, DEFAULT_LOOK, "Idle", false, { expression: "angry", eyeFrame: "half", mouth: "G1.1" });
    expect([pose.eyeFrame, pose.mouth, pose.brow[1] < 0]).toEqual(["half", "G1.1", true]);
  });
});
