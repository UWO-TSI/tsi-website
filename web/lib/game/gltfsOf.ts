import { useGLTF } from "@react-three/drei";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const lists = new Map<string, GLTF[]>();
/**
 * A list of GLBs, each fetched and parsed once however many lists share it (useGLTF of a list caches the whole list, so
 * a door shared by four buildings, or skin.glb shared by three looks, was parsed again for every list). All start
 * loading at once; one array per list, so effects on it run when the list changes. useGLTF is a suspend-react cache read,
 * not a React hook, so it can run in a loop. The scenes are shared between callers: clone before changing one
 * (`prepareModel` does), and read the geometry and materials as they are.
 */
export function gltfsOf(urls: readonly string[]): GLTF[] {
  for (const u of urls) useGLTF.preload(u);
  const loaded = urls.map(u => useGLTF(u) as unknown as GLTF);
  const key = urls.join("\n"), last = lists.get(key);
  if (last && last.every((g, i) => g === loaded[i])) return last;
  lists.set(key, loaded);
  return loaded;
}
