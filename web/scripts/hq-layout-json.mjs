// HQ's layout for the model build (art/interiors/build_hq.py): run from web/ after a change to lib/game/hqLayout.ts.
//   node scripts/hq-layout-json.mjs
import { writeFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } });
const { hqLayoutJson } = await jiti.import("../lib/game/hqLayout.ts");
writeFileSync("../art/interiors/hq_layout.json", hqLayoutJson());
console.log("wrote art/interiors/hq_layout.json");
