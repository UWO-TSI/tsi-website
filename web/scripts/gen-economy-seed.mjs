// Regenerate the economy seed in supabase/migrations/033_economy.sql from
// lib/wallet/catalogue.ts. Run from web/: node scripts/gen-economy-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } });
const { economySeedSql, SEED_BEGIN, SEED_END } = await jiti.import("../lib/wallet/seed.ts");
const path = "supabase/migrations/033_economy.sql";
const sql = readFileSync(path, "utf8");
const start = sql.indexOf(SEED_BEGIN);
const end = sql.indexOf(SEED_END) + SEED_END.length;
if (start < 0 || end < SEED_END.length) throw new Error("seed markers missing");
writeFileSync(path, sql.slice(0, start) + economySeedSql() + sql.slice(end));
console.log("economy seed written");
