import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXPRESSIONS, FACE_SLOT_COUNT, FaceAnimator, blinkFrame, canBlink, faceSlots, restPose } from "./face";
import { DEFAULT_LOOK, FACE, FACE_ATLAS_URLS, PALETTE, parseLook, randomLook, seeded, usesFacePage2, type CharacterLook, type FaceCell } from "./look";

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
    expect(s).toHaveLength(FACE_SLOT_COUNT);
    const extras = FACE_SLOT_COUNT - 4;   // one slot per extra, then brows, the eyes and the mouth
    expect(s.slice(0, extras).every(x => x.src === null)).toBe(true); // no extras on the default look
    const [brows, eyeR, eyeL, mouth] = s.slice(extras);
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
    const area = (c: FaceCell) => c[2] * c[3];
    for (const t of FACE.talk.frames) expect(FACE.layers.talk.items[t][3], t).toBeGreaterThanOrEqual(rest[3]);   // open, not a line
    expect(Math.max(...FACE.talk.frames.map(t => area(FACE.layers.talk.items[t])))).toBeGreaterThan(area(rest) * 1.8);
    const talking = faceSlots(DEFAULT_LOOK, { ...restPose(DEFAULT_LOOK, "neutral"), mouth: FACE.talk.frames[2] }).at(-1)!;
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
  const src = (c: FaceCell) => { const [W, H] = FACE.atlas_size; return [c[0] / W, c[1] / H, c[2] / W, c[3] / H]; };

  it("are creator options with names, packed below every earlier cell so old rects and pixels stay as they were", () => {
    for (const id of EYES) expect(Object.keys(FACE.layers.eyes.items[id]), id).toEqual(["open"]); // static: no blink frames
    for (const id of MOUTHS) expect(FACE.layers.mouth.items[id], id).toBeDefined();
    for (const id of EXTRAS) expect(FACE.layers.extras.items[id], id).toMatchObject({ anchor: "blush", mirror: false });
    for (const id of [...EYES, ...MOUTHS, ...EXTRAS]) expect(FACE.names[id], id).toBeDefined();
    const set = new Set([...EYES, ...MOUTHS, ...EXTRAS]);
    const cells = [
      ...Object.entries(FACE.layers.eyes.items).flatMap(([id, f]) => Object.values(f).map(c => [id, c!] as const)),
      ...Object.entries(FACE.layers.mouth.items), ...Object.entries(FACE.layers.talk.items), ...Object.entries(FACE.layers.brows.items),
      ...Object.entries(FACE.layers.extras.items).map(([id, it]) => [id, it.cell] as const),
    ];
    const legacyBottom = Math.max(...cells.filter(([id, c]) => !set.has(id) && !c[6]).map(([, c]) => c[1] + c[3]));   // first page
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
    const band = s[0], [eyeR, eyeL, mouth] = s.slice(-3);
    expect(band.src).toEqual(src(FACE.layers.extras.items.blush_band.cell));
    expect(band.mirror).toBe(0); // one centred band across both cheeks
    expect(eyeR.src).toEqual(src(FACE.layers.eyes.items.sleepy_lash.open));
    expect([eyeR.mirror, eyeL.mirror, eyeL.src]).toEqual([0, 2, eyeR.src]);
    expect(mouth.src).toEqual(src(FACE.layers.mouth.items.cat_w));
    const a = FACE.anchors.blush;
    expect(band.dst[0] < a[0] && a[0] < band.dst[2] && band.dst[1] < a[1] && a[1] < band.dst[3]).toBe(true);
    expect(band.dst[0] < FACE.anchors.eye[0] && band.dst[2] > 1 - FACE.anchors.eye[0]).toBe(true); // reaches under both eyes
    const d = faceSlots(look({ eyes: "dot", mouth: "grin_curl" }), restPose(look({ eyes: "dot", mouth: "grin_curl" }), "neutral"));
    expect([d.at(-3)!.src, d.at(-1)!.src]).toEqual([src(FACE.layers.eyes.items.dot.open), src(FACE.layers.mouth.items.grin_curl)]);
  });

  it("stay static: the new eyes never blink and an idle face keeps its mouth", () => {
    for (const eyes of EYES) {
      expect(canBlink(eyes), eyes).toBe(false);
      const frames = run(new FaceAnimator(seeded(4)), 20, look({ eyes, mouth: "grin_curl" }));
      expect(frames.every(f => f.eyes === eyes && f.eyeFrame === "open" && f.mouth === "grin_curl")).toBe(true);
    }
  });

  it("are never rolled for random looks, so seeded residents keep the faces they had", () => {
    const set = new Set([...EYES, ...MOUTHS, ...EXTRAS]);
    for (let i = 0; i < 300; i++) {
      const l = randomLook(seeded(i));
      expect(set.has(l.eyes) || set.has(l.mouth) || l.extras.some(x => set.has(x)), String(i)).toBe(false);
    }
  });
});

