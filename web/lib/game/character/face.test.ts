import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIP_EXPRESSION, EXPRESSIONS, FACE_SLOT_COUNT, FaceAnimator, blinkFrame, canBlink, faceSlots, restPose, type FaceSlot } from "./face";
import { DANCE_RING, EMOTE_RING } from "../emoteWheel";
import { BATCH2_PRICES, DEFAULT_LOOK, FACE, FACE_ATLAS_URLS, FIT, PALETTE, parseLook, randomLook, seeded, usesFacePage2, type CharacterLook, type FaceCell } from "./look";

const look = (x: Partial<CharacterLook> = {}): CharacterLook => ({ ...DEFAULT_LOOK, ...x });

/** Run an animator for `secs` at 60 fps, recording each frame's pose. */
function run(anim: FaceAnimator, secs: number, l: CharacterLook, clip: string | null = null, talking = false) {
  const out = [];
  for (let i = 0; i < secs * 60; i++) out.push({ t: (i + 1) / 60, ...anim.update(1 / 60, l, clip, talking) });
  return out;
}

describe("face layers (avatar v7)", () => {
  it("draws the default face from the atlas: F1.1 both sides, M1.1, no brows", () => {
    const l = look({ hair: 9 });
    const s = faceSlots(l, restPose(l, "neutral"));
    expect(s).toHaveLength(FACE_SLOT_COUNT);
    const extras = FACE_SLOT_COUNT - 3;   // one slot per extra, then the eyes and the mouth
    expect(s.slice(0, extras).every(x => x.src === null)).toBe(true); // no extras on the default look
    const [eyeR, eyeL, mouth] = s.slice(extras);
    // nothing on the face takes the hair colour any more (that was the brows)
    expect(s.some(x => x.tint === PALETTE.hair[9])).toBe(false);
    expect([eyeR.mirror, eyeL.mirror]).toEqual([0, 2]); // the right eye as drawn, the left its mirror image
    expect(eyeR.src).toEqual(eyeL.src);
    const [x, y, w, h] = FACE.layers.eyes.items["F1.1"].open, [W, H] = FACE.atlas_size;
    expect(eyeR.src).toEqual([x / W, y / H, w / W, h / H]);
    expect(mouth.src![0]).toBeCloseTo(FACE.layers.mouth.items["M1.1"][0] / W);
    // each cell is placed so its anchor point sits on the measured anchor
    for (const [sl, a] of [[eyeR, FACE.anchors.eye], [mouth, FACE.anchors.mouth]] as const) {
      expect(sl.dst[0] < a[0] && a[0] < sl.dst[2] && sl.dst[1] < a[1] && a[1] < sl.dst[3]).toBe(true);
    }
  });
  it("adds the extras a look chooses: blush and freckles mirrored, the mole as placed", () => {
    const s = faceSlots(look({ extras: ["blush", "mole", "freckles"] }), restPose(DEFAULT_LOOK, "neutral"));
    expect(s.slice(0, 4).map(x => [x.src !== null, x.mirror])).toEqual([[false, 0], [true, 1], [true, 1], [true, 0]]);
  });
  it("gives each of the six expressions its eyes and mouth, David's set since the wardrobe cut", () => {
    const got = Object.fromEntries(EXPRESSIONS.map(e => [e, restPose(DEFAULT_LOOK, e)]));
    expect(got.neutral).toEqual({ eyes: "F1.1", eyeFrame: "open", mouth: "M1.1" });
    expect([got.happy.eyes, got.happy.mouth]).toEqual(["relieved", "open_smile"]);   // his face 7
    expect([got.surprised.eyes, got.surprised.mouth]).toEqual(["F1.1", "gasp"]);
    expect([got.sad.eyeFrame, got.sad.mouth]).toEqual(["half", "small_frown"]);
    expect(got.angry.mouth).toBe("M2.2");
    expect([got.sleepy.eyes, got.sleepy.mouth]).toEqual(["sleepy", "M3.1"]);
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
    expect([canBlink("F1.1"), canBlink("F1.2"), canBlink("sleepy_lash"), canBlink("relieved")]).toEqual([true, true, false, false]);
    const frames = run(new FaceAnimator(seeded(5)), 20, look({ eyes: "relieved" }));
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
    expect(frames.every(f => f.eyes === "relieved")).toBe(true);
  });
  it("takes a forced face (portraits, the avatar bench)", () => {
    const anim = new FaceAnimator(seeded(2));
    const pose = anim.update(0.016, DEFAULT_LOOK, "Idle", false, { expression: "angry", eyeFrame: "half", mouth: "G3.3" });
    expect([pose.eyeFrame, pose.mouth]).toEqual(["half", "G3.3"]);
  });
});

