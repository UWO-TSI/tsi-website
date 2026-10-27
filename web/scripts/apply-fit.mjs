/**
 * Writes David's fit from the fit editor (specs/lanes/fit-editor.md) into the character catalogue's `fit` map (look.ts
 * FIT): `node scripts/apply-fit.mjs <export.json>`. The export is the editor page's db collection `fit`: one doc per
 * item id, `{ x, y, z }` for a hairstyle or accessory (metres along the head's own axes: its left, up, forward),
 * `{ eyes, mouth, eyesApart }` for a whole face (face canvas units up, and each eye away from the centre line); an
 * older doc with fewer fields reads the same. It may be an array of docs (`{ id | doc_id, data }`, or the fields beside the id) or an `{ id: fields }`
 * map. Every id and value is checked before anything is written; zeros are dropped. Both copies are written, the art
 * source and the web copy (look.test.ts checks they match), changing only the `fit` key's text.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CATALOGUES = [join(web, "../art/characters/character_catalog.json"), join(web, "data/characters/character_catalog.json")];
const FACES = join(web, "data/characters/face_v7.json");
/** The furthest a move may go: a head piece's in metres, a face part's in face canvas units. */
export const LIMIT = { x: 0.1, y: 0.1, z: 0.1, eyes: 0.2, mouth: 0.2, eyesApart: 0.2 };

/** The export's docs as [id, fields] pairs. */
function docs(raw) {
  const ID = ["id", "doc_id", "_id"];
  if (Array.isArray(raw)) return raw.map(d => [ID.map(k => d?.[k]).find(Boolean),
    d?.data ?? Object.fromEntries(Object.entries(d ?? {}).filter(([k]) => !ID.includes(k)))]);
  if (raw && typeof raw === "object") return Object.entries(raw.docs ?? raw.documents ?? raw);
  throw new Error("the export is neither a list of docs nor a map of them");
}

/** The catalogue's new `fit` map from an export, checked against the catalogue's parts and the whole faces. */
export function fitFrom(raw, catalog, faces) {
  const parts = new Set(["outfits", "accessories", "hair", "robloxAccessories"].flatMap(k => (catalog[k] ?? []).map(p => p.id)));
  const faceIds = new Set(Object.values(faces.faces ?? {}).map(f => f.id));
  const out = {}, errors = [];
  for (const [id, fields] of docs(raw)) {
    const keys = parts.has(id) ? ["x", "y", "z"] : faceIds.has(id) ? ["eyes", "mouth", "eyesApart"] : null;
    if (!keys) { errors.push(`${id}: not a catalogue part or a whole face`); continue; }
    const fit = {};
    for (const [k, v] of Object.entries(fields ?? {})) {
      if (!keys.includes(k)) { errors.push(`${id}: ${k} is not one of ${keys.join(", ")}`); continue; }
      if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > LIMIT[k]) { errors.push(`${id}: ${k} ${v} is not a number within ${LIMIT[k]}`); continue; }
      const r = Math.round(v * 1e4) / 1e4;
      if (r !== 0) fit[k] = r;
    }
    if (Object.keys(fit).length) out[id] = fit;
  }
  if (errors.length) throw new Error(`the export has ${errors.length} problem(s):\n${errors.join("\n")}`);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** The catalogue's text with its top-level `fit` set (or removed when empty); every other byte stays as it was. */
export function withFit(text, fit) {
  let s = text;
  const at = s.indexOf('\n "fit": {');
  if (at >= 0) {
    let i = s.indexOf("{", at), depth = 0;
    for (; i < s.length; i++) { if (s[i] === "{") depth++; else if (s[i] === "}" && --depth === 0) break; }
    // with the comma before it (after another key), else the one after it
    s = s[at - 1] === "," ? s.slice(0, at - 1) + s.slice(i + 1) : s.slice(0, at) + s.slice(s[i + 1] === "," ? i + 2 : i + 1);
  }
  if (!Object.keys(fit).length) return s;
  const close = s.lastIndexOf("\n}");
  const body = JSON.stringify(fit, null, 1).replace(/\n/g, "\n ");
  return `${s.slice(0, close)},\n "fit": ${body}${s.slice(close)}`;
}

export function applyFit(exportPath, catalogues = CATALOGUES, facesPath = FACES) {
  const raw = JSON.parse(readFileSync(exportPath, "utf8"));
  const texts = catalogues.map(p => readFileSync(p, "utf8"));
  const fit = fitFrom(raw, JSON.parse(texts[0]), JSON.parse(readFileSync(facesPath, "utf8")));
  texts.forEach((t, i) => {
    const next = withFit(t, fit);
    JSON.parse(next);                                                   // never write a catalogue that doesn't parse
    writeFileSync(catalogues[i], next);
  });
  return fit;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (!process.argv[2]) { console.error("usage: node scripts/apply-fit.mjs <export.json>"); process.exit(1); }
  const fit = applyFit(process.argv[2]);
  console.log(`fit: ${Object.keys(fit).length} item(s) set`);
  for (const [id, f] of Object.entries(fit)) console.log(`  ${id} ${JSON.stringify(f)}`);
}
