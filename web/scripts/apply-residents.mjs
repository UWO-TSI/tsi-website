// The Residents page's db export (collection `residents`, one doc per slug holding only the fields David changed) into
// the sources the game reads them from (scripts/residentSources.ts names them), then the seed migration through
// gen-seeds (never an applied migration). Refuses the whole export on an unknown slug, place, part or an empty name.
// Run from web/: node scripts/apply-residents.mjs <export.json>
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { createJiti } from "jiti";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": web } });
const src = await jiti.import("./residentSources.ts");
const { DEFAULT_LOOK } = await jiti.import("../lib/game/character/look.ts");

export const FILES = {
  roster: join(web, "lib/content/residentRoster.ts"), cafe: join(web, "lib/game/cafe.ts"), sushi: join(web, "lib/game/sushiBar.ts"),
  welcome: join(web, "lib/game/welcome.ts"), hqLines: join(web, "lib/game/arrival/hq/lines.ts"), arrivalLines: join(web, "lib/game/arrival/lines.ts"),
};
/** Constants elsewhere that carry a resident's name (and the welcome's copy of the HQ lead's look), kept in step. */
const NAME_REFS = { wren: [["welcome", "HQ_LEAD"], ["hqLines", "WREN"]], "wharf-keeper": [["arrivalLines", "BRAM"]] };

/** The export's docs, checked: every problem in it at once, or the docs by slug. */
export function residentEdits(raw) {
  const docs = src.docsOf(raw), problems = [], out = {};
  for (const [slug, doc] of docs) {
    if (typeof slug !== "string") { problems.push("a doc without an id"); continue; }
    if (!doc || typeof doc !== "object") { problems.push(`${slug}: not a doc`); continue; }
    problems.push(...src.docProblems(slug, doc));
    const r = src.RESIDENT_BY_SLUG.get(slug);
    if (!r) continue;
    // only what differs from the source
    const changed = Object.fromEntries(Object.entries(doc).filter(([f, v]) => !src.same(v, r.base[f])));
    if (Object.keys(changed).length) out[slug] = changed;
  }
  if (problems.length) throw new Error(`refused, nothing written:\n  ${problems.join("\n  ")}`);
  return out;
}

// ---- writing TS sources: replace only the values that change, so comments and layout stay ------------------------
const ID = /^[A-Za-z_$][\w$]*$/;
/** A value as a TS literal on one line (strings double-quoted, plain keys bare). */
export function literal(v) {
  if (Array.isArray(v)) return `[${v.map(literal).join(", ")}]`;
  if (v && typeof v === "object") {
    const e = Object.entries(v).filter(([, x]) => x !== undefined);
    return e.length ? `{ ${e.map(([k, x]) => `${ID.test(k) ? k : JSON.stringify(k)}: ${literal(x)}`).join(", ")} }` : "{}";
  }
  return JSON.stringify(v);
}
/** Conversations, one per line, as RESIDENT_TALK lays them out. */
const talkLiteral = (talk, indent) => `[\n${talk.map(c => `${indent}  ${literal(c)},`).join("\n")}\n${indent}]`;
/** The look() helper's defaults (residentRoster.ts), left out of a roster look. */
const LOOK_DEFAULTS = { eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", top: null, bottom: null, onepiece: null, acc: {}, colors: {} };
/** A look without what parseLook would fill in anyway: the roster's look() defaults, else the game's DEFAULT_LOOK. */
const without = (look, defaults = DEFAULT_LOOK) => Object.fromEntries(Object.entries(look).filter(([k, v]) => !(k in defaults) || !src.same(v, defaults[k])));

class Source {
  constructor(path) { this.path = path; this.text = readFileSync(path, "utf8"); this.ast = ts.createSourceFile(path, this.text, ts.ScriptTarget.Latest, true); this.edits = []; }
  /** A top-level const's initializer, past any `as const` and type assertion. */
  constant(name) {
    for (const s of this.ast.statements) if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) if (d.name.getText() === name) return unwrap(d.initializer);
    throw new Error(`${this.path}: no const ${name}`);
  }
  replace(node, text) { this.edits.push([node.getStart(), node.getEnd(), text]); }
  indentOf(node) { const line = this.text.lastIndexOf("\n", node.getStart()) + 1; return this.text.slice(line).match(/^\s*/)[0]; }
  save() {
    if (!this.edits.length) return false;
    let t = this.text;
    for (const [a, b, s] of this.edits.sort((x, y) => y[0] - x[0])) t = t.slice(0, a) + s + t.slice(b);
    writeFileSync(this.path, t);
    return true;
  }
}
const unwrap = n => (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || ts.isSatisfiesExpression(n) ? unwrap(n.expression) : n);
const keyOf = p => (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : p.name.getText());
/** An object literal's property's value node. */
function prop(obj, key, where) {
  const p = obj.properties.find(q => ts.isPropertyAssignment(q) && keyOf(q) === key);
  if (!p) throw new Error(`${where}: no ${key}`);
  return unwrap(p.initializer);
}
/** PROPOSED_RESIDENTS' row({ slug, ... }) for a slug: its object. */
function rowOf(list, slug) {
  for (const e of list.elements) {
    const o = ts.isCallExpression(e) ? e.arguments[0] : e;
    if (o && ts.isObjectLiteralExpression(o) && ts.isStringLiteral(prop(o, "slug", "row")) && prop(o, "slug", "row").text === slug) return o;
  }
  throw new Error(`PROPOSED_RESIDENTS: no row for ${slug}`);
}
/** A nullable text column: empty is null. */
const orNull = v => (v === "" ? null : v);

