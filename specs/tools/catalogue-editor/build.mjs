/**
 * Builds the catalogue editor (specs/lanes/catalogue-editor.md) into dist/: index.html, app.js, data.js (the game's
 * current roster, sell prices and lists) and the species icons, at relative paths. Rebuild after any roster change so
 * the page shows the game's values. `node specs/tools/catalogue-editor/build.mjs` from anywhere.
 */
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), web = join(here, "../../../web"), out = join(here, "dist");
const { createJiti } = createRequire(join(web, "package.json"))("jiti");
const jiti = createJiti(join(web, "lib"), { alias: { "@": web } });
const { ROSTER, WATER_BIOMES, LAND_BIOMES, WEATHERS, RARITY_RANK } = await jiti.import(join(web, "lib/collections/roster.ts"));
const { SELL_PRICES } = await jiti.import(join(web, "lib/wallet/catalogue.ts"));
// The GUI sheet's rarity palette (styles/game-tokens.css), the colours the game's cards use.
const tokens = readFileSync(join(web, "styles/game-tokens.css"), "utf8");
const colors = Object.fromEntries(Object.keys(RARITY_RANK).map(r => [r, tokens.match(new RegExp(`--gui-rarity-${r}:\\s*(#[0-9a-f]{6})`, "i"))[1]]));

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "icons"), { recursive: true });
const species = ROSTER.map(({ key, category, sub, name, biome, tool, rarity, size, hours, rainAnyHour, weather, months, oneLiner, icon, price }) => {
  copyFileSync(join(web, "public", icon), join(out, "icons", `${key}.webp`));
  return { key, category, sub, name, biome, tool, rarity, size, hours, rainAnyHour, weather, months, oneLiner, price: price ?? null };
});
const sha = execSync("git rev-parse --short HEAD", { cwd: here }).toString().trim();
const data = { species, sellPrices: SELL_PRICES, rarities: Object.keys(RARITY_RANK), colors, waterBiomes: WATER_BIOMES, landBiomes: LAND_BIOMES, weathers: WEATHERS, built: `${new Date().toISOString().slice(0, 10)} at ${sha}` };
writeFileSync(join(out, "data.js"), `window.CATALOGUE = ${JSON.stringify(data)};\n`);
copyFileSync(join(here, "index.html"), join(out, "index.html"));
copyFileSync(join(here, "app.js"), join(out, "app.js"));
console.log(`wrote ${out}: ${species.length} species`);
