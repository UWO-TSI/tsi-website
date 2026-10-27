// Writes David's catalogue editor values (specs/tools/catalogue-editor: one db doc per species key, holding the fields
// he changed) into lib/collections/roster.ts, then regenerates the seed migration (scripts/gen-seeds.mjs). Every value
// is checked first; nothing is written if one fails. The roster is the one source: the reel's rarity, size, habitat
// and hours (lib/game/fishing.ts), the forage and bug rolls, and each species' own sell price (`price`, else
// SELL_PRICES by category and rarity) all read it.
// Run from web/: node scripts/apply-species.mjs <export.json> [--dry]
// The export is the db's `species` collection: { key: fields }, or a list of { id, data } (or { id, ...fields }).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createJiti } from "jiti";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROSTER_TS = join(WEB, "lib/collections/roster.ts");
export const FIELDS = ["rarity", "price", "hours", "months", "biome", "weather", "rainAnyHour", "size", "oneLiner"];

const fresh = () => createJiti(import.meta.url, { alias: { "@": WEB }, moduleCache: false, fsCache: false });
export async function loadGame(rosterPath = ROSTER_TS) {
  const jiti = fresh();
  return { ...(await jiti.import(rosterPath)), SELL_PRICES: (await jiti.import(join(WEB, "lib/wallet/catalogue.ts"))).SELL_PRICES };
}

/** The export as key -> fields, whichever shape the db listing came in. */
export function editsOf(json) {
  const list = Array.isArray(json) ? json : Array.isArray(json?.docs) ? json.docs : Array.isArray(json?.documents) ? json.documents : null;
  if (!list) return new Map(Object.entries(json ?? {}));
  return new Map(list.map((d) => {
    const { id, doc_id, key, data, fields, ...rest } = d;
    return [id ?? doc_id ?? key, data ?? fields ?? rest];
  }));
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const unique = (a) => new Set(a).size === a.length;

/** Every problem with the edits, as "key.field: why"; empty when all are good. */
export function check(edits, game) {
  const { ROSTER, RARITY_RANK, WATER_BIOMES, LAND_BIOMES, WEATHERS } = game, by = new Map(ROSTER.map((s) => [s.key, s])), bad = [];
  for (const [key, e] of edits) {
    const s = by.get(key);
    if (!s) { bad.push(`${key}: not a species in the roster`); continue; }
    if (!e || typeof e !== "object" || Array.isArray(e)) { bad.push(`${key}: not an object of fields`); continue; }
    for (const [f, v] of Object.entries(e)) {
      const why = {
        rarity: () => (v in RARITY_RANK ? null : `one of ${Object.keys(RARITY_RANK).join(", ")}`),
        price: () => (v === null || isInt(v, 1, 1e6) ? null : "a whole number of coins above 0, or null for the rarity table"),
        hours: () => (v === null || (Array.isArray(v) && v.length === 2 && isInt(v[0], 0, 23) && isInt(v[1], 1, 24) && v[0] !== v[1] % 24) ? null : "null (all day) or [start 0-23, end 1-24], start and end different"),
        months: () => (Array.isArray(v) && v.every((m) => isInt(m, 1, 12)) && unique(v) ? null : "months 1 to 12, each once ([] for all year)"),
        biome: () => ((s.tool === "rod" ? WATER_BIOMES : LAND_BIOMES).includes(v) ? null : `one of ${(s.tool === "rod" ? WATER_BIOMES : LAND_BIOMES).join(", ")} for a ${s.tool} find`),
        weather: () => (Array.isArray(v) && v.every((w) => WEATHERS.includes(w)) && unique(v) ? null : `some of ${WEATHERS.join(", ")}, each once ([] for any)`),
        rainAnyHour: () => (typeof v === "boolean" ? null : "true or false"),
        size: () => (!s.size ? "it has no size" : Array.isArray(v) && v.length === 2 && v.every((n) => Number.isFinite(n)) && v[0] > 0 && v[1] > v[0] ? null : "[smallest above 0, largest above it] in cm"),
        oneLiner: () => (typeof v === "string" && v.length <= 200 && !v.includes("—") ? null : "text up to 200 characters, no em dash"),
      }[f];
      const msg = why ? why() : `not an editable field (${FIELDS.join(", ")})`;
      if (msg) bad.push(`${key}.${f}: ${msg} (got ${JSON.stringify(v)})`);
    }
  }
  return bad;
}

/** The species as the roster will hold it after the edits; `price` only where it differs from the rarity table. */
export function edited(s, e, SELL_PRICES) {
  const next = { ...s, ...e };
  if (e.months) next.months = [...e.months].sort((a, b) => a - b);
  const price = "price" in e ? e.price : s.price;
  if (price === null || price === undefined || price === SELL_PRICES[s.category]?.[next.rarity]) delete next.price;
  else next.price = price;
  return next;
}

/** The top-level items of a bracketed literal at `open` ("[" or "{"), as source text, and the index of its close. */
function items(src, open) {
  const out = [];
  let depth = 0, from = open + 1, i = open;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"') { for (i++; src[i] !== '"'; i++) if (src[i] === "\\") i++; continue; }
    if ("[{(".includes(c)) depth++;
    else if ("]})".includes(c)) { if (--depth === 0) break; }
    else if (c === "," && depth === 1) { out.push(src.slice(from, i).trim()); from = i + 1; }
  }
  const last = src.slice(from, i).trim();
  if (last) out.push(last);
  return { items: out, close: i };
}

