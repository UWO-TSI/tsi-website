/**
 * Loads and decodes every image on the page now, lazy ones included, so none of them is fetched or decoded in the
 * middle of a scroll. The loading screen waits on it; after that, each page navigation warms its images when idle.
 */
export function warmImages(): { total: number; settled: () => number; done: Promise<void> } {
  const imgs = Array.from(document.images);
  let n = 0;
  const jobs = imgs.map((im) => {
    if (im.loading === "lazy") im.loading = "eager";
    const loaded = im.complete
      ? Promise.resolve()
      : new Promise<void>((res) => {
          im.addEventListener("load", () => res(), { once: true });
          im.addEventListener("error", () => res(), { once: true });
        });
    return loaded.then(() => (im.naturalWidth ? im.decode().catch(() => {}) : undefined)).finally(() => { n += 1; });
  });
  return { total: imgs.length, settled: () => n, done: Promise.all(jobs).then(() => {}) };
}

/**
 * Pieces that need a moment to get going (the globe compiles its shaders on its first frame) mark an element with
 * data-ready-wait and set data-ready on it once they have drawn. This says how many there are and how many are ready.
 */
export function readyWaits(): { total: number; ready: number } {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-ready-wait]"));
  return { total: els.length, ready: els.filter((el) => el.dataset.ready === "1").length };
}
