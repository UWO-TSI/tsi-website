import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, SEEDS, changedRowsUpsert, currentSeed, seedMigration } from "./seedMigrations";

describe("generated catalogue seeds", () => {
  it.each(SEEDS.map((s) => [s.name, s] as const))("%s: the TS matches its newest block (after a catalogue change: node scripts/gen-seeds.mjs)", (_, seed) => {
    expect(currentSeed(seed).block).toBe(seed.sql());
  });

  it("upserts only the rows a change adds or edits", () => {
    const prev = "INSERT INTO t (k, a, b) VALUES\n  ('x', 1, 2),\n  ('y', 3, 4)\nON CONFLICT (k) DO NOTHING;";
    const next = "INSERT INTO t (k, a, b) VALUES\n  ('x', 1, 2),\n  ('y', 3, 5),\n  ('z', 6, 7)\nON CONFLICT (k) DO NOTHING;";
    expect(changedRowsUpsert(prev, next)).toBe("INSERT INTO t (k, a, b) VALUES\n  ('y', 3, 5),\n  ('z', 6, 7)\nON CONFLICT (k) DO UPDATE SET a = EXCLUDED.a, b = EXCLUDED.b;");
    expect(changedRowsUpsert(next, next)).toBe("");
  });

  it("a catalogue change goes into a new tagged migration, never into the applied one", () => {
    const dir = mkdtempSync(join(tmpdir(), "seeds-"));
    try {
      cpSync(MIGRATIONS, dir, { recursive: true });
      expect(seedMigration(dir)).toBeNull();
      // As if the economy migration had shipped an older price for the basic rod.
      const economy = SEEDS.find((s) => s.name === "economy")!, applied = join(dir, economy.file);
      const row = economy.sql().split("\n").find((l) => l.startsWith("  ('rod-basic'"))!;
      writeFileSync(applied, readFileSync(applied, "utf8").replace(row, row.replace(", 100, ", ", 90, ")));
      const before = readFileSync(applied, "utf8");
      const sql = seedMigration(dir)!;
      expect(sql).toContain(`-- seed: economy\n${economy.sql()}`);
      expect(sql).toContain(`${row.replace(/,$/, "")}\nON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name`);
      writeFileSync(join(dir, "20991231000000_catalogue_seed.sql"), sql);
      expect(currentSeed(economy, dir)).toEqual({ file: "20991231000000_catalogue_seed.sql", block: economy.sql() });
      expect(seedMigration(dir)).toBeNull();
      expect(readFileSync(applied, "utf8")).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