/** Write the edits into the sources; returns the files changed. */
export function writeEdits(edits, files = FILES) {
  const s = Object.fromEntries(Object.entries(files).map(([k, p]) => [k, new Source(p)]));
  const looks = s.roster.constant("RESIDENT_LOOKS"), talk = s.roster.constant("RESIDENT_TALK"), rows = s.roster.constant("PROPOSED_RESIDENTS");
  for (const [slug, e] of Object.entries(edits)) {
    if (slug === "cafe-owner") {
      const owner = s.cafe.constant("CAFE_OWNER");
      if (e.display_name !== undefined) s.cafe.replace(prop(owner, "name", "CAFE_OWNER"), literal(e.display_name));
      if (e.look) s.cafe.replace(prop(owner, "look", "CAFE_OWNER"), literal(without(e.look)));
      if (e.canned_dialogue) s.cafe.replace(prop(owner, "lines", "CAFE_OWNER"), literal(e.canned_dialogue));
      if (e.sweeper_lines) s.cafe.replace(s.cafe.constant("SWEEPER_LINES"), literal(e.sweeper_lines));
      continue;
    }
    if (slug === "sushi-chef" || slug === "sushi-server") {
      s.sushi.replace(s.sushi.constant(slug === "sushi-chef" ? "CHEF_LOOK" : "SERVER_LOOK"), literal(without(e.look)));
      continue;
    }
    // a roster resident
    const row = rowOf(rows, slug);
    for (const f of ["display_name", "post", "bio", "tone", "schedule", "canned_dialogue"]) {
      if (e[f] !== undefined) s.roster.replace(prop(row, f, `row ${slug}`), literal(f === "tone" || f === "post" ? orNull(e[f]) : e[f]));
    }
    if (e.look) s.roster.replace(unwrap(prop(looks, slug, "RESIDENT_LOOKS")).arguments[0], literal(without(e.look, LOOK_DEFAULTS)));
    if (e.talk) { const n = prop(talk, slug, "RESIDENT_TALK"); s.roster.replace(n, talkLiteral(e.talk, s.roster.indentOf(n.parent))); }
    for (const [file, name] of NAME_REFS[slug] ?? []) {
      const o = s[file].constant(name);
      if (e.display_name !== undefined) s[file].replace(prop(o, "name", name), literal(e.display_name));
      if (e.look && o.properties.some(p => keyOf(p) === "look")) s[file].replace(prop(o, "look", name), literal(without(e.look)));
    }
  }
  return Object.values(s).filter(x => x.save()).map(x => x.path);
}

/** Where an old name still shows in the game's text (in a string, not a comment), for a person to reword: [file:line, text]. */
export function mentions(names, roots = ["lib", "components"].map(d => join(web, d))) {
  if (!names.length) return [];
  const re = new RegExp(`["'\`][^"'\`]*\\b(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`), comment = /^\s*(\/\/|\*|\/\*|\{\/\*)/;
  const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : []; });
  return roots.flatMap(walk).flatMap(p => readFileSync(p, "utf8").split("\n").flatMap((l, i) => (re.test(l) && !comment.test(l) ? [[`${p.slice(web.length + 1)}:${i + 1}`, l.trim()]] : [])));
}

export function applyResidents(exportPath, files = FILES) {
  const edits = residentEdits(JSON.parse(readFileSync(exportPath, "utf8")));
  const changed = writeEdits(edits, files);
  const renamed = Object.entries(edits).filter(([, e]) => e.display_name !== undefined).map(([slug]) => src.nameOf(src.RESIDENT_BY_SLUG.get(slug)));
  return { edits, changed, renamed };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (!process.argv[2]) { console.error("usage: node scripts/apply-residents.mjs <export.json>"); process.exit(1); }
  try {
    const { edits, changed, renamed } = applyResidents(process.argv[2]);
    console.log(`${Object.keys(edits).length} residents changed: ${Object.entries(edits).map(([s, e]) => `${s} (${Object.keys(e).join(", ")})`).join("; ") || "none"}`);
    for (const f of changed) console.log(`wrote ${f}`);
    if (changed.length) execFileSync("node", ["scripts/gen-seeds.mjs"], { cwd: web, stdio: "inherit" });
    const old = mentions(renamed);
    if (old.length) console.log(`\nThe old names still show in these lines (reword them by hand):\n${old.map(([at, l]) => `  ${at}  ${l}`).join("\n")}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
