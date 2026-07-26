// C6 checkout hygiene: verify every package.json dependency actually exists
// in node_modules. Catches the F1 failure mode (dep added to package.json,
// install never run in this checkout → dead routes at dev time).
// Run from web/:  node scripts/_check-deps.mjs   (exit 1 if anything missing)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(webRoot, "package.json"), "utf8"));

const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const missing = names.filter(
  (name) => !fs.existsSync(path.join(webRoot, "node_modules", name, "package.json"))
);

if (missing.length) {
  console.error(`MISSING ${missing.length} dependenc${missing.length === 1 ? "y" : "ies"} in node_modules:`);
  for (const name of missing) console.error(`  - ${name}`);
  console.error("\nFix: cd web && npm install --legacy-peer-deps");
  process.exit(1);
}
console.log(`deps ok — all ${names.length} packages resolve in node_modules`);
