import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIRE_PACK, FIRE_PACK_ROWS, FIRE_PACK_URL } from "./fxMaterial";
import { COMBAT_PACK_COLS } from "./combatPack";

const WEB = join(__dirname, "../../..");
/** A lossless WebP's size, from its VP8L header (14 bits each, minus one). */
function webpSize(file: string): [number, number] {
  const b = readFileSync(file);
  expect(b.toString("ascii", 12, 16)).toBe("VP8L");
  const bits = b.readUInt32LE(21);
  return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
}

describe("the fire pack (the campfire's and the candles' cut of the combat pack)", () => {
  it("is the rows art/fx/build_pack.py cuts, in its order, at the combat pack's cell size", () => {
    const script = readFileSync(join(WEB, "../art/fx/build_pack.py"), "utf8");
    const rows = /FIRE_ROWS = \(([^)]*)\)/.exec(script)![1].match(/"(\w+)"/g)!.map(s => s.slice(1, -1));
    expect(Object.keys(FIRE_PACK)).toEqual(rows);
    expect(Object.values(FIRE_PACK).map(r => r.row)).toEqual(rows.map((_, i) => i));
    expect(webpSize(join(WEB, "public", FIRE_PACK_URL))).toEqual([COMBAT_PACK_COLS * 128, FIRE_PACK_ROWS * 128]);
  });
});
