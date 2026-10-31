/**
 * What every page bundled by build.mjs needs inside the claude.ai artifact frame (Face Fit, Residents): uncaught errors
 * on the page's `#fault` line, the .glb.json model loader, and error boundaries. Importing it installs the first two.
 */
import { Component, useEffect, type ReactNode } from "react";
import * as THREE from "three";

/** Any uncaught error, on a line at the top, so David can say what it says. */
export const fault = (m: string) => { const el = document.getElementById("fault"); if (el) { el.hidden = false; el.textContent = `Something went wrong: ${m}`; } };
addEventListener("error", e => fault(e.message || String(e.error)));
addEventListener("unhandledrejection", e => fault(String((e.reason as { message?: string })?.message ?? e.reason)));
/**
 * The models are .glb.json files (build.mjs): a GLB in base64. The artifact frame refuses data: and blob: fetches, so
 * each is fetched as the page's own file and handed to the game's loader as the GLB bytes it asked for.
 */
const fileLoad = THREE.FileLoader.prototype.load;
THREE.FileLoader.prototype.load = function (this: THREE.FileLoader, url, onLoad, onProgress, onError) {
  if (!url.endsWith(".glb.json")) return fileLoad.call(this, url, onLoad, onProgress, onError);
  const at = this.manager.resolveURL(this.path + url);
  this.manager.itemStart(at);
  fetch(at).then(r => { if (!r.ok) throw new Error(`${r.status} ${at}`); return r.json() as Promise<string>; })
    .then(b64 => { const s = atob(b64), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); onLoad?.(b.buffer); })
    .catch(e => { onError?.(e); this.manager.itemError(at); })
    .finally(() => this.manager.itemEnd(at));
};
/** A failure inside it shows `fallback` instead of unmounting the page. */
export class Catch extends Component<{ children: ReactNode; fallback: (message: string) => ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { error: String((e as { message?: string })?.message ?? e) }; }
  render() { return this.state.error === null ? this.props.children : this.props.fallback(this.state.error); }
}
/** Inside the 3D tree a fallback can't draw DOM: it hands the message to its cell. */
export function Report({ message, to }: { message: string; to: (m: string) => void }) {
  useEffect(() => to(message), [message, to]);
  return null;
}