// Playtest round 1 (David, 2026-10-14): "dont change the face when doing animations, keep it the same". A player's face
// (yours and everyone else's) is the one they set: no clip swaps its expression or its mouth. Blinks carry on, as at rest.
describe("a player's face through every animation", () => {
  const WHEEL = [...EMOTE_RING, ...DANCE_RING].map(e => e.clip);
  const ANIMATIONS = [...new Set([...WHEEL, "SitWarm", "DanceStomp", ...Object.keys(CLIP_EXPRESSION)])];
  const LOOKS = [DEFAULT_LOOK, look({ eyes: "sleepy_lash", mouth: "kitty" }), randomLook(seeded(11)), randomLook(seeded(29))];

  it("stays exactly as set through each emote, dance, sit and sleep", () => {
    for (const l of LOOKS) {
      const rest = restPose(l, "neutral");
      for (const clip of ANIMATIONS) {
        const anim = new FaceAnimator(seeded(7));
        anim.keep = true;
        for (const f of run(anim, 3, l, clip)) {
          expect([f.eyes, f.mouth], `${clip} on ${l.eyes}/${l.mouth}`).toEqual([rest.eyes, rest.mouth]);
          // Only a blink closes the eyes, as at rest.
          if (f.eyeFrame !== rest.eyeFrame) expect(canBlink(rest.eyes)).toBe(true);
        }
      }
    }
  });
  it("blinks exactly as it would standing still", () => {
    const still = new FaceAnimator(seeded(9)), dancing = new FaceAnimator(seeded(9));
    dancing.keep = true;
    expect(run(dancing, 20, DEFAULT_LOOK, "DanceBounce")).toEqual(run(still, 20, DEFAULT_LOOK));
  });
  it("still talks, and still takes a forced face", () => {
    const anim = new FaceAnimator(seeded(3));
    anim.keep = true;
    expect(new Set(run(anim, 2, DEFAULT_LOOK, "Cheer", true).map(f => f.mouth)).size).toBeGreaterThan(2);
    const forced = anim.update(0.016, DEFAULT_LOOK, "Cheer", false, { expression: "happy" });
    expect([forced.eyes, forced.mouth]).toEqual(["relieved", "open_smile"]);
  });
  it("leaves the residents' faces to their clips", () => {
    const frames = run(new FaceAnimator(seeded(1)), 1, DEFAULT_LOOK, "Cheer");
    expect(frames.every(f => f.eyes === "relieved")).toBe(true);
  });
});

