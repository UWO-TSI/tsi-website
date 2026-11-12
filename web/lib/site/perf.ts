/**
 * Whether this machine should get the lighter version of the site's effects: fewer globe points, a 1x canvas
 * resolution, lower frame rates for idle animations and no idle float. Decided once per visit from the hardware
 * (4 or fewer cores, or 4 GB or less of memory), and the loading screen can also set it if frames ran slow while it
 * was up. Stored on <html data-perf="low">, so CSS can follow it too.
 */
const KEY = "tethos-perf";

export function lowPower(): boolean {
  if (typeof window === "undefined") return false;
  const html = document.documentElement;
  if (html.dataset.perf) return html.dataset.perf === "low";
  let low = false;
  try { low = sessionStorage.getItem(KEY) === "low"; } catch {}
  if (!low) {
    const nav = navigator as Navigator & { deviceMemory?: number };
    low = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  }
  html.dataset.perf = low ? "low" : "full";
  return low;
}

/** Called by the loading screen when frames ran slow while it was up: the rest of the visit runs the lighter version. */
export function markLowPower() {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.perf = "low";
  try { sessionStorage.setItem(KEY, "low"); } catch {}
  window.dispatchEvent(new Event("tethos-perf"));
}

/** The canvas resolution to draw at: the screen's, capped at 2, or 1 on a low-power machine. */
export function canvasDpr(cap = 2): number {
  if (typeof window === "undefined") return 1;
  return lowPower() ? 1 : Math.min(window.devicePixelRatio || 1, cap);
}
