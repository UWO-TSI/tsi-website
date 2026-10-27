/// <reference lib="webworker" />
/** The smooth world's derivation off the main thread (derive.ts): the terrain in, its derived fields back, transferred. */
import { deriveWorld, derivedBuffers } from "./derive";
import type { WorldTerrain } from "./terrain";

self.onmessage = (e: MessageEvent<WorldTerrain>) => {
  const out = deriveWorld(e.data);
  (self as unknown as Worker).postMessage(out, derivedBuffers(out));
};