const lit = (v) => (Array.isArray(v) ? `[${v.map(lit).join(", ")}]` : JSON.stringify(v));
const DEFAULT = { months: "[]", weather: "[]", rainAnyHour: "false", oneLiner: '""' };

/** roster.ts with each edited species' row rewritten: its own fields set, every other field's source text kept. */
export function rewrite(src, edits, game) {
  const by = new Map(game.ROSTER.map((s) => [s.key, s]));
  for (const [key, e] of edits) {
    const s = by.get(key), next = edited(s, e, game.SELL_PRICES);
    const at = src.indexOf(`["${key}", `);
    if (at < 0 || src.indexOf(`["${key}", `, at + 1) >= 0) throw new Error(`${key}: expected exactly one row in roster.ts`);
    const { items: row, close } = items(src, at);
    const pos = { biome: 2, rarity: 3, size: 4, hours: 5 };
    for (const [f, i] of Object.entries(pos)) if (f in e) row[i] = next[f] === null ? "null" : lit(next[f]);
    const extra = row[6] ? items(row[6], 0).items.map((kv) => [kv.slice(0, kv.indexOf(":")).trim(), kv.slice(kv.indexOf(":") + 1).trim()]) : [];
    const keep = new Map(extra);
    for (const f of ["months", "weather", "rainAnyHour", "oneLiner"]) {
      if (!(f in e)) continue;
      const v = lit(next[f]);
      if (v === DEFAULT[f]) keep.delete(f); else keep.set(f, v);
    }
    if (next.price === undefined) keep.delete("price"); else keep.set("price", String(next.price));
    row.length = 6;
    if (keep.size) row.push(`{ ${[...keep].map(([k, v]) => `${k}: ${v}`).join(", ")} }`);
    src = `${src.slice(0, at)}[${row.join(", ")}]${src.slice(close + 1)}`;
  }
  return src;
}

/** Imports the rewritten roster and compares it with what the edits ask for: every species, every field. */
export async function verify(src, edits, game) {
  const dir = mkdtempSync(join(tmpdir(), "apply-species-")), path = join(dir, "roster.ts");
  try {
    writeFileSync(path, src);
    const { ROSTER } = await fresh().import(path), by = new Map(game.ROSTER.map((s) => [s.key, s])), bad = [];
    if (ROSTER.length !== game.ROSTER.length) bad.push(`species count ${game.ROSTER.length} -> ${ROSTER.length}`);
    for (const got of ROSTER) {
      const was = by.get(got.key), e = edits.get(got.key);
      const want = e ? edited(was, e, game.SELL_PRICES) : was;
      for (const f of new Set([...Object.keys(want), ...Object.keys(got)])) {
        const norm = (v) => JSON.stringify(f === "months" && Array.isArray(v) ? [...v].sort((a, b) => a - b) : v);
        if (norm(got[f]) !== norm(want[f])) bad.push(`${got.key}.${f}: wrote ${norm(got[f])}, wanted ${norm(want[f])}`);
      }
    }
    return bad;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, flag] = process.argv.slice(2);
  if (!file) { console.error("usage: node scripts/apply-species.mjs <export.json> [--dry]"); process.exit(2); }
  const game = await loadGame(), edits = editsOf(JSON.parse(readFileSync(file, "utf8")));
  const fail = (what, list) => { console.error(`${what}:\n  ${list.join("\n  ")}\nNothing written.`); process.exit(1); };
  const bad = check(edits, game);
  if (bad.length) fail("These values can't go in the game", bad);
  const src = rewrite(readFileSync(ROSTER_TS, "utf8"), edits, game);
  const wrong = await verify(src, edits, game);
  if (wrong.length) fail("The rewritten roster doesn't hold the values", wrong);
  console.log(`${edits.size} species checked.`);
  if (flag === "--dry") process.exit(0);
  writeFileSync(ROSTER_TS, src);
  console.log(`wrote ${ROSTER_TS}`);
  execFileSync(process.execPath, [join(WEB, "scripts/gen-seeds.mjs")], { cwd: WEB, stdio: "inherit" });
}
