// Regenerate the roster seed in supabase/migrations/20260926150400_collections.sql from
// lib/collections/roster.ts. Run from web/: node scripts/gen-collections-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } });
const { ROSTER } = await jiti.import("../lib/collections/roster.ts");
const { seedSql, SEED_BEGIN, SEED_END } = await jiti.import("../lib/collections/seed.ts");
const path = "supabase/migrations/20260926150400_collections.sql";
const sql = readFileSync(path, "utf8");
const start = sql.indexOf(SEED_BEGIN);
const end = sql.indexOf(SEED_END) + SEED_END.length;
if (start < 0 || end < SEED_END.length) throw new Error("seed markers missing");
writeFileSync(path, sql.slice(0, start) + seedSql(ROSTER) + sql.slice(end));
console.log(`wrote ${ROSTER.length} species`);
