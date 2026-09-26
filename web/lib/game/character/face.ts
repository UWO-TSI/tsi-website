/**
 * Face texture composition (rows 132, 144, 191, 192): fill the skin tone,
 * then draw the chosen extras, brows (tinted with the hair colour), eyes and
 * mouth from the feature atlas into their face_variants.json rectangles.
 * Expressions swap eyes and/or mouth for the length of a clip (ruling 23).
 */
import { FACE, PALETTE, type CharacterLook, type FaceLayer } from "./look";

export type Expression = "neutral" | "happy" | "surprised" | "sad" | "angry" | "sleepy" | "blink";

/** Ruling 23: clip → expression; everything else is neutral with blinks. */
export const CLIP_EXPRESSION: Record<string, Expression> = {
  Laugh: "happy", Cheer: "happy", Stretch: "happy", Dance: "happy", Sad: "sad", Defeat: "sad", Hit: "surprised", Sleep: "sleepy",
  AttackMelee: "angry", AttackBow: "angry", AttackCast: "angry",
};
/** Which atlas cells stand in for each expression (closed "n" arcs, "> <", the half lid, open mouths). */
export const EXPRESSION_FACE: Record<Exclude<Expression, "neutral">, { eyes?: string; mouth?: string }> = {
  happy: { eyes: "E8.1", mouth: "M2.1" }, surprised: { mouth: "M6.1" }, sad: { eyes: "E1.2", mouth: "M4.3" },
  angry: { eyes: "E6.1", mouth: "M2.2" }, sleepy: { eyes: "E1.6", mouth: "M3.1" }, blink: { eyes: "E8.1" },
};

export interface FaceDraw { layer: FaceLayer; id: string; src: [number, number, number, number]; dest: [number, number, number, number]; tint: string | null }

/** The draw list for one face: atlas source rect → destination rect in canvas pixels. */
export function faceDraws(look: CharacterLook, expression: Expression, size: number): FaceDraw[] {
  const swap = expression === "neutral" ? {} : EXPRESSION_FACE[expression];
  const chosen: Record<FaceLayer, string[]> = { extras: look.extras, brows: [look.brows], eyes: [swap.eyes ?? look.eyes], mouth: [swap.mouth ?? look.mouth] };
  return FACE.compose_order.flatMap(layer => {
    const { dest: [u0, w0, u1, w1], items, tint } = FACE.layers[layer];
    return chosen[layer].filter(id => id in items).map(id => ({
      layer, id, src: items[id],
      dest: [u0 * size, w0 * size, (u1 - u0) * size, (w1 - w0) * size] as [number, number, number, number],
      tint: tint === "hair" ? PALETTE.hair[look.hair] : null,
    }));
  });
}

/** The subset of CanvasRenderingContext2D the composer needs (tests pass a recorder). */
export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern; globalCompositeOperation: GlobalCompositeOperation;
  fillRect(x: number, y: number, w: number, h: number): void; clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number): void;
}

/**
 * Paint one face. `scratch` is a same-size canvas used to tint white layers
 * (brows) by the hair colour without touching the skin around them.
 */
export function composeFace(ctx: Ctx2D, scratch: { ctx: Ctx2D; image: CanvasImageSource }, atlas: CanvasImageSource, look: CharacterLook, expression: Expression, size: number): void {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = PALETTE.skin[look.skin];
  ctx.fillRect(0, 0, size, size);
  for (const d of faceDraws(look, expression, size)) {
    if (!d.tint) { ctx.drawImage(atlas, ...d.src, ...d.dest); continue; }
    const s = scratch.ctx;
    s.globalCompositeOperation = "source-over";
    s.clearRect(0, 0, size, size);
    s.drawImage(atlas, ...d.src, ...d.dest);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = d.tint;
    s.fillRect(0, 0, size, size);
    ctx.drawImage(scratch.image, 0, 0);
  }
}
