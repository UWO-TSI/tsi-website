import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Dev only: a crop of David's Animal Crossing UI kit for the /lab/gui comparison column. The crops live outside the
 * repo (specs/evidence/gui-sheet/ref_crops.py writes them to GUI_REF_DIR) and are never part of the product.
 */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { name } = await params;
  if (!/^[a-z-]+$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const file = await readFile(path.join(process.env.GUI_REF_DIR ?? "/private/tmp/claude-501/gui-sheet-ref/crops", `${name}.webp`));
    return new Response(new Uint8Array(file), { headers: { "content-type": "image/webp", "cache-control": "no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
