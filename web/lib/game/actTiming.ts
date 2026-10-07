/**
 * When a gathering act lands in the world (specs/polish/forage-craft-museum.md): at the clip's contact frame (its
 * `hits` in the clip catalogue, build_clips.py: the grab, the strike, the spade going in, each hammer blow), never on
 * the key press; and a node leaves the world only once the server has said it's yours (a full bag keeps it there).
 * Pure: VillageLife, the workbench and the bottle schedule their reactions from these.
 */
import { CLIP_BY_NAME } from "./character/look";
import type { ClipName } from "./character/clips";

/** The clips a gathering or crafting act plays. */
export const ACT_CLIPS = ["Pickup", "Forage", "Shake", "Strike", "Dig", "Net", "Craft"] as const satisfies readonly ClipName[];
export type ActClip = (typeof ACT_CLIPS)[number];

/** Milliseconds from the clip's start to each of its contacts, at `rate`. */
export function hitDelays(clip: ClipName, rate = 1): number[] {
  const info = CLIP_BY_NAME.get(clip);
  if (!info) return [400 / rate];
  return (info.hits?.length ? info.hits : [0.4]).map(h => (h * info.length * 1000) / rate);
}
/** Milliseconds from the clip's start to its first contact. */
export const contactDelay = (clip: ClipName, rate = 1) => hitDelays(clip, rate)[0];

/**
 * When the world takes the node (ms, on the same clock as `contactAt`): at the contact, or when the server's yes
 * arrives if that's later. Null while it hasn't answered, and for good when it said no.
 */
export function landAt(contactAt: number, answer: { ok: boolean; at: number } | null): number | null {
  if (!answer || !answer.ok) return null;
  return Math.max(contactAt, answer.at);
}
