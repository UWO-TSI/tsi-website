/**
 * GENESIS 2027's own details for the pass (specs/genesis-pass.md). Empty until David sends them: each page says the
 * details are coming. Fill these in and the pages show them.
 */
export const EVENT = {
  /** e.g. "Saturday, March 20, 2027" */
  date: null as string | null,
  /** e.g. { name: "Somerville House", address: "…" } */
  venue: null as { name: string; address: string } | null,
  /** The floor map image in public/genesis/, and the spots on it as percentages of its width and height. */
  map: null as { image: string; spots: { label: string; x: number; y: number; href?: string }[] } | null,
  schedule: [] as { time: string; title: string; detail?: string }[],
  sponsors: [] as { name: string; logo?: string; site?: string; tier?: string }[],
};
