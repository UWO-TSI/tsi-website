/**
 * The shard's raid on this page (protocol.ts note 11): the last `raid` view the room sent, and a way to send one up.
 * Nothing is sent until the room has sent one (an older server would close on an unknown type). The room store
 * (netStore.ts) feeds it; the fishing overlay and the raid call (components/game/fishing/RaidCall.tsx) read it.
 */
import { useSyncExternalStore } from "react";
import { NO_RAID, type RaidUp, type RaidView } from "./protocol";

let view: RaidView = NO_RAID;
let send: ((up: RaidUp) => void) | null = null;
let heard = false;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

export const raidLink = {
  /** The room joined: how to send. */
  attach(sender: (up: RaidUp) => void) { send = sender; heard = false; },
  /** A `raid` from the room. */
  receive(next: RaidView) { heard = true; view = next; emit(); },
  /** The room left. */
  detach() { send = null; heard = false; view = NO_RAID; emit(); },
};

/** Whether this room takes raids now. */
export const raidReady = () => heard && send !== null;
/** Send one up; false when the room doesn't take raids (offline, an older server). */
export function sendRaid(up: RaidUp): boolean {
  if (!raidReady()) return false;
  send!(up);
  return true;
}
export const raidNow = () => view;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** The raid under way (NO_RAID: none); re-renders on each view. */
export const useRaid = () => useSyncExternalStore(subscribe, raidNow, () => NO_RAID);