describe("row 301 face set (face_set_301.py: sleepy and dot eyes, the blush band; its two mouths were cut)", () => {
  const EYES = ["sleepy_lash", "dot"], MOUTHS = ["M3.3", "G3.3"], EXTRAS = ["blush_band"];   // older mouths to wear with them
  const src = (c: FaceCell) => { const [W, H] = FACE.atlas_size; return [c[0] / W, c[1] / H, c[2] / W, c[3] / H]; };

  it("are creator options with names, packed in a band below every earlier cell", () => {
    for (const id of EYES) expect(Object.keys(FACE.layers.eyes.items[id]), id).toEqual(["open"]); // static: no blink frames
    for (const id of EXTRAS) expect(FACE.layers.extras.items[id], id).toMatchObject({ anchor: "blush", mirror: false });
    for (const id of [...EYES, ...EXTRAS]) expect(FACE.names[id], id).toBeDefined();
    expect(["cat_w", "grin_curl"].some(id => id in FACE.layers.mouth.items || id in FACE.names)).toBe(false);
    const set = new Set([...EYES, ...EXTRAS]);
    const cells = [
      ...Object.entries(FACE.layers.eyes.items).flatMap(([id, f]) => Object.values(f).filter(c => c).map(c => [id, c!] as const)),
      ...Object.entries(FACE.layers.mouth.items), ...Object.entries(FACE.layers.talk.items),
      ...Object.entries(FACE.layers.extras.items).map(([id, it]) => [id, it.cell] as const),
    ];
    const legacyBottom = Math.max(...cells.filter(([id, c]) => !set.has(id) && !c[6]).map(([, c]) => c[1] + c[3]));   // first page
    for (const [id, c] of cells) if (set.has(id)) expect(c[1], id).toBeGreaterThan(legacyBottom);
  });

  it("parse and survive a save round trip; old looks are unchanged", () => {
    for (const eyes of EYES) for (const mouth of MOUTHS) {
      const saved = { ...DEFAULT_LOOK, eyes, mouth, extras: ["blush_band", "freckles"] };
      const look = parseLook(JSON.parse(JSON.stringify(saved)));
      expect(look).toEqual(saved);
      expect(parseLook(JSON.parse(JSON.stringify(look)))).toEqual(look);
    }
    const old = { ...DEFAULT_LOOK, eyes: "F1.2", mouth: "G3.3", extras: ["blush", "mole"] };
    expect(parseLook(JSON.parse(JSON.stringify(old)))).toEqual(old);
  });

  it("render their own cells: each id lands in its slot at its anchor", () => {
    const l = look({ eyes: "sleepy_lash", mouth: "M3.3", extras: ["blush_band"] });
    const s = faceSlots(l, restPose(l, "neutral"));
    const band = s[0], [eyeR, eyeL, mouth] = s.slice(-3);
    expect(band.src).toEqual(src(FACE.layers.extras.items.blush_band.cell));
    expect(band.mirror).toBe(0); // one centred band across both cheeks
    expect(eyeR.src).toEqual(src(FACE.layers.eyes.items.sleepy_lash.open));
    expect([eyeR.mirror, eyeL.mirror, eyeL.src]).toEqual([0, 2, eyeR.src]);
    expect(mouth.src).toEqual(src(FACE.layers.mouth.items["M3.3"]));
    const a = FACE.anchors.blush;
    expect(band.dst[0] < a[0] && a[0] < band.dst[2] && band.dst[1] < a[1] && a[1] < band.dst[3]).toBe(true);
    expect(band.dst[0] < FACE.anchors.eye[0] && band.dst[2] > 1 - FACE.anchors.eye[0]).toBe(true); // reaches under both eyes
    const d = faceSlots(look({ eyes: "dot", mouth: "G3.3" }), restPose(look({ eyes: "dot", mouth: "G3.3" }), "neutral"));
    expect([d.at(-3)!.src, d.at(-1)!.src]).toEqual([src(FACE.layers.eyes.items.dot.open), src(FACE.layers.mouth.items["G3.3"])]);
  });

  it("stay static: the new eyes never blink and an idle face keeps its mouth", () => {
    for (const eyes of EYES) {
      expect(canBlink(eyes), eyes).toBe(false);
      const frames = run(new FaceAnimator(seeded(4)), 20, look({ eyes, mouth: "G3.3" }));
      expect(frames.every(f => f.eyes === eyes && f.eyeFrame === "open" && f.mouth === "G3.3")).toBe(true);
    }
  });

  it("are never rolled for random looks, so seeded residents keep the faces they had", () => {
    const set = new Set([...EYES, ...EXTRAS]);
    for (let i = 0; i < 300; i++) {
      const l = randomLook(seeded(i));
      expect(set.has(l.eyes) || l.extras.some(x => set.has(x)), String(i)).toBe(false);
    }
  });
});

