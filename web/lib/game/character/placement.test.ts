import { describe, expect, it } from "vitest";
import { EXPRESSIONS, FACE_AREA, PLACE_RANGE, faceSlots, restPose, slotBounds, type FaceSlot } from "./face";
import { DEFAULT_LOOK, FACE, PARTS, PALETTE, PLACE_STEPS, lookBytes, parseLook, randomLook, seeded, type CharacterLook, type PlacePart, type Placement } from "./look";
import { LOOK_MAX_BYTES } from "@/lib/net/protocol";

const look = (x: Partial<CharacterLook> = {}): CharacterLook => ({ ...DEFAULT_LOOK, ...x });
const slots = (l: CharacterLook, expression: (typeof EXPRESSIONS)[number] = "neutral") => faceSlots(l, restPose(l, expression));
/** Slot indices: brows 4, the right eye 5 (canvas left), its mirror 6, the mouth 7. */
const BROWS = 4, EYE = 5, EYE_MIRROR = 6, MOUTH = 7;
const S = PLACE_STEPS;

describe("face placement: the creator's sliders as look data", () => {
  it("parses placement per part as whole steps, clamped to the slider range; the mouth has no spacing", () => {
    const l = parseLook({ ...DEFAULT_LOOK, place: { eyes: [3, -2, 4.4, 99], brows: [-99, 7, 0, -3], mouth: [2, 9, -1, 1] } });
    expect(l.place).toEqual({ eyes: [3, -2, 4, S], brows: [-S, 7, 0, -3], mouth: [2, 0, -1, 1] });
  });
  it("drops garbage and parts left where they were, so a look only carries what moved", () => {
    expect(parseLook({ ...DEFAULT_LOOK, place: { eyes: [0, 0, 0, 0], brows: "up", mouth: [1, 2], nose: [1, 1, 1, 1] } }).place).toBeUndefined();
    expect(parseLook({ ...DEFAULT_LOOK, place: { eyes: [0, 0, 0, 0], mouth: [0, 0, 0, 2] } }).place).toEqual({ mouth: [0, 0, 0, 2] });
    expect(parseLook({ ...DEFAULT_LOOK, place: [1, 2, 3] }).place).toBeUndefined();
    expect(parseLook({ ...DEFAULT_LOOK, place: { eyes: ["1", null, NaN, Infinity] } }).place).toBeUndefined();
  });
  it("survives a save round trip", () => {
    const saved = look({ place: { eyes: [-4, 3, 2, -1], brows: [2, -1, -5, 3], mouth: [-2, 0, 1, 4] } });
    expect(parseLook(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });
});

describe("old looks are unchanged", () => {
  const OLD = [
    DEFAULT_LOOK,
    look({ eyes: "E5.5", mouth: "G2.3", brows: "brow_flat", extras: ["blush", "mole"], hair: 9 }),
    ...Array.from({ length: 40 }, (_, i) => randomLook(seeded(i))),
  ];
  it("parse to exactly what they were: no placement field appears", () => {
    for (const old of OLD) {
      const parsed = parseLook(JSON.parse(JSON.stringify(old)));
      expect(parsed).toEqual(old);
      expect("place" in parsed).toBe(false);
      expect(JSON.stringify(parsed)).toBe(JSON.stringify(old));
    }
  });
  it("draw the face exactly as before: no placement and zero placement give the same slots, for every expression", () => {
    for (const old of OLD) for (const e of EXPRESSIONS) {
      expect(slots(look({ ...old, place: { eyes: [0, 0, 0, 0], brows: [0, 0, 0, 0], mouth: [0, 0, 0, 0] } }), e)).toEqual(slots(old, e));
    }
  });
  it("keep today's anchors: the default eye, brow and mouth sit on face_v7.json's anchors at its density", () => {
    const s = slots(DEFAULT_LOOK), k = 1 / FACE.density;
    const [, , w, h, ax, ay] = FACE.layers.eyes.items["F1.1"].open;
    const [u0, w0] = [FACE.anchors.eye[0] - ax * k, FACE.anchors.eye[1] - ay * k];
    expect(s[EYE].dst).toEqual([u0, w0, u0 + w * k, w0 + h * k]);
    expect(s[EYE].pose).toEqual([FACE.anchors.eye[0], FACE.anchors.eye[1], 0, 0]);
    expect(s[MOUTH].pose).toEqual([FACE.anchors.mouth[0], FACE.anchors.mouth[1], 0, 0]);
  });
});

describe("placement moves each part in the face shader's own slot data (no new uniforms)", () => {
  const base = slots(DEFAULT_LOOK);
  const centre = (d: FaceSlot["dst"]) => [(d[0] + d[2]) / 2, (d[1] + d[3]) / 2];
  it("Down–Up moves the part up the face (W runs down)", () => {
    const s = slots(look({ place: { eyes: [4, 0, 0, 0], mouth: [-4, 0, 0, 0] } }));
    expect(centre(s[EYE].dst)[1]).toBeCloseTo(centre(base[EYE].dst)[1] - (4 / S) * PLACE_RANGE.up);
    expect(centre(s[MOUTH].dst)[1]).toBeCloseTo(centre(base[MOUTH].dst)[1] + (4 / S) * PLACE_RANGE.up);
    expect(s[EYE].src).toEqual(base[EYE].src);
  });
  it("Left–Right spaces the pair: the drawn eye moves out from the centre line and its mirror follows", () => {
    const s = slots(look({ place: { eyes: [0, 5, 0, 0], brows: [0, -5, 0, 0] } }));
    expect(centre(s[EYE].dst)[0]).toBeCloseTo(centre(base[EYE].dst)[0] - (5 / S) * PLACE_RANGE.apart);
    expect([s[EYE].mirror, s[EYE_MIRROR].mirror]).toEqual([0, 2]);
    expect(s[EYE_MIRROR].dst).toEqual(s[EYE].dst); // the shader mirrors the same rect
    expect(centre(s[BROWS].dst)[0]).toBeCloseTo(centre(base[BROWS].dst)[0] + (5 / S) * PLACE_RANGE.apart);
  });
  it("Smaller–Bigger scales the cell about its anchor; Rotate adds to the tilt (the brows keep their expression)", () => {
    const s = slots(look({ place: { mouth: [0, 0, 0, S], brows: [0, 0, 3, 0] } }));
    const width = (d: FaceSlot["dst"]) => d[2] - d[0];
    expect(width(s[MOUTH].dst) / width(base[MOUTH].dst)).toBeCloseTo(PLACE_RANGE.size);
    expect(s[MOUTH].pose.slice(0, 2)).toEqual(base[MOUTH].pose.slice(0, 2));
    const sad = slots(look({ place: { brows: [0, 0, 3, 0] } }), "sad"), sadBase = slots(DEFAULT_LOOK, "sad");
    expect(sad[BROWS].pose[3] - sadBase[BROWS].pose[3]).toBeCloseTo(((3 / S) * PLACE_RANGE.rotate * Math.PI) / 180);
    expect(sad[BROWS].pose[2]).toBe(sadBase[BROWS].pose[2]);
  });
});

describe("clamping: placed parts never leave the face area", () => {
  const EXTREMES = [-S, 0, S];
  const all: Placement[] = EXTREMES.flatMap(a => EXTREMES.flatMap(b => EXTREMES.flatMap(c => EXTREMES.map(d => [a, b, c, d] as Placement))));
  const within = (b: number[], area: number[], what: string) => {
    expect(b[0], `${what} left`).toBeGreaterThanOrEqual(area[0] - 1e-9);
    expect(b[1], `${what} top`).toBeGreaterThanOrEqual(area[1] - 1e-9);
    expect(b[2], `${what} right`).toBeLessThanOrEqual(area[2] + 1e-9);
    expect(b[3], `${what} bottom`).toBeLessThanOrEqual(area[3] + 1e-9);
  };
  /** The area a part may use: the face area, or wider where today's default already reaches (it never moves an old look). */
  const allowed = (s: FaceSlot) => { const d = slotBounds(s); return [Math.min(FACE_AREA[0], d[0]), Math.min(FACE_AREA[1], d[1]), Math.max(FACE_AREA[2], d[2]), Math.max(FACE_AREA[3], d[3])]; };
  const cases: { part: PlacePart; ids: string[]; slot: number; field: "eyes" | "brows" | "mouth"; pair: boolean }[] = [
    { part: "eyes", ids: Object.keys(FACE.layers.eyes.items), slot: EYE, field: "eyes", pair: true },
    { part: "brows", ids: Object.keys(FACE.layers.brows.items), slot: BROWS, field: "brows", pair: true },
    { part: "mouth", ids: Object.keys(FACE.layers.mouth.items), slot: MOUTH, field: "mouth", pair: false },
  ];
  for (const c of cases) it(`${c.part}: every style at every slider extreme stays on the face${c.pair ? ", each side of the centre line" : ""}`, () => {
    for (const id of c.ids) {
      const plain = look({ [c.field]: id });
      const area = allowed(slots(plain)[c.slot]);
      for (const p of all) for (const e of ["neutral", "surprised", "sad"] as const) {
        const l = parseLook({ ...plain, place: { [c.part]: p } });
        const s = slots(l, e)[c.slot];
        const b = slotBounds(s);
        within(b, area, `${id} ${p} ${e}`);
        if (c.pair) expect(b[2], `${id} ${p} crosses the centre line`).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    }
  });
  it("talking mouths (bigger cells) are clamped too", () => {
    const l = look({ place: { mouth: [-S, 0, S, S] } });
    for (const t of Object.keys(FACE.layers.talk.items)) {
      const s = faceSlots(l, { eyes: l.eyes, eyeFrame: "open", mouth: t, brow: [0, 0] })[MOUTH];
      within(slotBounds(s), [FACE_AREA[0], FACE_AREA[1], FACE_AREA[2], Math.max(FACE_AREA[3], slotBounds(faceSlots(DEFAULT_LOOK, { eyes: "F1.1", eyeFrame: "open", mouth: t, brow: [0, 0] })[MOUTH])[3])], t);
    }
  });
});

describe("the look stays within the multiplayer card's 2 KB (realtime_player_card, specs/multiplayer.md)", () => {
  const longest = (ids: string[]) => ids.reduce((a, b) => (b.length > a.length ? b : a));
  const outfitTinted = PARTS.filter(p => p.materials.some(m => m.tint === "outfit"));
  /** The fullest look the creator and wardrobe can save: the longest ids, every extra, an accessory in every group, a colour on every recolourable part, every slider at its widest. */
  const fullest = (): CharacterLook => {
    const accs = Object.fromEntries((["face", "head", "bag", "neck"] as const).map(g => [g, longest(PARTS.filter(p => p.group === g).map(p => p.id))]));
    return look({
      skin: PALETTE.skin.length - 1, hair: PALETTE.hair.length - 1,
      eyes: longest(Object.keys(FACE.layers.eyes.items)), mouth: longest(Object.keys(FACE.layers.mouth.items)), brows: longest(Object.keys(FACE.layers.brows.items)),
      extras: Object.keys(FACE.layers.extras.items), bangs: longest(PARTS.filter(p => p.slot === "bangs").map(p => p.id)), back: longest(PARTS.filter(p => p.slot === "back").map(p => p.id)),
      top: longest(PARTS.filter(p => p.slot === "top").map(p => p.id)), bottom: longest(PARTS.filter(p => p.slot === "bottom").map(p => p.id)),
      shoes: longest(PARTS.filter(p => p.slot === "shoes").map(p => p.id)), acc: accs,
      colors: Object.fromEntries(outfitTinted.map(p => [p.id, PALETTE.outfit.length - 1])),
      place: { eyes: [-S, -S, -S, -S], brows: [-S, -S, -S, -S], mouth: [-S, 0, -S, -S] },
    });
  };
  it("measures the size the card measures: jsonb text, with its spaces", () => {
    expect(lookBytes({ a: [1, 2], b: "x, y: z" } as unknown as CharacterLook)).toBe('{"a": [1, 2], "b": "x, y: z"}'.length);
  });
  it("the fullest look fits, placement included", () => {
    const full = parseLook(fullest());
    expect(full.place).toBeDefined();
    expect(lookBytes(full)).toBeLessThanOrEqual(LOOK_MAX_BYTES);
  });
  it("a look over the cap sheds the colours of parts it isn't wearing, never what it shows", () => {
    const big = { ...fullest(), colors: Object.fromEntries(PARTS.map(p => [p.id, PALETTE.outfit.length - 1])) };
    for (let i = 0; i < 60; i++) big.colors[PARTS[i % PARTS.length].id] = 10; // every part, recoloured
    const parsed = parseLook(big);
    expect(lookBytes(parsed)).toBeLessThanOrEqual(LOOK_MAX_BYTES);
    for (const id of [parsed.top, parsed.bottom, parsed.shoes, ...Object.values(parsed.acc)]) if (id && id in big.colors && outfitTinted.some(p => p.id === id)) expect(parsed.colors[id], id).toBe(big.colors[id]);
    expect(parsed.place).toEqual(big.place);
  });
});
