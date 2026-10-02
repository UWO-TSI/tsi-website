/**
 * The generated catalogue seeds and the migrations that carry them.
 *
 * A seed's first block sits in the migration that made its tables. Applied
 * migrations are never edited: when a TS catalogue changes, scripts/gen-seeds.mjs
 * writes a NEW migration carrying the new block (tagged `-- seed: <name>`)
 * followed by an upsert of just the rows that changed, so a TS change lands in
 * the database while rows the TS left alone keep any admin edit. Every block is
 * idempotent (inserts do nothing on conflict; updates set fixed values).
 * seedMigrations.test.ts holds each seed's TS to its newest block.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EVENT_SPECIES, LAUNCH_ROSTER, REEL_FISH } from "./collections/roster";
import { seedSql } from "./collections/seed";
import { craftingSeedSql, recipeDropsSql } from "./crafting/seed";
import { combatSeedSql } from "./combat/seed";
import { seasonalGoalsSql } from "./progression/seed";
import { economySeedSql, eventItemsSeedSql, ownershipSeedSql, shopIconsSql } from "./wallet/seed";
import { CATALOGUE, EVENT_ITEMS, OWNERSHIP_ITEMS } from "./wallet/catalogue";
import { CRAFTED_ITEMS, RECIPE_CARDS } from "./crafting/recipes";
import { studyTablesSeedSql } from "./study/seed";

export const MIGRATIONS = join(__dirname, "../supabase/migrations");

export interface Seed { name: string; /** The migration with its first block. */ file: string; sql: () => string }
export const SEEDS: readonly Seed[] = [
  { name: "roster", file: "20260926150400_collections.sql", sql: () => seedSql([...LAUNCH_ROSTER, ...REEL_FISH]) },
  { name: "economy", file: "20260926150600_economy.sql", sql: economySeedSql },
  { name: "crafting", file: "20260926160000_crafting.sql", sql: craftingSeedSql },
  { name: "ownership", file: "20260926180000_ownership.sql", sql: ownershipSeedSql },
  { name: "combat", file: "20260926190000_combat_content.sql", sql: combatSeedSql },
  { name: "event-species", file: "20260929120000_seasonal_events.sql", sql: () => seedSql(EVENT_SPECIES) },
  { name: "event-furniture", file: "20260929120000_seasonal_events.sql", sql: eventItemsSeedSql },
  { name: "seasonal-goals", file: "20260929120000_seasonal_events.sql", sql: seasonalGoalsSql },
  { name: "recipe-drops", file: "20260930100000_recipe_drops.sql", sql: recipeDropsSql },
  // The study migration's hand-written seed has no markers: the first generated block (the café tables, cafe-polish §7) upserts every row.
  { name: "study-tables", file: "20260926150500_study.sql", sql: studyTablesSeedSql },
  // Row 281: every shop row's icon (lib/icons), set by update so the rows' other columns keep any admin edit.
  { name: "shop-icons", file: "20261002052225_catalogue_seed.sql", sql: () => shopIconsSql([...CATALOGUE, ...OWNERSHIP_ITEMS, ...EVENT_ITEMS, ...CRAFTED_ITEMS, ...RECIPE_CARDS]) },
];

/** A generated block's first and last lines: its BEGIN and END markers. */
const markers = (block: string) => [block.slice(0, block.indexOf("\n")), block.slice(block.lastIndexOf("\n") + 1)] as const;
const tag = (name: string) => `-- seed: ${name}\n`;

/** A seed's newest block: in the newest later migration tagging it, else in its first migration. */
export function currentSeed(seed: Seed, dir = MIGRATIONS): { file: string; block: string } {
  const [begin, end] = markers(seed.sql());
  const cut = (sql: string, from: number) => {
    const at = sql.indexOf(begin, from), stop = at < 0 ? -1 : sql.indexOf(end, at);
    return stop < 0 ? "" : sql.slice(at, stop + end.length);
  };
  const later = readdirSync(dir).filter((f) => f.endsWith(".sql") && f > seed.file).sort().reverse();
  for (const file of later) {
    const sql = readFileSync(join(dir, file), "utf8"), at = sql.indexOf(tag(seed.name) + begin);
    if (at >= 0) return { file, block: cut(sql, at) };
  }
  return { file: seed.file, block: cut(readFileSync(join(dir, seed.file), "utf8"), 0) };
}

const INSERT = /INSERT INTO (\w+) \(([^)]*)\) VALUES\n([\s\S]*?)\nON CONFLICT \(([^)]*)\) DO NOTHING;/g;
const rowsOf = (text: string) => text.split("\n").map((r) => r.replace(/,$/, ""));

/**
 * Upserts for the rows `next` adds or changes against `prev` (one row per line,
 * as the generators write them), so they land even where the insert does nothing.
 */
export function changedRowsUpsert(prev: string, next: string): string {
  const before = new Map([...prev.matchAll(INSERT)].map((m) => [`${m[1]}(${m[2]})`, new Set(rowsOf(m[3]))]));
  return [...next.matchAll(INSERT)].flatMap(([, table, cols, rows, conflict]) => {
    const old = before.get(`${table}(${cols})`), changed = rowsOf(rows).filter((r) => !old?.has(r));
    if (!changed.length) return [];
    const keys = conflict.split(",").map((c) => c.trim());
    const set = cols.split(",").map((c) => c.trim()).filter((c) => !keys.includes(c)).map((c) => `${c} = EXCLUDED.${c}`);
    return [`INSERT INTO ${table} (${cols}) VALUES\n${changed.join(",\n")}\nON CONFLICT (${conflict}) DO UPDATE SET ${set.join(", ")};`];
  }).join("\n");
}

/** The new migration bringing every changed seed up to its TS, or null when all are current. */
export function seedMigration(dir = MIGRATIONS): string | null {
  const parts = SEEDS.flatMap((seed) => {
    const next = seed.sql(), { file, block } = currentSeed(seed, dir);
    if (block === next) return [];
    // A first block written by hand (no markers): diff against that migration's own INSERTs.
    const upsert = changedRowsUpsert(block || readFileSync(join(dir, file), "utf8"), next);
    return [`-- previous block: ${file}\n${tag(seed.name)}${next}${upsert ? `\n-- The rows this change adds or edits, so they land where the insert above does nothing.\n${upsert}` : ""}`];
  });
  if (!parts.length) return null;
  return `-- Generated by web/scripts/gen-seeds.mjs from the TS catalogues (lib/seedMigrations.ts): each changed seed's
-- new block, then an upsert of its changed rows. Idempotent. Rows removed from the TS are not deleted here.

${parts.join("\n\n")}\n`;
}
