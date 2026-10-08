import { describe, expect, it } from "vitest";
import { EXPRESSIONS, FaceAnimator, blinkFrame, canBlink, faceSlots, restPose } from "./face";
import { DEFAULT_LOOK, FACE, PALETTE, parseLook, randomLook, seeded, type CharacterLook } from "./look";

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
    expect(s).toHaveLength(8);
    expect(s.slice(0, 4).map(x => x.src)).toEqual([null, null, null, null]); // no extras on the default look
    const [brows, eyeR, eyeL, mouth] = s.slice(4);
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
    expect(s.slice(0, 4).map(x => [x.src !== null, x.mirror])).toEqual([[false, 0], [true, 1], [true, 1], [true, 0]]);
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
    // talking opens the mouth wider than the small resting mouth (David: "Bigger talk shapes")
    const rest = FACE.layers.mouth.items["M1.1"];
    const area = (c: number[]) => c[2] * c[3];
    for (const t of FACE.talk.frames) expect(FACE.layers.talk.items[t][3], t).toBeGreaterThanOrEqual(rest[3]);   // open, not a line
    expect(Math.max(...FACE.talk.frames.map(t => area(FACE.layers.talk.items[t])))).toBeGreaterThan(area(rest) * 1.8);
    const talking = faceSlots(DEFAULT_LOOK, { ...restPose(DEFAULT_LOOK, "neutral"), mouth: FACE.talk.frames[2] })[7];
    expect(talking.src![0]).toBeCloseTo(FACE.layers.talk.items[FACE.talk.frames[2]][0] / FACE.atlas_size[0]);
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

describe("row 301 face set (face_set_301.py: sleepy and dot eyes, cat and curled-grin mouths, the blush band)", () => {
  const EYES = ["sleepy_lash", "dot"], MOUTHS = ["cat_w", "grin_curl"], EXTRAS = ["blush_band"];
  const src = (c: number[]) => { const [W, H] = FACE.atlas_size; return [c[0] / W, c[1] / H, c[2] / W, c[3] / H]; };

  it("are creator options with names, packed below every earlier cell so old rects and pixels stay as they were", () => {
    for (const id of EYES) expect(Object.keys(FACE.layers.eyes.items[id]), id).toEqual(["open"]); // static: no blink frames
    for (const id of MOUTHS) expect(FACE.layers.mouth.items[id], id).toBeDefined();
    for (const id of EXTRAS) expect(FACE.layers.extras.items[id], id).toMatchObject({ anchor: "blush", mirror: false });
    expect(Object.keys(FACE.names).sort()).toEqual([...EYES, ...MOUTHS, ...EXTRAS].sort());
    const set = new Set(Object.keys(FACE.names));
    const cells = [
      ...Object.entries(FACE.layers.eyes.items).flatMap(([id, f]) => Object.values(f).map(c => [id, c!] as const)),
      ...Object.entries(FACE.layers.mouth.items), ...Object.entries(FACE.layers.talk.items), ...Object.entries(FACE.layers.brows.items),
      ...Object.entries(FACE.layers.extras.items).map(([id, it]) => [id, it.cell] as const),
    ];
    const legacyBottom = Math.max(...cells.filter(([id]) => !set.has(id)).map(([, c]) => c[1] + c[3]));
    expect(legacyBottom).toBeLessThanOrEqual(1152); // the atlas height before the set
    for (const [id, c] of cells) if (set.has(id)) expect(c[1], id).toBeGreaterThan(1152);
  });

  it("parse and survive a save round trip; old looks are unchanged", () => {
    for (const eyes of EYES) for (const mouth of MOUTHS) {
      const saved = { ...DEFAULT_LOOK, eyes, mouth, extras: ["blush_band", "freckles"] };
      const look = parseLook(JSON.parse(JSON.stringify(saved)));
      expect(look).toEqual(saved);
      expect(parseLook(JSON.parse(JSON.stringify(look)))).toEqual(look);
    }
    const old = { ...DEFAULT_LOOK, eyes: "E5.5", mouth: "G2.3", extras: ["blush", "mole"] };
    expect(parseLook(JSON.parse(JSON.stringify(old)))).toEqual(old);
  });

  it("render their own cells: each id lands in its slot at its anchor", () => {
    const l = look({ eyes: "sleepy_lash", mouth: "cat_w", extras: ["blush_band"] });
    const s = faceSlots(l, restPose(l, "neutral"));
    const [band, , , , , eyeR, eyeL, mouth] = s;
    expect(band.src).toEqual(src(FACE.layers.extras.items.blush_band.cell));
    expect(band.mirror).toBe(0); // one centred band across both cheeks
    expect(eyeR.src).toEqual(src(FACE.layers.eyes.items.sleepy_lash.open));
    expect([eyeR.mirror, eyeL.mirror, eyeL.src]).toEqual([0, 2, eyeR.src]);
    expect(mouth.src).toEqual(src(FACE.layers.mouth.items.cat_w));
    const a = FACE.anchors.blush;
    expect(band.dst[0] < a[0] && a[0] < band.dst[2] && band.dst[1] < a[1] && a[1] < band.dst[3]).toBe(true);
    expect(band.dst[0] < FACE.anchors.eye[0] && band.dst[2] > 1 - FACE.anchors.eye[0]).toBe(true); // reaches under both eyes
    const d = faceSlots(look({ eyes: "dot", mouth: "grin_curl" }), restPose(look({ eyes: "dot", mouth: "grin_curl" }), "neutral"));
    expect([d[5].src, d[7].src]).toEqual([src(FACE.layers.eyes.items.dot.open), src(FACE.layers.mouth.items.grin_curl)]);
  });

  it("stay static: the new eyes never blink and an idle face keeps its mouth", () => {
    for (const eyes of EYES) {
      expect(canBlink(eyes), eyes).toBe(false);
      const frames = run(new FaceAnimator(seeded(4)), 20, look({ eyes, mouth: "grin_curl" }));
      expect(frames.every(f => f.eyes === eyes && f.eyeFrame === "open" && f.mouth === "grin_curl")).toBe(true);
    }
  });

  it("are never rolled for random looks, so seeded residents keep the faces they had", () => {
    const set = new Set(Object.keys(FACE.names));
    for (let i = 0; i < 300; i++) {
      const l = randomLook(seeded(i));
      expect(set.has(l.eyes) || set.has(l.mouth) || l.extras.some(x => set.has(x)), String(i)).toBe(false);
    }
  });
});
