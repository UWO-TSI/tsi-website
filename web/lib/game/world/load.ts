/**
 * The shipped world files, for the browser (the game's `/lab/island?fixture=v2`, perf:check's v2 scene): the document
 * is bundled, the two images are fetched from their hashed build URLs and decoded by the shared loader
 * (lib/game/world/format.ts). The editor reads and writes the files through its dev route instead (/api/lab/world), so
 * a save never hot-reloads the page it was made from.
 */
import doc from "@/data/world/world.json";
import { decodeWorld, type World, type WorldDoc } from "./format";

/** The images as build assets (hashed URLs): the bundler emits each file the `new URL` names. */
const HEIGHT_URL = new URL("../../../data/world/height.png", import.meta.url).href;
const SURFACE_URL = new URL("../../../data/world/surface.png", import.meta.url).href;

async function bytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

let shipped: Promise<World> | null = null;

/** The world as committed in web/data/world/ (fetched and decoded once a page). */
export function loadShippedWorld(): Promise<World> {
  return (shipped ??= Promise.all([bytes(HEIGHT_URL), bytes(SURFACE_URL)]).then(([h, s]) => decodeWorld(doc as unknown as WorldDoc, h, s)));
}
