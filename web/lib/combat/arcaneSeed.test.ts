import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARCANE_COSMETICS, ARCANE_WEAPONS } from "./arcaneSeed";
import { ARCANE_KITS } from "./arcaneKits";
import { signatureGrant, WEAPONS } from "./weapons";
import { combatSeedSql } from "./seed";

const dir = join(__dirname, "../../supabase/migrations"), file = readdirSync(dir).find(f => f.endsWith("_classes_v2_arcane_seed.sql"))!;
const sql = readFileSync(join(dir, file), "utf8");
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

describe("the Arcane seed (arcaneSeed.ts = *_classes_v2_arcane_seed.sql)", () => {
  it("carries every signature weapon row exactly, one type a subclass, tiers 1–5", () => {
    for (const w of ARCANE_WEAPONS) expect(sql).toContain(`(${[q(w.key), q(w.name), q(w.type), w.tier, `ARRAY[${w.scaling.map(q).join(",")}]::text[]`, w.max_durability, w.repair_per_point, q(w.subclass!)].join(", ")})`);
    for (const k of ARCANE_KITS) {
      const mine = ARCANE_WEAPONS.filter(w => w.subclass === k.key);
      expect(mine.map(w => w.tier)).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(mine.map(w => w.type))).toEqual(new Set([k.signature.type]));
      expect(signatureGrant(k.key, 1)?.key).toBe(`${k.signature.type}-1`);
      expect(signatureGrant(k.key, 3)?.tier).toBe(3);
    }
    expect(WEAPONS.filter(w => w.subclass).length).toBeGreaterThanOrEqual(20);
  });
  it("leaves signature weapons out of the generated combat seed (each family's own migration carries them)", () => {
    for (const w of ARCANE_WEAPONS) expect(combatSeedSql()).not.toContain(q(w.key));
  });
  it("carries the shop cosmetics: skins for their subclass, aura sets of three colours, about one in four in Gems, never a rate", () => {
    for (const c of ARCANE_COSMETICS) expect(sql).toContain(`(${q(c.slug)}, ${q(c.name)}, ${q(c.kind)}, ${q(c.description)}, ${c.coins ?? "NULL"}, ${c.gems ?? "NULL"}, `);
    expect(ARCANE_COSMETICS.length).toBeGreaterThanOrEqual(8); expect(ARCANE_COSMETICS.length).toBeLessThanOrEqual(12);
    const gems = ARCANE_COSMETICS.filter(c => c.gems);
    expect(gems.length / ARCANE_COSMETICS.length).toBeCloseTo(0.25, 1);
    for (const c of ARCANE_COSMETICS) {
      expect(!!c.coins !== !!c.gems).toBe(true); // exactly one price
      expect(`${c.name} ${c.description}`).not.toMatch(/\$|CAD|dollar|rate|worth/i);
      if (c.kind === "aura") expect(c.ramp).toHaveLength(3); else expect(Object.keys(c.skin!).every(m => /^M_[A-Z][a-z]+$/.test(m))).toBe(true);
    }
  });
});