describe("David's 19 faces (face set 305, art/characters/v7/face_set_305.py)", () => {
  const EYES = ["bean", "daze", "half_lid", "swirl", "mochi", "shy", "relieved", "chill", "tiny_dots", "stare", "offset", "unimpressed", "close_dots", "teary", "doll_lash", "nervous", "focused", "sleepy", "square_dots"];
  const MOUTHS = ["little_v", "drumstick", "drool", "gritted", "pout", "tiny_smirk", "open_smile", "small_frown", "pill", "deadpan", "dash", "side_smirk", "long_drool", "nervous_laugh", "tiny_mouth", "gasp", "kitty", "tired_drool", "buck_tooth"];
  const ACCENTS = ["nose_blush", "sweat_drop"];
  const SET = new Set([...EYES, ...MOUTHS, ...ACCENTS]);
  // wardrobe batch 2's faces #20-25 (face_set_b2.py) joined later, below this set's band
  const B2 = new Set(Object.values(FACE.faces).flatMap(f => [f.eyes, f.mouth, ...f.extras].filter((x): x is string => !!x)));
  const NEW = new Set([...SET, ...B2, "brow_none"]);
  const page2 = (c: FaceCell) => { const [W, H] = FACE.atlas2_size; return [c[0] / W, c[1] / H, c[2] / W, c[3] / H]; };

  it("are creator options with short names, on the second atlas page, and static", () => {
    for (const id of EYES) {
      const item = FACE.layers.eyes.items[id];
      expect(item, id).toBeDefined();
      expect(Object.keys(item).every(f => f === "open" || f === "left"), id).toBe(true);   // no blink frames
      for (const c of Object.values(item)) if (c) expect(c[6], id).toBe(1);
      expect(canBlink(id), id).toBe(false);
    }
    for (const id of MOUTHS) expect(FACE.layers.mouth.items[id]?.[6], id).toBe(1);
    for (const id of ACCENTS) expect(FACE.layers.extras.items[id]?.cell[6], id).toBe(1);
    for (const id of SET) {
      expect(FACE.names[id], id).toMatch(/^[A-Z][a-z -]+$/);       // short friendly names, no item numbers
      expect(FACE.names[id].length, id).toBeLessThanOrEqual(14);
    }
    expect(new Set(Object.values(FACE.names)).size).toBe(Object.keys(FACE.names).length);
    // batch 3 widened the second page (its own columns on the right) rather than run it past 4,096 px down
    for (const [W, H] of [FACE.atlas_size, FACE.atlas2_size]) expect(W <= 4096 && H <= 4096).toBe(true);
  });

  it("keep every earlier cell, anchor and the first page as the wardrobe cut left them (kept looks draw the same)", () => {
    const keep = <T,>(items: Record<string, T>) => Object.fromEntries(Object.entries(items).filter(([id]) => !NEW.has(id)));
    const legacy = {
      anchors: Object.fromEntries((["eye", "brow", "mouth", "cheek", "mole", "blush"] as const).map(k => [k, FACE.anchors[k]])),
      atlas_size: FACE.atlas_size, density: FACE.density,
      layers: Object.fromEntries(Object.entries(FACE.layers).map(([l, v]) => [l, keep(v.items as Record<string, unknown>)])),
    };
    // the earlier layers after the wardrobe cut repacked the first page (playtest round 1; the set's own cells unchanged)
    expect(createHash("sha256").update(JSON.stringify(legacy)).digest("hex")).toBe("270719a91c09c0a0d2225454ef04db02c9d003f7d551b13017f6e9fa406056cd");
    const atlas = (f: string) => createHash("sha256").update(readFileSync(join(__dirname, "../../../public", f))).digest("hex");
    expect(atlas(FACE_ATLAS_URLS.creator)).toBe("211ea82a9da577f555f9cb8b5e4527e44824c503f683279e1a2899c5fa9f67a8");
    expect(atlas(FACE_ATLAS_URLS.world)).toBe("b78f199b24d5b6ea02fb56db25efab28cc4250ca004a35a467c0b949162bbd54");
    // an old look's own slots all read the first page; every character still loads the second for its expressions
    const old = look({ eyes: "F1.2", mouth: "G3.3", extras: ["blush", "mole", "blush_band", "freckles"] });
    expect(faceSlots(old, restPose(old, "neutral")).every(s => s.page === 0)).toBe(true);
    expect([usesFacePage2(old), usesFacePage2(DEFAULT_LOOK)]).toEqual([true, true]);
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
      else if (item.left === null) expect(eyeL.src).toBeNull();                                  // the pair in one cell
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
    // since the wardrobe cut the expressions are David's too (the second page); talking keeps the first page's talk cells
    const l = look({ eyes: "swirl", mouth: "drool" });
    const happy = faceSlots(l, restPose(l, "happy"));
    expect(happy.slice(-3).map(x => x.page)).toEqual([1, 1, 1]);
    for (const t of FACE.talk.frames) expect(FACE.layers.talk.items[t][6] ?? 0, t).toBe(0);
  });

  it("draw with their own eyes and mouth, no brows over them (eyebrows were removed)", () => {
    const l = look({ eyes: "swirl", mouth: "gritted" });
    const s = faceSlots(l, restPose(l, "neutral"));
    expect(s).toHaveLength(FACE_SLOT_COUNT);
    // the eyes (one cell or two) and the mouth draw; before them only the extras' slots, all off on this look
    expect(s.slice(0, FACE_SLOT_COUNT - 3).every(x => x.src === null)).toBe(true);
    expect([s.at(-3)!.src, s.at(-1)!.src].every(Boolean)).toBe(true);
  });

  it("are never rolled for random looks, so residents and bots keep their faces", () => {
    for (let i = 0; i < 300; i++) {
      const l = randomLook(seeded(i));
      expect(SET.has(l.eyes) || SET.has(l.mouth) || l.extras.some(x => SET.has(x)), String(i)).toBe(false);
    }
  });
});

