/**
 * A remote player talking while their speech bubble shows (specs/v1-drop.md §3; lib/net/chat.ts talkBeat): the mouth
 * moves for the line (Character's `motion.talk`), small gestures (an upper-body Chat one-shot) and a little hop now
 * and then. Every client animates the speaker from the line it received, so nothing more goes on the wire. Driven
 * after driveRig in the remotes' frame loop; nothing allocated. Sitting, in the air or hidden, only the mouth moves.
 */
import { talkBeat, type ChatStore } from "@/lib/net/chat";
import type { RemoteRig } from "./drive";
import { HIDDEN } from "./lod";

/** Seconds into the bubble the rig last saw (-1: no bubble), and its talking seed, kept beside the rig. */
const state = new WeakMap<RemoteRig, { t: number; at: number; seed: number }>();
function seedOf(uid: string): number {
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) h = Math.imul(h ^ uid.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** How long the mouth moves for a line (the residents' measure). */
export const mouthSeconds = (text: string) => Math.min(3.2, 0.8 + text.length * 0.045);

export function driveTalk(r: RemoteRig, chat: ChatStore): void {
  const p = r.entry.player, b = chat.bubble(r.sid, p.uid);
  let st = state.get(r);
  if (!st) state.set(r, (st = { t: -1, at: NaN, seed: seedOf(p.uid) }));
  if (!b) { st.t = -1; st.at = NaN; return; }
  const m = r.motion, t = b.age / 1000;
  // A new line (or the first): the mouth starts again, the beats from its start.
  if (b.at !== st.at) { m.talk = mouthSeconds(b.text); st.t = 0; st.at = b.at; }
  const beat = talkBeat(st.t, t, st.seed);
  st.t = t;
  if (r.lod.tier === HIDDEN || r.seated || m.move) return;
  if (beat.gesture) m.upper = "Chat";
  if (beat.hop > 0) m.lift += beat.hop;
}
