/**
 * The boss fight's camera (specs/launch/v1-gameplay.md, "Fish tiers and fights"): a legendary or divine catch is far
 * too big for the follow camera, so while it surfaces and fights the camera pulls out to frame it, the angler in the
 * foreground. Plain module store: the world's creature (components/game/fishing/BossCreature.tsx) sets the shot, the
 * follow camera (IslandAtmosphere useFollowCamera) eases into it and back out.
 */
export const bossCam = { want: 0, w: 0, at: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 } };

/**
 * Frame a creature of `height` standing `out` units from the angler at (x, z) along the throw (dirX, dirZ): the eye
 * behind and above the angler, looking at the space between them, so both stay in the shot.
 */
export function frameBoss(x: number, y: number, z: number, dirX: number, dirZ: number, out: number, height: number) {
  const back = 0.55 * out + 4, up = 0.45 * height + 3;
  bossCam.at = { x: x - dirX * back, y: y + up, z: z - dirZ * back };
  bossCam.look = { x: x + dirX * out * 0.55, y: y + height * 0.38, z: z + dirZ * out * 0.55 };
  bossCam.want = 1;
}
export function releaseBossCam() { bossCam.want = 0; }