describe("expressions and emote mouths after the wardrobe cut (playtest round 1)", () => {
  it("keep their mood in David's set: Laugh and Cheer open wide, Dance bops to a little v", () => {
    expect(FACE.emoteMouth.Laugh.frames).toEqual(["open_smile", "gasp"]);
    expect(FACE.emoteMouth.Cheer.frames).toEqual(["open_smile", "gasp"]);
    expect(FACE.emoteMouth.Dance.frames).toEqual(["open_smile", "little_v"]);
    for (const [clip, m] of Object.entries(FACE.emoteMouth)) for (const f of m.frames) expect(FACE.layers.mouth.items[f]?.[6], `${clip} ${f}`).toBe(1);
    const dance = run(new FaceAnimator(seeded(6)), 2, DEFAULT_LOOK, "Dance");
    expect(new Set(dance.map(f => f.mouth))).toEqual(new Set(["open_smile", "little_v"]));
  });
  it("load the second page for every character, so a laugh never shows an empty mouth", () => {
    for (let i = 0; i < 20; i++) expect(usesFacePage2(randomLook(seeded(i))), String(i)).toBe(true);
    for (const e of EXPRESSIONS) for (const sl of faceSlots(DEFAULT_LOOK, restPose(DEFAULT_LOOK, e))) if (sl.page === 1) expect(sl.src).not.toBeNull();
  });
});

