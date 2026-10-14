"use client";

/**
 * What a pick on the emote wheel does (specs/v1-drop.md §3), as the window events the avatar already listens to:
 * - a one-shot (Wave, Cheer, Clap, Laugh, Bow, Shrug): `tsi:emote` (seated, it plays over the upper body);
 * - Sit: on the ground where you stand (`tsi:sit-here`), or by the lit campfire a free seat in its ring, facing the
 *   fire, the hands to the warmth (`tsi:sit` with SitWarm);
 * - Sleep: lying down where you stand;
 * - a dance: its loop, which holds until you move; by the lit campfire, a free place in the stomp ring instead (up to
 *   eight), carried round the fire on the world clock.
 * Anything picked while sat on the ground or dancing at the fire gets you up first, but a one-shot.
 */
import { SEAT_CLIPS, type ClipName } from "./character/clips";
import { FIRE, freeSlot, ringPoint, sitPoint, type Spot } from "./campfire";
import { campfireLive, countPosed, remotesPosed } from "./danceField";
import { isDance } from "./danceSync";
import { worldTime } from "./worldClock";
import { localAvatar } from "@/lib/net/localAvatar";
import type { WheelEntry } from "./emoteWheel";

/** A seat that moves (the stomp ring): PlayerAvatar calls it each frame to place you, before drawing you there. */
export interface MovingSeat { x: number; z: number; yaw: number }
export type SeatDrive = (seat: MovingSeat) => void;

const send = (type: string, detail: unknown) => window.dispatchEvent(new CustomEvent(type, { detail }));
/** How long the walk from where you stand into your place in the ring takes (ms). */
const INTO_RING_MS = 700;

/** Your place `slot` in the stomp ring: from where you stood into it, then round the fire with the world clock. */
export function ringDrive(fire: Spot, slot: number, from: Spot, now: () => number = () => performance.now()): SeatDrive {
  const t0 = now();
  return seat => {
    const p = ringPoint(fire, slot, worldTime()), k = Math.min(1, (now() - t0) / INTO_RING_MS), e = k * k * (3 - 2 * k);
    seat.x = from.x + (p.x - from.x) * e;
    seat.z = from.z + (p.z - from.z) * e;
    seat.yaw = k < 1 && Math.hypot(p.x - from.x, p.z - from.z) > 0.2 ? Math.atan2(p.x - from.x, p.z - from.z) : p.yaw;
  };
}

/** The fire, when it is lit and you are by it. */
function fireNear(at: Spot): Spot | null {
  const { site, lit } = campfireLive;
  return site && lit && Math.hypot(at.x - site.x, at.z - site.z) < FIRE.joinRadius ? site : null;
}

/** Play a wheel pick for the avatar standing at `at`. */
export function playWheelEntry(entry: WheelEntry, at: Spot): void {
  const pose = (localAvatar()?.motion.current?.pose ?? null) as ClipName | null;
  const seated = !!pose && SEAT_CLIPS.has(pose);
  const fire = fireNear(at);
  if (entry.id === "sit") {
    if (fire) {
      const slot = freeSlot(FIRE.sitSlots, k => sitPoint(fire, k), at.x, at.z, remotesPosed("SitWarm", fire.x, fire.z, FIRE.joinRadius));
      if (slot >= 0) { const p = sitPoint(fire, slot); send("tsi:sit", { x: p.x, z: p.z, yaw: p.yaw, clip: "SitWarm", ground: true }); return; }
    }
    send("tsi:sit-here", { clip: "SitGround" });
    return;
  }
  if (entry.id === "sleep") { send("tsi:sit-here", { clip: "Sleep" }); return; }
  if (isDance(entry.clip)) {
    if (pose === "DanceStomp") return; // already dancing round the fire
    if (fire && countPosed("DanceStomp", fire.x, fire.z, FIRE.joinRadius) < FIRE.maxDancers) {
      const t = worldTime(), slot = freeSlot(FIRE.danceSlots, k => ringPoint(fire, k, t), at.x, at.z, remotesPosed("DanceStomp", fire.x, fire.z, FIRE.joinRadius));
      if (slot >= 0) {
        if (seated) send("tsi:stand", null);
        send("tsi:sit", { x: at.x, z: at.z, clip: "DanceStomp", yaw: 0, ground: true, drive: ringDrive(fire, slot, at) });
        return;
      }
    }
    if (seated) send("tsi:stand", null);
  }
  send("tsi:emote", { clip: entry.clip });
}
