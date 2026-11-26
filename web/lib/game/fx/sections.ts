/**
 * An awakened rod's floating sections (the Titanium, rod-titanium round 3; David 2026-11-13: "i want the parts to split
 * open each section one by one and they open in like not the same side like 0 degreen 30 degreen 60 degree ... and the
 * unlock sequence has a lil shake for each part and smoke comes out like a machine moving and then its a neon henergy
 * beam rod with the sections floading around"; "it should open from bottom to top and it should open angeled outwards
 * ... it should hover and float ... it follows teh rod but theres a lil staggar and it spins aroudn the main energy beam
 * like cw and ccw each layer rotating"). Plain numbers; RodSections.tsx draws them.
 *
 * Open, a section's plates lean out from its foot by SECTION_TILT and stand off the beam (SECTION_PUSH times their
 * pivot radius, and SECTION_GAP), the section turning round the beam, each the other way from the one below. At rest
 * (in the bag, in a hand) every section is open. In the awakening the cutscene sets an `Unlock` on an ancestor: the
 * sections unlock one at a time from the bottom (a shake, then a puff of smoke as it cracks open to CRACK), and at the
 * burst (`float`) all of them open and float.
 */

/** How far (rad) a plate leans out from its foot, open. */
export const SECTION_TILT = 0.22;
/** How far a plate stands off the beam, open: this many times its pivot radius (plus SECTION_GAP). */
export const SECTION_PUSH = 0.9;
export const SECTION_GAP = 0.006;
/** How open a section stands once unlocked, before the burst floats them all. */
export const CRACK = 0.5;
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

/**
 * The sections opened in place on the CPU, as the vertex shader opens them (RodSections.tsx `sectionMove`), each turned
 * `turn(i)`: for a still picture of the awakened rod (its icon, /lab/icons). `position` and `normal` (xyz arrays) are
 * changed; `section` is the mesh's UV (its section, its plate's middle angle); `feet` its `sections` extra.
 */
export function openSections(position: Float32Array, normal: Float32Array | null, section: ArrayLike<number>, feet: readonly number[], turn = (i: number) => i * 0.9) {
  const c = Math.cos(SECTION_TILT), sn = Math.sin(SECTION_TILT);
  for (let v = 0; v < position.length / 3; v++) {
    const i = Math.round(section[v * 2]), phi = section[v * 2 + 1], foot = feet[i * 2], pivot = feet[i * 2 + 1];
    const dx = Math.cos(phi), dz = Math.sin(phi), ca = Math.cos(turn(i)), sa = Math.sin(turn(i));
    const move = (x: number, y: number, z: number, point: boolean): [number, number, number] => {
      const rho = x * dx + z * dz, tau = -x * dz + z * dx, h = point ? y - foot : y, dr = point ? rho - pivot : rho;
      const r2 = (point ? pivot + SECTION_PUSH * pivot + SECTION_GAP : 0) + dr * c + h * sn, h2 = h * c - dr * sn + (point ? foot : 0);
      const px = dx * r2 - dz * tau, pz = dz * r2 + dx * tau;
      return [ca * px - sa * pz, h2, sa * px + ca * pz];
    };
    position.set(move(position[v * 3], position[v * 3 + 1], position[v * 3 + 2], true), v * 3);
    if (normal) normal.set(move(normal[v * 3], normal[v * 3 + 1], normal[v * 3 + 2], false), v * 3);
  }
}