describe("David's faces #20-25 (wardrobe batch 2, art/characters/v7/face_set_b2.py)", () => {
  const faces = Object.entries(FACE.faces).filter(([key]) => Number(key.slice(5)) <= 25).map(([, f]) => f);
  const page2 = (c: FaceCell) => { const [W, H] = FACE.atlas2_size; return [c[0] / W, c[1] / H, c[2] / W, c[3] / H]; };
  const cells = faces.flatMap(f => [
    ...Object.values(FACE.layers.eyes.items[f.eyes]).filter((c): c is FaceCell => !!c),
    ...(f.mouth ? [FACE.layers.mouth.items[f.mouth]] : []), ...f.extras.map(x => FACE.layers.extras.items[x].cell)]);

  it("are six whole faces on the second page, packed below every earlier cell, static", () => {
    expect(faces.map(f => f.id)).toEqual(["silly_cat", "silly", "silly_smile", "tired", "weirdcore_eyes", "vampire"]);
    const earlier = Object.entries(FACE.layers.eyes.items).filter(([id]) => !faces.some(f => f.eyes === id)).flatMap(([, it]) => Object.values(it))
      .concat(Object.entries(FACE.layers.mouth.items).filter(([id]) => !faces.some(f => f.mouth === id)).map(([, c]) => c))
      .filter((c): c is FaceCell => !!c && c[6] === 1 && c[0] < 2048);   // batch 3 sits in its own columns to the right
    const band = Math.max(...earlier.map(c => c[1] + c[3]));
    for (const c of cells) {
      expect(c[6]).toBe(1);
      expect(c[1]).toBeGreaterThanOrEqual(band);
      expect(c[1] + c[3]).toBeLessThanOrEqual(FACE.atlas2_size[1]);
    }
    for (const f of faces) expect(canBlink(f.eyes), f.eyes).toBe(false);
  });
  it("draw each face's own cells at their anchors, and mix with any other part", () => {
    for (const f of faces) {
      const l = look({ eyes: f.eyes, mouth: f.mouth ?? "M1.1", extras: f.extras });
      const s = faceSlots(l, restPose(l, "neutral"));
      const [eyeR, , mouth] = s.slice(-3);
      expect([eyeR.src, eyeR.page]).toEqual([page2(FACE.layers.eyes.items[f.eyes].open), 1]);
      if (f.mouth) expect(mouth.src).toEqual(page2(FACE.layers.mouth.items[f.mouth]));
      for (const sl of s) if (sl.src) expect(sl.dst[0] < 1 && sl.dst[2] > 0 && sl.dst[1] < 1 && sl.dst[3] > 0).toBe(true);
      expect(parseLook(JSON.parse(JSON.stringify(l)))).toEqual(l);
    }
    const mixed = parseLook({ ...DEFAULT_LOOK, eyes: "caret_hash", mouth: "M1.1", extras: ["nose_shade", "blush"] });
    expect([mixed.eyes, mixed.mouth, mixed.extras]).toEqual(["caret_hash", "M1.1", ["nose_shade", "blush"]]);
  });
});

