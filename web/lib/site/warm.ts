/**
 * Loads and decodes every image on the page now, lazy ones included, so none of them is fetched or decoded in the
 * middle of a scroll. Only the images that start within `within` px of the top count toward `total`, `settled` and
 * `done` (the loading screen waits on those: the first screens); the rest load alongside without holding it up.
 * After the first visit, each page navigation warms its images when idle.
 */
export function warmImages(within = Infinity): { total: number; settled: () => number; done: Promise<void> } {
  const imgs = Array.from(document.images);
  let n = 0;
  const waited: Promise<void>[] = [];
  for (const im of imgs) {
    const counts = im.getBoundingClientRect().top + window.scrollY < within;
    if (im.loading === "lazy") im.loading = "eager";
    const loaded = im.complete
      ? Promise.resolve()
      : new Promise<void>((res) => {
          im.addEventListener("load", () => res(), { once: true });
          im.addEventListener("error", () => res(), { once: true });
        });
    const job = loaded.then(() => (im.naturalWidth ? im.decode().catch(() => {}) : undefined));
    if (counts) waited.push(job.finally(() => { n += 1; }));
  }
  return { total: waited.length, settled: () => n, done: Promise.all(waited).then(() => {}) };
}
/**
 * Pieces that need a moment to get going (the globe compiles its shaders on its first frame) mark an element with
 * data-ready-wait and set data-ready on it once they have drawn. This says how many there are and how many are ready.
 */
export function readyWaits(): { total: number; ready: number } {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-ready-wait]"));
  return { total: els.length, ready: els.filter((el) => el.dataset.ready === "1").length };
}
