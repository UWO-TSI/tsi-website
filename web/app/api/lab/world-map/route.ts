import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { villageJson, type VillageDoc } from "@/lib/game/villageMap";

// /lab/map's world map (terrain v2): read and save web/data/world-map.json. Dev only (404 in production, like all
// /lab). The world map is David's painted source of truth since 2026-10-10 (specs/terrain-v2.md), so Save writes it
// straight to the repo; committing it stays a human step. One fixed file, never a path from the request.
const FILE = path.join(process.cwd(), "data", "world-map.json");
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export async function GET() {
  if (process.env.NODE_ENV === "production") return notFound();
  try {
    return new NextResponse(fs.readFileSync(FILE, "utf8"), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "world-map.json is missing" }, { status: 500 });
  }
}

/** What a saved map must look like before it may replace the file: the grid's shape, and objects with places. */
function problem(doc: unknown): string | null {
  if (!doc || typeof doc !== "object") return "not a map document";
  const d = doc as Partial<VillageDoc>;
  const size = (n: unknown) => Number.isInteger(n) && (n as number) > 0 && (n as number) <= 1024;
  if (!size(d.width) || !size(d.depth)) return "width and depth must be whole numbers up to 1024";
  const rows = (a: unknown) => Array.isArray(a) && a.length === d.depth && a.every(r => typeof r === "string" && r.length === d.width);
  if (!rows(d.levels) || !rows(d.surfaces)) return "levels and surfaces must be one string per row, one character per cell";
  if (!Array.isArray(d.objects)) return "objects must be a list";
  for (const o of d.objects) {
    if (!o || typeof o.id !== "string" || typeof o.kind !== "string" || !Number.isFinite(o.x) || !Number.isFinite(o.z)) return "every object needs an id, a kind and a finite x and z";
  }
  if (d.annotations !== undefined && !Array.isArray(d.annotations)) return "annotations must be a list";
  return null;
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return notFound();
  let doc: unknown;
  try {
    doc = await req.json();
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 400 });
  }
  const bad = problem(doc);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  // Write beside the file and rename over it, so a crash mid-save never leaves half a map.
  const tmp = `${FILE}.saving`;
  fs.writeFileSync(tmp, villageJson(doc as VillageDoc));
  fs.renameSync(tmp, FILE);
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
