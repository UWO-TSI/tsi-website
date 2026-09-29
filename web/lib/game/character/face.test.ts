import { describe, expect, it } from "vitest";
import { composeFace, faceDraws, type Ctx2D } from "./face";
import { DEFAULT_LOOK, FACE, PALETTE } from "./look";

/** Records every call so the composition order and colours can be checked without a canvas. */
function recorder(name: string, log: string[]): Ctx2D {
  const ctx = {
    fillStyle: "" as Ctx2D["fillStyle"], globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    fillRect: (...a: number[]) => log.push(`${name}.fill ${String(ctx.fillStyle)} ${ctx.globalCompositeOperation} ${a.join(",")}`),
    clearRect: () => log.push(`${name}.clear`),
    drawImage: (img: unknown, ...a: number[]) => log.push(`${name}.draw ${(img as { tag: string }).tag} ${a.map(v => Math.round(v)).join(",")}`),
  };
  return ctx as unknown as Ctx2D;
}

describe("face composition", () => {
  it("fills the skin, then extras, hair-tinted brows, eyes and mouth in their rects", () => {
    const log: string[] = [];
    const look = { ...DEFAULT_LOOK, skin: 7, hair: 9, extras: ["blush"] };
    composeFace(recorder("face", log), { ctx: recorder("scratch", log), image: { tag: "scratch" } as unknown as CanvasImageSource }, { tag: "atlas" } as unknown as CanvasImageSource, look, "neutral", 256);
    const k = 256 / FACE.canvas;
    const drawn = (layer: "eyes" | "extras", id: string) => {
      const [x, y, w, h, dx, dy] = FACE.layers[layer].items[id], [u0, w0] = FACE.layers[layer].dest;
      return [x, y, w, h, u0 * 256 + dx * k, w0 * 256 + dy * k, w * k, h * k].map(v => Math.round(v)).join(",");
    };
    expect(log).toEqual([
      `face.fill ${PALETTE.skin[7]} source-over 0,0,256,256`,
      `face.draw atlas ${drawn("extras", "blush")}`,
      "scratch.clear",
      expect.stringMatching(/^scratch\.draw atlas /),
      `scratch.fill ${PALETTE.hair[9]} source-in 0,0,256,256`,
      "face.draw scratch 0,0",
      `face.draw atlas ${drawn("eyes", "F1.1")}`,
      expect.stringMatching(/^face\.draw atlas /),
    ]);
  });
  it("expressions swap eyes and mouth; blink swaps only the eyes", () => {
    const pick = (e: Parameters<typeof faceDraws>[1]) => Object.fromEntries(faceDraws(DEFAULT_LOOK, e, 512).map(d => [d.layer, d.id]));
    expect(pick("neutral")).toEqual({ brows: "brow_soft", eyes: "F1.1", mouth: "M1.1" });
    expect(pick("happy")).toEqual({ brows: "brow_soft", eyes: "E8.1", mouth: "M2.1" });
    expect(pick("blink")).toEqual({ brows: "brow_soft", eyes: "E8.1", mouth: "M1.1" });
    expect(pick("surprised").eyes).toBe("F1.1");
    for (const e of ["happy", "surprised", "sad", "angry", "sleepy", "blink"] as const) for (const d of faceDraws(DEFAULT_LOOK, e, 256)) expect(d.id in FACE.layers[d.layer].items).toBe(true);
  });
});
