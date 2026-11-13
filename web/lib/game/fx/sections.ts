/**
 * An awakened rod's floating sections (the Titanium, rod-titanium round 3; David 2026-11-13: "i want the parts to split
 * open each section one by one and they open in like not the same side like 0 degreen 30 degreen 60 degree ... and the
 * unlock sequence has a lil shake for each part and smoke comes out like a machine moving and then its a neon henergy
 * beam rod with the sections floading around"; "it should open from bottom to top and it should open angeled outwards
 * ... it should hover and float ... it follows teh rod but theres a lil staggar and it spins aroudn the main energy beam
 * like cw and ccw each layer rotating"). Plain numbers; RodSections.tsx draws them.
 *
 * Open, a section's plates lean out from its foot by SECTION_TILT and stand off the beam (SECTION_PUSH times their
 * pivot radius, and a centimetre), the section turning round the beam, each the other way from the one below. At rest
 * (in the bag, in a hand) every section is open. In the awakening the cutscene sets an `Unlock` on an ancestor: the
 * sections unlock one at a time from the bottom (a shake, then a puff of smoke as it cracks open to CRACK), and at the
 * burst (`float`) all of them open and float.
 */

/** How far (rad) a plate leans out from its foot, open. */
export const SECTION_TILT = 0.55;
/** How far a plate stands off the beam, open: this many times its pivot radius (plus SECTION_GAP). */
export const SECTION_PUSH = 1.4;
export const SECTION_GAP = 0.008;
/** How open a section stands once unlocked, before the burst floats them all. */
export const CRACK = 0.35;
/** The share of a section's turn in the unlock it shakes before it cracks. */
export const SHAKE_FOR = 0.5;

/** The cutscene's progress: `seq` 0 to 1 through the unlocks (bottom first), `float` 1 from the burst on. */
export interface Unlock { seq: number; float: number }

/** Section `i` of `n` under `unlock` (null: at rest, open): how open it should stand, and whether it shakes now. */
export function sectionAt(i: number, n: number, unlock: Unlock | null): { open: number; shake: boolean; cracked: boolean } {
  if (!unlock || unlock.float > 0) return { open: 1, shake: false, cracked: true };
  const local = unlock.seq * n - i;
  if (local <= 0) return { open: 0, shake: false, cracked: false };
  if (local < SHAKE_FOR) return { open: 0, shake: true, cracked: false };
  return { open: CRACK, shake: false, cracked: true };
}

/** Section `i`'s turn round the beam (rad/s): each the other way from the one below, not all at one speed. */
export const spinOf = (i: number) => (i % 2 ? -1 : 1) * (0.55 + 0.15 * (i % 3));

/** How much a section turns at an opening `open`: none until it floats past its crack. */
export const spinningAt = (open: number) => { const x = Math.min(1, Math.max(0, (open - CRACK) / (1 - CRACK))); return x * x * (3 - 2 * x); };

/** The unlock the nearest ancestor of `o` carries in its userData (`unlock`), or null. */
export function unlockOf(o: { parent: unknown; userData: Record<string, unknown> } | null): Unlock | null {
  for (let n = o; n; n = n.parent as typeof o) if (n.userData.unlock) return n.userData.unlock as Unlock;
  return null;
}
