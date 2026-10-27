/**
 * The title page loads the game (David, 2026-10-26: "I want title page to already start loading everything just so that
 * less time is spent loading the game"). Once the title has drawn, in idle time, the browser prefetches what the island
 * asks for after Let's Play into its cache: first the island's code (read from the build itself, so it never goes stale),
 * then its models, textures and sounds in the order the island loads them (lib/game/preloadAssets.ts). `rel=prefetch`
 * is the browser's lowest priority, off the main thread, so the title's own frames and files go first, and a prefetched
 * file is used without asking the server again for five minutes. A few at a time, fewer on a slow line; nothing on a
 * phone (it gets the companion, not the island) or with data saver on.
 */

const CHUNK = /static\/chunks\/[\w.-]+\.js/g;
let started = false;

/** The island's code chunks: the dashboard page's own (in its HTML), and the island's import list inside them. */
async function islandCode(): Promise<string[]> {
  // Signed out, the island redirects to sign in: there's no island page to read yet.
  const page = await fetch("/student/dashboard", { redirect: "manual", priority: "low" } as RequestInit);
  if (!page.ok) return [];
  const own = [...new Set((await page.text()).match(/\/_next\/static\/chunks\/[\w.-]+\.js/g) ?? [])];
  const inner = await Promise.all(own.map(u => fetch(u, { priority: "low" } as RequestInit).then(r => (r.ok ? r.text() : ""), () => "")));
  return [...new Set(inner.flatMap(js => js.match(CHUNK) ?? []).map(c => `/_next/${c}`))];
}

function prefetch(urls: readonly string[], parallel: number) {
  let next = 0;
  const one = () => {
    if (next >= urls.length) return;
    const link = Object.assign(document.createElement("link"), { rel: "prefetch", href: urls[next++] });
    link.onload = link.onerror = () => { link.remove(); one(); };
    document.head.appendChild(link);
  };
  for (let i = 0; i < parallel; i++) one();
}

export function preloadGame() {
  if (started || typeof window === "undefined") return;
  started = true;
  const line = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (line?.saveData || /2g/.test(line?.effectiveType ?? "") || window.matchMedia("(pointer: coarse)").matches) return;
  const slow = line?.effectiveType === "3g";
  const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200));
  idle(() => {
    void Promise.all([islandCode().catch(() => []), import("@/lib/game/preloadAssets")])
      .then(([code, { GAME_ASSETS }]) => prefetch([...code, ...GAME_ASSETS], slow ? 2 : 6));
  });
}
