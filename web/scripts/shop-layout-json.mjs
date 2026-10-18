// The shop's layout for the model build (art/interiors/build_shop.py): run from web/ after a change to lib/game/shopLayout.ts.
//   node scripts/shop-layout-json.mjs
import { writeFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } });
const { shopLayoutJson } = await jiti.import("../lib/game/shopLayout.ts");
writeFileSync("../art/interiors/shop_layout.json", shopLayoutJson());
console.log("wrote art/interiors/shop_layout.json");
