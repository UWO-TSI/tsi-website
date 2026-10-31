/// <reference lib="webworker" />
/** One of the smooth world's derivations off the main thread (derive.ts): the terrain in, its derived fields back, transferred. */
import { derivePart, derivedBuffers, type DerivePart } from "./derive";
import type { WorldTerrain } from "./terrain";

self.onmessage = (e: MessageEvent<{ terrain: WorldTerrain; part: DerivePart }>) => {
  const out = derivePart(e.data.terrain, e.data.part);
  (self as unknown as Worker).postMessage(out, derivedBuffers(out));
};