describe("David's face fit (the fit editor: catalogue `fit`, eyes and mouth lifts in face canvas units)", () => {
  // the tests set their own fits: each starts from none, and the catalogue's go back after
  const saved = { ...FIT };
  beforeEach(() => { for (const k in FIT) delete FIT[k]; });
  afterEach(() => { for (const k in FIT) delete FIT[k]; Object.assign(FIT, saved); });
  const f = Object.values(FACE.faces).find(x => x.mouth)!;
  const l = look({ eyes: f.eyes, mouth: f.mouth!, extras: f.extras });
  const slots = (pose = restPose(l, "neutral"), x = l) => faceSlots(x, pose).slice(-3);
  const shift = (a: number[], b: number[]) => [a[1] - b[1], a[3] - b[3]];
  const lifted = <T,>(eyes: number, mouth: number, run: () => T): T => {
    FIT[f.id] = { eyes, mouth };
    try { return run(); } finally { delete FIT[f.id]; }
  };

  it("moves the face's eyes and mouth up the canvas by exactly their lifts, each on its own", () => {
    const before = slots();
    const after = lifted(0.03, -0.02, () => slots());
    for (const i of [0, 1]) if (before[i].src) {
      expect(shift(before[i].dst, after[i].dst).map(v => +v.toFixed(9))).toEqual([0.03, 0.03]);
      expect(+(before[i].pose[1] - after[i].pose[1]).toFixed(9)).toBe(0.03);
    }
    expect(shift(before[2].dst, after[2].dst).map(v => +v.toFixed(9))).toEqual([-0.02, -0.02]);
    expect(after.map(s => s.src)).toEqual(before.map(s => s.src));
  });
  it("moves every frame with them: an expression's eyes and mouth, and the talking mouths", () => {
    const happy = restPose(l, "happy");
    const [b, a] = [slots(happy), lifted(0.02, 0.01, () => slots(happy))];
    expect(+(b[0].dst[1] - a[0].dst[1]).toFixed(9)).toBe(0.02);
    expect(+(b[2].dst[1] - a[2].dst[1]).toFixed(9)).toBe(0.01);
    for (const talk of FACE.talk.frames) {
      const pose = { ...restPose(l, "neutral"), mouth: talk };
      expect(+(slots(pose)[2].dst[1] - lifted(0, 0.01, () => slots(pose))[2].dst[1]).toFixed(9)).toBe(0.01);
    }
  });
  it("starts the creator's sliders from the lifted place", () => {
    const placed = look({ ...l, place: { mouth: [2, 0, 0, 0] } });
    const [b, a] = [slots(restPose(placed, "neutral"), placed), lifted(0, 0.01, () => slots(restPose(placed, "neutral"), placed))];
    expect(+(b[2].dst[1] - a[2].dst[1]).toFixed(9)).toBe(0.01);
  });
  it("moves every face's eyes apart symmetrically by eyesApart each, every frame, and leaves their height and the mouth", () => {
    // each eye's drawn box (the second of a mirrored pair is drawn mirrored) and its centre
    const box = (s: FaceSlot) => (s.mirror === 2 ? [1 - s.dst[2], s.dst[1], 1 - s.dst[0], s.dst[3]] : s.dst);
    const centre = (s: FaceSlot) => (box(s)[0] + box(s)[2]) / 2;
    let pairs = 0;
    for (const face of Object.values(FACE.faces)) {
      const x = look({ eyes: face.eyes, mouth: face.mouth ?? DEFAULT_LOOK.mouth, extras: face.extras });
      const at = (pose: ReturnType<typeof restPose>) => faceSlots(x, pose).slice(-3);
      const apart = (pose: ReturnType<typeof restPose>) => { FIT[face.id] = { eyesApart: 0.02 }; try { return at(pose); } finally { delete FIT[face.id]; } };
      for (const pose of [restPose(x, "neutral"), restPose(x, "happy"), { ...restPose(x, "neutral"), eyeFrame: "closed" as const }]) {
        const [b, a] = [at(pose), apart(pose)];
        if (!b[1].src) { expect(a).toEqual(b); continue; }                 // one cell across the centre line: no apart
        pairs++;
        const sides = [0, 1].map(i => Math.sign(centre(b[i]) - 0.5));
        expect(sides[0] * sides[1], face.id).toBe(-1);
        for (const i of [0, 1]) {
          expect(+((centre(a[i]) - centre(b[i])) * sides[i]).toFixed(9), face.id).toBe(0.02);
          expect(+(a[i].dst[1] - b[i].dst[1]).toFixed(9), face.id).toBe(0);
        }
        expect(a[2]).toEqual(b[2]);
      }
    }
    expect(pairs).toBeGreaterThan(10);
  });
  it("scales every face's eyes and mouth about their anchors by exactly eyesSize and mouthSize, every frame, each on its own", () => {
    // a slot's rect from its pivot, which a size leaves where it was
    const rel = (s: FaceSlot) => [s.dst[0] - s.pose[0], s.dst[1] - s.pose[1], s.dst[2] - s.pose[0], s.dst[3] - s.pose[1]];
    const scaled = (b: FaceSlot, a: FaceSlot, k: number, id: string) => {
      expect(a.pose.map(v => +v.toFixed(9)), id).toEqual(b.pose.map(v => +v.toFixed(9)));
      expect(Math.max(...rel(a).map((v, i) => Math.abs(v - rel(b)[i] * k))), id).toBeLessThan(1e-12);
      expect(a.src, id).toEqual(b.src);
    };
    let eyes = 0, mouths = 0;
    for (const face of Object.values(FACE.faces)) {
      const x = look({ eyes: face.eyes, mouth: face.mouth ?? DEFAULT_LOOK.mouth, extras: face.extras });
      const at = (pose: ReturnType<typeof restPose>, fit = {}) => { FIT[face.id] = fit; try { return faceSlots(x, pose).slice(-3); } finally { delete FIT[face.id]; } };
      for (const pose of [restPose(x, "neutral"), restPose(x, "happy"), { ...restPose(x, "neutral"), eyeFrame: "closed" as const }]) {
        // after the lifts and the spacing: about the moved anchor
        const moved = { eyes: 0.01, eyesApart: 0.01, mouth: -0.01 }, b = at(pose, moved);
        const e = at(pose, { ...moved, eyesSize: 1.3 });
        for (const i of [0, 1]) if (b[i].src) { scaled(b[i], e[i], 1.3, face.id); eyes++; }
        expect(e[2], face.id).toEqual(b[2]);
        if (!face.mouth) continue;
        const m = at(pose, { ...moved, mouthSize: 0.6 });
        scaled(b[2], m[2], 0.6, face.id);
        expect(m.slice(0, 2), face.id).toEqual(b.slice(0, 2));
        mouths++;
      }
    }
    expect(eyes).toBeGreaterThan(40);
    expect(mouths).toBeGreaterThan(20);
  });
  it("sizes before the creator's sliders: their size multiplies it", () => {
    const sized = look({ ...l, place: { mouth: [0, 0, 0, 1] } }), pose = restPose(sized, "neutral");
    const width = (s: FaceSlot) => s.dst[2] - s.dst[0];
    const [b, a] = [slots(pose, sized), (() => { FIT[f.id] = { mouthSize: 1.1 }; try { return slots(pose, sized); } finally { delete FIT[f.id]; } })()];
    expect(width(b[2])).toBeGreaterThan(width(slots(restPose(l, "neutral"))[2]));
    expect(+(width(a[2]) / width(b[2])).toFixed(9)).toBe(1.1);
  });
  it("leaves every other face exactly as it was, and a face without a lift unchanged", () => {
    const other = look();
    expect(lifted(0.03, 0.03, () => slots(restPose(other, "neutral"), other))).toEqual(slots(restPose(other, "neutral"), other));
    FIT[f.id] = { eyesSize: 1.4, mouthSize: 0.7 };
    try { expect(slots(restPose(other, "neutral"), other)).toEqual(lifted(0, 0, () => slots(restPose(other, "neutral"), other))); } finally { delete FIT[f.id]; }
    expect(lifted(0, 0, () => slots())).toEqual(slots());
  });
});

