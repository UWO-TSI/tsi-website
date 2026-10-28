/**
 * The shipped world files, for the browser (the member island, the title): the document is bundled, the two images
 * are fetched from their hashed build URLs and decoded by the shared loader (lib/game/world/format.ts). The editor reads and writes the files through its dev route instead (/api/lab/world), so
 * a save never hot-reloads the page it was made from.
 */
import doc from "@/data/world/world.json";
import { seedTerrain } from "../grid";
import { setVillage, villageSwapped } from "../villageMap";
import { decodeWorld, type World, type WorldDoc } from "./format";
import "./member";
import type { DerivedWorld } from "./derive";
import { villageOfWorld } from "./village";

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
function loadShippedWorld(): Promise<World> {
  return (shipped ??= Promise.all([bytes(HEIGHT_URL), bytes(SURFACE_URL)]).then(([h, s]) => decodeWorld(doc as unknown as WorldDoc, h, s)));
}

/**
 * The member island's world, set before the island mounts: the shipped world replaces the cell view `village()` starts
 * from (lib/game/villageMap.ts). Null when a lab already swapped the island.
 */
let game: Promise<void> | null = null;
export function loadGameWorld(): Promise<void> | null {
  if (game || villageSwapped()) return game;
  return (game = loadShippedWorld().then(async w => {
    const derived = await deriveOffThread(w);
    const v = villageOfWorld(w, derived?.shore);
    if (derived) seedTerrain(v.map, derived.terrain);
    setVillage(v);
  }));
}

/**
 * The world's derived fields from a worker (derive.ts), so the loading screen never freezes on them. Null without
 * workers or on any failure: the game then derives them on first use, as before.
 */
function deriveOffThread(w: World): Promise<DerivedWorld | null> {
  if (typeof Worker === "undefined") return Promise.resolve(null);
  return new Promise(done => {
    try {
      const worker = new Worker(new URL("./deriveWorker.ts", import.meta.url), { type: "module" });
      const end = (out: DerivedWorld | null) => { worker.terminate(); done(out); };
      worker.onmessage = (e: MessageEvent<DerivedWorld>) => end(e.data);
      worker.onerror = () => end(null);
      worker.postMessage(w.terrain);
    } catch { done(null); }
  });
}
