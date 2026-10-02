import { describe, expect, it } from "vitest";
import { RUNES, runeById, scoreTrace, strokeGuides, type Pt, type TracePt } from "./runes";

const timed = (strokes: Pt[][], msPerPoint = 20): TracePt[][] => {
  let t = 0;
  return strokes.map(s => s.flatMap((p, i) => i === 0 ? [[p[0], p[1], (t += msPerPoint)] as TracePt] : Array.from({ length: 10 }, (_, k) => {
    const a = s[i - 1], f = (k + 1) / 10; return [a[0] + (p[0] - a[0]) * f, a[1] + (p[1] - a[1]) * f, (t += msPerPoint)] as TracePt;
  })));
};

describe("incantation runes (systems data + scorer)", () => {
  it("uses the canonical spark (easy) and binding (hard) runes, then the classes v2 shapes", () => {
    expect(RUNES.map(r => [r.id, r.difficulty])).toEqual([["spark", "easy"], ["binding", "hard"],
      ["cross", "easy"], ["circle", "easy"], ["line", "easy"], ["triangle", "easy"], ["chevron", "easy"], ["wings", "hard"]]);
    expect(strokeGuides(runeById("binding"))).toHaveLength(3);
  });
  it("a faithful trace is enhanced; a scribble or a timeout fails", () => {
    for (const r of RUNES) expect(scoreTrace(r, timed(r.strokes)).outcome).toBe("enhanced");
    const spark = runeById("spark");
    const scribble: TracePt[] = Array.from({ length: 300 }, (_, i) => [0.1 + ((i * 37) % 80) / 100, 0.1 + ((i * 53) % 80) / 100, i * 5]);
    expect(scoreTrace(spark, [scribble]).outcome).toBe("fail");
    expect(scoreTrace(spark, timed(spark.strokes, 400)).outcome).toBe("fail");
  });
  it("half a rune or strokes out of order don't reach enhanced", () => {
    const binding = runeById("binding");
    expect(scoreTrace(binding, timed([binding.strokes[0]])).outcome).not.toBe("enhanced");
    expect(scoreTrace(binding, timed([binding.strokes[2], binding.strokes[1], binding.strokes[0]])).outcome).not.toBe("enhanced");
  });
});
