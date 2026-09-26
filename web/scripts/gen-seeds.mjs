// Regenerate the generated seeds in the game migration drafts from their TS
// sources: collections roster, economy catalogue, combat content.
// Run from web/: node scripts/gen-seeds.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } });
const { ROSTER } = await jiti.import("../lib/collections/roster.ts");
const collections = await jiti.import("../lib/collections/seed.ts");
const economy = await jiti.import("../lib/wallet/seed.ts");
const combat = await jiti.import("../lib/combat/seed.ts");

for (const [path, { SEED_BEGIN, SEED_END }, seed] of [
  ["supabase/migrations/20260926150400_collections.sql", collections, collections.seedSql(ROSTER)],
  ["supabase/migrations/20260926150600_economy.sql", economy, economy.economySeedSql()],
  ["supabase/migrations/20260926180000_combat_content.sql", combat, combat.combatSeedSql()],
]) {
  const sql = readFileSync(path, "utf8");
  const start = sql.indexOf(SEED_BEGIN);
  const end = sql.indexOf(SEED_END) + SEED_END.length;
  if (start < 0 || end < SEED_END.length) throw new Error(`seed markers missing in ${path}`);
  writeFileSync(path, sql.slice(0, start) + seed + sql.slice(end));
  console.log(`wrote ${path}`);
}
