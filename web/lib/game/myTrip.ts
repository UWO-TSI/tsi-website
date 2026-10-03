/**
 * This player's boat trip (specs/polish/arrival-wharf.md): the one their client steps, veils and changes scenes for.
 * The trip is theirs (lib/game/boatTrip.ts, `who` "me") and its rider is their avatar (`ride`). Once others are shown,
 * their trips come from the server as the same plain data and are only drawn, on their own avatars.
 */
import type { BoatTrip } from "./boatTrip";
import { newRide } from "./movement/ride";

export const myTrip = {
  current: null as BoatTrip | null,
  /** The island the trip is going to has loaded and warmed up (the scene gate). */
  loaded: false,
  /** The camera's tilt and zoom before the trip: given back at the end. */
  camera: { pitch: 0.6, zoom: 1 },
  /** The avatar's ride while the trip has it. */
  ride: newRide(),
};

const listeners = new Set<() => void>();
let queued = false;
/** Tell React the trip moved on (a phase, a skip): deferred out of the frame loop, where the trip steps. */
export function tripChanged() {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; listeners.forEach(l => l()); }, 0);
}
export function subscribeMyTrip(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
/** What React shows of the trip: its phase, leg, whether skipped and where it goes ("" with none). */
export function readMyTrip(): string {
  const t = myTrip.current;
  return t ? `${t.phase}|${t.leg}|${t.skip ? 1 : 0}|${t.to}|${t.from}` : "";
}