describe("David's 19 faces (face set 305, art/characters/v7/face_set_305.py)", () => {
  const EYES = ["bean", "daze", "half_lid", "swirl", "mochi", "shy", "relieved", "chill", "tiny_dots", "stare", "offset", "unimpressed", "close_dots", "teary", "doll_lash", "nervous", "focused", "sleepy", "square_dots"];
  const MOUTHS = ["little_v", "drumstick", "drool", "gritted", "pout", "tiny_smirk", "open_smile", "small_frown", "pill", "deadpan", "dash", "side_smirk", "long_drool", "nervous_laugh", "tiny_mouth", "gasp", "kitty", "tired_drool", "buck_tooth"];
  const ACCENTS = ["nose_blush", "sweat_drop"];
  const SET = new Set([...EYES, ...MOUTHS, ...ACCENTS]);
  const NEW = new Set([...SET, "brow_none"]);
  const page2 = (c: FaceCell) => { const [W, H] = FACE.atlas2_size; return [c[0] / W, c[1] / H, c[2] / W, c[3] / H]; };

  it("are creator options with short names, on the second atlas page, and static", () => {
    for (const id of EYES) {
      const item = FACE.layers.eyes.items[id];
      expect(item, id).toBeDefined();
      expect(Object.keys(item).every(f => f === "open" || f === "left"), id).toBe(true);   // no blink frames
      for (const c of Object.values(item)) expect(c![6], id).toBe(1);
      expect(canBlink(id), id).toBe(false);
    }
    for (const id of MOUTHS) expect(FACE.layers.mouth.items[id]?.[6], id).toBe(1);
    for (const id of ACCENTS) expect(FACE.layers.extras.items[id]?.cell[6], id).toBe(1);
    for (const id of SET) {
      expect(FACE.names[id], id).toMatch(/^[A-Z][a-z -]+$/);       // short friendly names, no item numbers
      expect(FACE.names[id].length, id).toBeLessThanOrEqual(14);
    }
    expect(new Set(Object.values(FACE.names)).size).toBe(Object.keys(FACE.names).length);
    for (const [W, H] of [FACE.atlas_size, FACE.atlas2_size]) expect(W <= 2048 && H <= 4096).toBe(true);
  });

  it("keep every earlier cell, anchor and the first page as they were (old looks draw the same)", () => {
    const keep = <T,>(items: Record<string, T>) => Object.fromEntries(Object.entries(items).filter(([id]) => !NEW.has(id)));
    const legacy = {
      anchors: Object.fromEntries((["eye", "brow", "mouth", "cheek", "mole", "blush"] as const).map(k => [k, FACE.anchors[k]])),
      atlas_size: FACE.atlas_size, density: FACE.density,
      layers: Object.fromEntries(Object.entries(FACE.layers).map(([l, v]) => [l, keep(v.items as Record<string, unknown>)])),
    };
    // the earlier layers on main before the set (b8775fbb atlas, row 301 included)
    expect(createHash("sha256").update(JSON.stringify(legacy)).digest("hex")).toBe("b0476a46c7e2c6cd768eeb609ffa7fc392afc0860caf22ef44c2f8d992163eae");
    const atlas = (f: string) => createHash("sha256").update(readFileSync(join(__dirname, "../../../public", f))).digest("hex");
    expect(atlas(FACE_ATLAS_URLS.creator)).toBe("b8775fbb0a2a71ee64166f98e8eaa57344ade3821f892fd8855bce047c2fbb66");
    expect(atlas(FACE_ATLAS_URLS.world)).toBe("27b1215373cbc6bed6cc188ec4a05504414959d8690889c688442996d10db7dc");
    // an old look's slots all read the first page, and it never asks for the second
    const old = look({ eyes: "E5.5", mouth: "G2.3", extras: ["blush", "mole", "blush_band", "freckles"] });
    expect(faceSlots(old, restPose(old, "neutral")).every(s => s.page === 0)).toBe(true);
    expect([usesFacePage2(old), usesFacePage2(DEFAULT_LOOK)]).toEqual([false, false]);
  });

  it("parse and survive a save round trip, mixing with any eyes, mouth and accent", () => {
    for (let i = 0; i < EYES.length; i++) {
      const saved = { ...DEFAULT_LOOK, eyes: EYES[i], mouth: MOUTHS[(i * 7) % MOUTHS.length], extras: [ACCENTS[i % 2], "blush"] };
      const parsed = parseLook(JSON.parse(JSON.stringify(saved)));
      expect(parsed).toEqual(saved);
      expect(parseLook(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
      expect(usesFacePage2(parsed)).toBe(true);
    }
    const mixed = parseLook({ ...DEFAULT_LOOK, eyes: "F1.1", mouth: "drool", extras: ["sweat_drop"] });
    expect([mixed.eyes, mixed.mouth, mixed.extras]).toEqual(["F1.1", "drool", ["sweat_drop"]]);
    expect(usesFacePage2(mixed)).toBe(true);
  });

  it("render their own cells: each id draws in its slot at its anchor, from the second page", () => {
    for (const id of EYES) {
      const l = look({ eyes: id, mouth: MOUTHS[EYES.indexOf(id)], extras: ACCENTS });
      const s = faceSlots(l, restPose(l, "neutral"));
      expect(s).toHaveLength(FACE_SLOT_COUNT);
      const [eyeR, eyeL, mouth] = s.slice(-3);
      const item = FACE.layers.eyes.items[id];
      expect([eyeR.src, eyeR.page, eyeR.mirror]).toEqual([page2(item.open), 1, 0]);
      if (item.left) expect([eyeL.src, eyeL.page, eyeL.mirror]).toEqual([page2(item.left), 1, 0]);   // its own drawing
      else expect([eyeL.src, eyeL.mirror]).toEqual([eyeR.src, 2]);                                // a mirrored pair
      expect([mouth.src, mouth.page]).toEqual([page2(FACE.layers.mouth.items[l.mouth]), 1]);
      const accents = s.filter(x => x.src && ACCENTS.some(a => x.src!.join() === page2(FACE.layers.extras.items[a].cell).join()));
      expect(accents.length).toBe(2);
      for (const sl of s) if (sl.src) {
        // every placed cell lands on the face canvas
        expect(sl.dst[0] < 1 && sl.dst[2] > 0 && sl.dst[1] < 1 && sl.dst[3] > 0).toBe(true);
      }
    }
    // the canvas-right eye sits at the mirrored eye anchor
    expect(FACE.anchors.eye_left).toEqual([1 - FACE.anchors.eye[0], FACE.anchors.eye[1]]);
    // expressions and talking still use the earlier cells, on the first page
    const l = look({ eyes: "swirl", mouth: "drool" });
    const happy = faceSlots(l, restPose(l, "happy"));
    expect(happy.slice(-3).map(x => x.page)).toEqual([0, 0, 0]);
  });

  it("come with a no-brows choice (their eyes carry their own brows) that draws nothing", () => {
    const l = look({ eyes: "swirl", mouth: "gritted", brows: "brow_none" });
    expect(parseLook(JSON.parse(JSON.stringify(l))).brows).toBe("brow_none");
    expect(FACE.names.brow_none).toBe("No brows");
    const s = faceSlots(l, restPose(l, "neutral"));
    expect(s.at(-4)!.src).toBeNull();
    expect(faceSlots(DEFAULT_LOOK, restPose(DEFAULT_LOOK, "neutral")).at(-4)!.src).not.toBeNull();
  });

  it("are never rolled for random looks, so residents and bots keep their faces", () => {
    for (let i = 0; i < 300; i++) {
      const l = randomLook(seeded(i));
      expect(SET.has(l.eyes) || SET.has(l.mouth) || l.extras.some(x => SET.has(x)), String(i)).toBe(false);
    }
  });
});
