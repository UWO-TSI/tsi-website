import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// /lab/item asset listing — dev-only (404 in production, like all /lab).
// Walks web/public for every .glb so the item bench can browse the full
// shipped asset set.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const publicRoot = path.join(process.cwd(), "public");
  const assets: string[] = [];

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.toLowerCase().endsWith(".glb")) {
        assets.push("/" + path.relative(publicRoot, p).split(path.sep).join("/"));
      }
    }
  };

  walk(publicRoot);
  assets.sort();
  return NextResponse.json({ assets });
}
