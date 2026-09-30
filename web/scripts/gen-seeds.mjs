// After a TS catalogue change (roster, economy, ownership, crafting, combat, seasonal events,
// recipe drops): write ONE new migration bringing each changed seed up to its TS, never editing an
// applied migration (lib/seedMigrations.ts). Run from web/: node scripts/gen-seeds.mjs
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } });
const { MIGRATIONS, seedMigration } = await jiti.import("../lib/seedMigrations.ts");
const sql = seedMigration();
if (!sql) {
  console.log("seeds up to date: no migration written");
  process.exit(0);
}
const latest = readdirSync(MIGRATIONS).map((f) => f.slice(0, 14)).filter((v) => /^\d{14}$/.test(v)).sort().pop();
const now = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const path = join(MIGRATIONS, `${now > latest ? now : String(BigInt(latest) + 1n)}_catalogue_seed.sql`);
writeFileSync(path, sql);
console.log(`wrote ${path}\nApply it to production with the code, and add it to specs/evidence/launch-fixes/sql-smoke.sh.`);
