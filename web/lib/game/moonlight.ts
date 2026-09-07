export const MOONLIGHT = { color: "#B6C9EF", strength: 0.85, position: [-18, 26, -12] as const };

/** Smooth night key: full from 20:00 to 04:00, absent from 06:00 to 18:00. */
export function moonlightWeight(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const fade = (t: number) => t * t * (3 - 2 * t);
  if (h <= 4 || h >= 20) return 1;
  if (h < 6) return 1 - fade((h - 4) / 2);
  if (h <= 18) return 0;
  return fade((h - 18) / 2);
}