describe("David's faces #26-32 (wardrobe batch 3, art/characters/v7/face_set_b3.py)", () => {
  const faces = Object.entries(FACE.faces).filter(([key]) => Number(key.slice(5)) >= 26);
  const page2 = (c: FaceCell) => { const [W, H] = FACE.atlas2_size; return [c[0] / W, c[1] / H, c[2] / W, c[3] / H]; };

  it("are six whole faces (#30 moody removed, David 2026-10-27), priced, in their own columns right of the second page's earlier cells, static", () => {
    expect(faces.map(([key, f]) => `${key} ${f.id}`)).toEqual(["face-26 squiggle", "face-27 zombie", "face-28 big_eyes", "face-29 crying", "face-31 dizzy", "face-32 wink"]);
    for (const [key, f] of faces) {
      expect(BATCH2_PRICES[key], key).toBeDefined();               // David priced them on the shelf page, 2026-10-27
      const cells = [...Object.values(FACE.layers.eyes.items[f.eyes]).filter((c): c is FaceCell => !!c),
        ...(f.mouth ? [FACE.layers.mouth.items[f.mouth]] : []), ...f.extras.map(x => FACE.layers.extras.items[x].cell)];
      for (const c of cells) {
        expect(c[6], f.id).toBe(1);
        expect(c[0], f.id).toBeGreaterThanOrEqual(2048);
        expect(c[0] + c[2] <= FACE.atlas2_size[0] && c[1] + c[3] <= FACE.atlas2_size[1], f.id).toBe(true);
      }
      expect(canBlink(f.eyes), f.eyes).toBe(false);
    }
  });
  it("draw each face's own cells at their anchors, from the second page", () => {
    for (const [, f] of faces) {
      const l = look({ eyes: f.eyes, mouth: f.mouth ?? "M1.1", extras: f.extras });
      const s = faceSlots(l, restPose(l, "neutral"));
      const [eyeR, , mouth] = s.slice(-3);
      expect([eyeR.src, eyeR.page]).toEqual([page2(FACE.layers.eyes.items[f.eyes].open), 1]);
      if (f.mouth) expect(mouth.src).toEqual(page2(FACE.layers.mouth.items[f.mouth]));
      expect(parseLook(JSON.parse(JSON.stringify(l)))).toEqual(l);
    }
  });
});
