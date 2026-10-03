/**
 * A donation reaching its case (specs/polish/forage-craft-museum.md 8): the curator takes it at her desk, and the
 * specimen fades into its case or tank across the room, growing into place with a little settle, while the camera
 * looks over and a sparkle marks it. Which species was just donated (and when) is kept here for its case to find.
 */
/** How long the specimen takes to fade in (ms). */
export const DONATE_FADE_MS = 1500;
/** How long the camera looks toward it (ms). */
export const DONATE_LOOK_MS = 2800;

const donated = new Map<string, number>();
/** A species was just donated, at `at` (performance.now()). */
export function markDonated(key: string, at: number) { donated.set(key, at); }
/** When it was donated this session, or null. */
export const donatedAt = (key: string | null): number | null => (key ? donated.get(key) ?? null : null);

/**
 * The specimen `t` ms into its fade: opacity 0 to 1, a scale that grows past full and settles, and a small rise into
 * place. Past the fade (or never donated here): solid and still.
 */
export function fadeInto(t: number, out = { opacity: 1, scale: 1, rise: 0 }): { opacity: number; scale: number; rise: number } {
  if (!(t < DONATE_FADE_MS)) { out.opacity = 1; out.scale = 1; out.rise = 0; return out; }
  const u = Math.max(0, t / DONATE_FADE_MS);
  const grow = 1 - (1 - u) ** 3;
  out.opacity = Math.min(1, u * 1.6);
  out.scale = 0.6 + 0.4 * grow + 0.08 * Math.sin(u * Math.PI) * (1 - u);
  out.rise = -0.12 * (1 - grow);
  return out;
}
