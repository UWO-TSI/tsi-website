/**
 * The snap (specs/v1-drop.md §3): the drawn frame copied straight after it renders (the WebGL canvas keeps nothing
 * once the browser shows it), the filter run over its pixels as one colour matrix (lib/game/photo.ts) with its tint,
 * glow, vignette and grain, scaled up by whole pixels so the pixel look stays crisp, and the frame drawn round it.
 * A PNG for Save to device. Browser only.
 */
import { applyMatrix, composeMatrix, frameLayout, photoScale, type FrameId, type PhotoFilter } from "@/lib/game/photo";

/** A copy of what the canvas shows now, at its own pixels (call it in the frame's after-effect). */
export function grab(source: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = source.width; c.height = source.height;
  c.getContext("2d")!.drawImage(source, 0, 0);
  return c;
}

/** Seeded noise in -1..1 (the grain is the same on every snap of the same size). */
function noise(i: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/** The filter on a copy, at its own pixels: the matrix and grain over the pixels, then the tint, glow and vignette. */
function develop(shot: HTMLCanvasElement, f: PhotoFilter) {
  const ctx = shot.getContext("2d")!, w = shot.width, h = shot.height;
  if (f.fns.length || f.grain) {
    const img = ctx.getImageData(0, 0, w, h);
    if (f.fns.length) applyMatrix(img.data, composeMatrix(f.fns));
    if (f.grain) {
      const amount = f.grain * 255, d = img.data;
      for (let i = 0, p = 0; i < d.length; i += 4, p++) { const n = noise(p) * amount; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    }
    ctx.putImageData(img, 0, 0);
  }
  if (f.tint) {
    ctx.save(); ctx.globalAlpha = f.tint.alpha; ctx.globalCompositeOperation = f.tint.blend; ctx.fillStyle = f.tint.color; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
  if (f.glow) {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.55);
    g.addColorStop(0, f.glow.color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.globalAlpha = f.glow.alpha; ctx.globalCompositeOperation = "screen"; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
  if (f.vignette) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    g.addColorStop(0, "rgba(20,14,10,0)"); g.addColorStop(1, `rgba(20,14,10,${f.vignette})`);
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
}

const FONT = '"Tethos Nunito", "Nunito", ui-rounded, system-ui, sans-serif';
const INK = "#3a2e22", SAGE = "#426b5b", CREAM = "#fffbe7";
const dateLine = (d: Date) => d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

/** The frame's paper and marks round the photo (its own drawing per frame). */
function drawFrame(ctx: CanvasRenderingContext2D, id: FrameId, l: ReturnType<typeof frameLayout>, when: Date) {
  const { width: W, height: H, photo: p } = l;
  switch (id) {
    case "plain":
      ctx.fillStyle = "#fffdf6"; ctx.fillRect(0, 0, W, H);
      break;
    case "polaroid":
      ctx.fillStyle = "#fbf8f1"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = INK; ctx.font = `700 ${l.caption!.size}px ${FONT}`; ctx.textBaseline = "alphabetic";
      ctx.fillText(`Tethos Island · ${dateLine(when)}`, l.caption!.x, l.caption!.y);
      break;
    case "postcard": {
      ctx.fillStyle = "#f6eedb"; ctx.fillRect(0, 0, W, H);
      const inset = p.x * 0.45;
      ctx.save(); ctx.strokeStyle = "rgba(114,92,78,0.45)"; ctx.lineWidth = Math.max(1, p.x * 0.06); ctx.setLineDash([p.x * 0.25, p.x * 0.18]);
      ctx.strokeRect(inset, inset, W - 2 * inset, H - 2 * inset); ctx.restore();
      break;
    }
    case "tsi":
      ctx.fillStyle = "#2f4f46"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = CREAM; ctx.font = `800 ${l.caption!.size}px ${FONT}`; ctx.textBaseline = "alphabetic";
      ctx.fillText("TSI · Tethos Island", l.caption!.x, l.caption!.y);
      ctx.textAlign = "right"; ctx.font = `700 ${Math.round(l.caption!.size * 0.8)}px ${FONT}`; ctx.fillStyle = "rgba(255,251,231,0.75)";
      ctx.fillText(dateLine(when), W - p.x, l.caption!.y);
      ctx.textAlign = "left";
      break;
  }
}

/** The postcard's stamp and postmark, over the photo's top right corner. */
function drawStamp(ctx: CanvasRenderingContext2D, l: ReturnType<typeof frameLayout>, when: Date) {
  const { photo: p } = l, s = Math.round(p.w * 0.11), x = p.x + p.w - s - p.x * 0.35, y = p.y + p.x * 0.35;
  ctx.save();
  // The stamp: cream paper, scalloped edges, a sage inner card with TSI.
  ctx.fillStyle = CREAM; ctx.fillRect(x, y, s, s * 1.2);
  ctx.fillStyle = "#f6eedb";
  const r = s * 0.035;
  for (let i = 0; i <= 12; i++) {
    for (const [cx, cy] of [[x + (s * i) / 12, y], [x + (s * i) / 12, y + s * 1.2], [x, y + (s * 1.2 * i) / 12], [x + s, y + (s * 1.2 * i) / 12]]) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = SAGE; ctx.fillRect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.96);
  ctx.fillStyle = CREAM; ctx.font = `900 ${Math.round(s * 0.26)}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("TSI", x + s / 2, y + s * 0.6);
  // The postmark, overlapping the stamp: two rings and the island's name.
  ctx.translate(x - s * 0.25, y + s * 0.85); ctx.rotate(-0.22);
  ctx.strokeStyle = "rgba(58,46,34,0.55)"; ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(58,46,34,0.6)"; ctx.font = `800 ${Math.round(s * 0.11)}px ${FONT}`;
  ctx.fillText("TETHOS", 0, -s * 0.08); ctx.fillText(dateLine(when).toUpperCase(), 0, s * 0.1);
  ctx.restore();
}

/** The finished photo: developed, scaled up by whole pixels, framed. */
export async function makePhoto(shot: HTMLCanvasElement, filter: PhotoFilter, frame: FrameId, cssWidth: number, dpr: number, when = new Date()): Promise<Blob> {
  develop(shot, filter);
  const k = photoScale(shot.width, cssWidth, dpr), w = shot.width * k, h = shot.height * k;
  const l = frameLayout(frame, w, h);
  const out = document.createElement("canvas");
  out.width = l.width; out.height = l.height;
  const ctx = out.getContext("2d")!;
  drawFrame(ctx, frame, l, when);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(shot, l.photo.x, l.photo.y, w, h);
  if (frame === "postcard") drawStamp(ctx, l, when);
  return new Promise((resolve, reject) => out.toBlob(b => (b ? resolve(b) : reject(new Error("no image"))), "image/png"));
}
