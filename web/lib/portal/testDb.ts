/**
 * Test support for the portal's data helpers: a Supabase client over in-memory rows that answers like PostgREST when
 * a query names a column the migrations never made (`column x.y does not exist`), so a test fails on the same typo
 * production does. Columns come from every CREATE TABLE / ADD COLUMN in supabase/migrations. Embedded rows
 * (`item:marketplace_items(name)`) are checked against their table but returned as the fixture row holds them.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
const DIR = join(__dirname, "../../supabase/migrations");
let cached: Map<string, Set<string>> | null = null;

/** Every table's columns, as the migrations leave them. */
export function schemaColumns(): Map<string, Set<string>> {
  if (cached) return cached;
  const cols = new Map<string, Set<string>>();
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(DIR, file), "utf8");
    for (const [, table, body] of sql.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      const set = cols.get(table) ?? new Set<string>();
      for (const line of body.split("\n")) {
        const name = line.trim().match(/^"?(\w+)"?\s+[a-z]/i)?.[1];
        if (name && !/^(primary|unique|check|constraint|foreign|exclude)$/i.test(name)) set.add(name);
      }
      cols.set(table, set);
    }
    for (const [, table, body] of sql.matchAll(/alter table (?:if exists )?(?:only )?(?:public\.)?(\w+)([^;]*);/gi)) {
      for (const [, col] of body.matchAll(/add column (?:if not exists )?"?(\w+)"?/gi)) cols.get(table)?.add(col);
    }
  }
  return (cached = cols);
}

/** Top-level comma split that keeps `rel(a, b)` together. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The first unknown column in a PostgREST select list on `table`, or null. */
export function unknownColumn(table: string, select: string): string | null {
  const known = schemaColumns().get(table);
  if (!known) return `relation "${table}" does not exist`;
  for (const part of splitTop(select)) {
    if (part === "*") continue;
    const embed = part.match(/^(?:\w+:)?(\w+)(?:!\w+)?\s*\(([\s\S]*)\)$/);
    if (embed) {
      const inner = unknownColumn(embed[1], embed[2]);
      if (inner) return inner;
      continue;
    }
    const col = part.replace(/^\w+:/, "").replace(/::\w+$/, "").trim();
    if (!known.has(col)) return `column ${table}.${col} does not exist`;
  }
  return null;
}

const firstUnknown = (table: string, keys: string[]) => {
  const known = schemaColumns().get(table);
  const bad = keys.find((k) => !known?.has(k));
  return bad ? `column ${table}.${bad} does not exist` : null;
};

/**
 * A client over `tables`. `userId` null: signed out; `down` tables answer every query with an error (an outage).
 * Every insert gets an id; `writes` records each write in order.
 */
export function fakeDb(tables: Record<string, Row[]>, { userId = "00000000-0000-4000-8000-0000000000aa", down = [] }: { userId?: string | null; down?: string[] } = {}) {
  const writes: { table: string; op: "insert" | "update" | "delete"; row: Row }[] = [];
  let n = 0;
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let error: string | null = down.includes(table) ? "upstream connect error" : schemaColumns().has(table) ? null : `relation "${table}" does not exist`;
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row[] = [];
    let one: "single" | "maybe" | null = null;
    let head = false, selected = false, order: [string, boolean] | null = null, limit = Infinity;
    const note = (e: string | null) => { if (!error) error = e; };
    const run = () => {
      if (error) return { data: null, error: { message: error, code: "42703" }, count: null };
      const rows = (tables[table] ??= []);
      let data: Row[];
      if (op === "insert") {
        data = payload.map((r) => ({ id: `row-${++n}`, ...r }));
        rows.push(...data);
        data.forEach((row) => writes.push({ table, op: "insert", row }));
      } else {
        data = rows.filter((r) => filters.every((f) => f(r)));
        if (op === "update") data.forEach((r) => { Object.assign(r, payload[0]); writes.push({ table, op: "update", row: r }); });
        if (op === "delete") data.forEach((r) => { rows.splice(rows.indexOf(r), 1); writes.push({ table, op: "delete", row: r }); });
      }
      if (order) { const [col, asc] = order; data = [...data].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)); }
      data = data.slice(0, limit);
      if (head) return { data: null, error: null, count: data.length };
      if (one) {
        if (data.length !== 1 && one === "single") return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, count: null };
        return { data: data[0] ?? null, error: null, count: null };
      }
      return { data: op === "select" || selected ? data : null, error: null, count: data.length };
    };
    const q = {
      select(cols = "*", opts?: { head?: boolean }) { note(unknownColumn(table, cols)); head = !!opts?.head; selected = true; return q; },
      insert(rows: Row | Row[]) { op = "insert"; payload = Array.isArray(rows) ? rows : [rows]; payload.forEach((r) => note(firstUnknown(table, Object.keys(r)))); return q; },
      update(patch: Row) { op = "update"; payload = [patch]; note(firstUnknown(table, Object.keys(patch))); return q; },
      delete() { op = "delete"; return q; },
      eq(col: string, v: unknown) { note(firstUnknown(table, [col])); filters.push((r) => r[col] === v); return q; },
      neq(col: string, v: unknown) { note(firstUnknown(table, [col])); filters.push((r) => r[col] !== v); return q; },
      in(col: string, vs: unknown[]) { note(firstUnknown(table, [col])); filters.push((r) => vs.includes(r[col])); return q; },
      order(col: string, opts?: { ascending?: boolean }) { note(firstUnknown(table, [col])); order = [col, opts?.ascending ?? true]; return q; },
      limit(k: number) { limit = k; return q; },
      single() { one = "single"; return q; },
      maybeSingle() { one = "maybe"; return q; },
      then<T>(ok: (v: ReturnType<typeof run>) => T, bad?: (e: unknown) => T) { return Promise.resolve(run()).then(ok, bad); },
    };
    return q;
  };
  const db = { from, auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) } };
  return { db: db as unknown as SupabaseClient, writes, tables };
}
