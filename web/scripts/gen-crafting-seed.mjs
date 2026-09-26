// Regenerate the crafting seed in supabase/migrations/20260926160000_crafting.sql from
// lib/crafting/recipes.ts. Run from web/: node scripts/gen-crafting-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } });
const { craftingSeedSql, SEED_BEGIN, SEED_END } = await jiti.import("../lib/crafting/seed.ts");
const path = "supabase/migrations/20260926160000_crafting.sql";
const sql = readFileSync(path, "utf8");
const start = sql.indexOf(SEED_BEGIN);
const end = sql.indexOf(SEED_END) + SEED_END.length;
if (start < 0 || end < SEED_END.length) throw new Error("seed markers missing");
writeFileSync(path, sql.slice(0, start) + craftingSeedSql() + sql.slice(end));
console.log("crafting seed written");
