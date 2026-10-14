import { NextResponse } from "next/server";
import path from "path";
import { decodeWorld, fromBase64, toBase64, worldDocProblem, type WorldDoc } from "@/lib/game/world/format";
import { readWorldFiles, writeWorldFiles } from "@/lib/game/world/disk";

// The world editor's files (specs/world-editor.md): read and save web/data/world/ (world.json, height.png,
// surface.png). Dev only (404 in production, like all /lab). Save writes the three files straight to the repo, each
// beside itself and renamed over (lib/game/world/disk.ts); committing them stays a human step. One fixed directory,
// never a path from the request, and a save is decoded in full before anything is written.
const DIR = path.join(process.cwd(), "data", "world");
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export async function GET() {
  if (process.env.NODE_ENV === "production") return notFound();
  try {
    const f = readWorldFiles(DIR);
    return NextResponse.json({ json: f.json, height: toBase64(f.height), surface: toBase64(f.surface) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: `web/data/world can't be read: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return notFound();
  let body: { json?: unknown; height?: unknown; surface?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 400 });
  }
  if (typeof body.json !== "string" || typeof body.height !== "string" || typeof body.surface !== "string") {
    return NextResponse.json({ error: "send { json, height, surface }: the document text and the two images in base64" }, { status: 400 });
  }
  let doc: WorldDoc;
  try {
    doc = JSON.parse(body.json) as WorldDoc;
  } catch {
    return NextResponse.json({ error: "world.json is not JSON" }, { status: 400 });
  }
  const bad = worldDocProblem(doc);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const height = fromBase64(body.height), surface = fromBase64(body.surface);
  // Everything must load before anything is written: the images' size, their kind, every paint named.
  try {
    decodeWorld(doc, height, surface);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  writeWorldFiles(DIR, { json: body.json, height, surface });
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString(), bytes: { json: body.json.length, height: height.length, surface: surface.length } });
}
