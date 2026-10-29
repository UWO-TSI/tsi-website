// A divine catch's raid (specs/launch/v1-gameplay.md, "Fish tiers and fights"; web/lib/net/protocol.ts note 11, RAID):
// the whole shard can join, the server keeps the fish's stamina, and everyone who helped gets a signed credit the
// web's catch route takes once. Pure: the room calls it with its own clock and secret.
import { createHmac, randomUUID } from "node:crypto";
import * as N from "@net/protocol";

export type Helper = { uid: string; lastHit: number; dealt: number };
export type Raid = {
  id: string; fish: string; roll: string; opener: string; area: number; x: number; z: number;
  stamina: number; startedAt: number; endsAt: number; lastTick: number;
  /** Session key → what it's done. */
  helpers: Map<string, Helper>;
  result: "landed" | "escaped" | null;
};

export function openRaid(open: Extract<N.RaidUp, { op: "open" }>, opener: { key: string; uid: string }, area: number, now: number): Raid {
  const raid: Raid = {
    id: randomUUID().replace(/-/g, "").slice(0, 20), fish: open.fish, roll: open.roll, opener: opener.uid, area, x: open.x, z: open.z,
    stamina: 1, startedAt: now, endsAt: now + N.RAID.lengthMs, lastTick: now, helpers: new Map(), result: null,
  };
  joinRaid(raid, opener.key, opener.uid, now);
  return raid;
}

export function joinRaid(raid: Raid, key: string, uid: string, now: number): void {
  if (!raid.result && !raid.helpers.has(key)) raid.helpers.set(key, { uid, lastHit: now, dealt: 0 });
}

/**
 * A helper's wear since their last report, taken only up to what a reel could have dealt in that time (RAID.wear a
 * second, a little slack for the network): a forged report can't land the fish. Returns what counted.
 */
export function hitRaid(raid: Raid, key: string, dealt: number, now: number): number {
  const h = raid.helpers.get(key);
  if (!h || raid.result) return 0;
  const most = N.RAID.wear * Math.min(2000, Math.max(0, now - h.lastHit)) / 1000 * 1.25;
  const took = Math.min(dealt, most);
  h.lastHit = now;
  h.dealt += took;
  raid.stamina = Math.max(0, raid.stamina - took * N.RAID.share);
  if (raid.stamina === 0) raid.result = "landed";
  return took;
}

/** The fish recovers between reports; past its time it escapes. */
export function tickRaid(raid: Raid, now: number): void {
  if (raid.result) return;
  raid.stamina = Math.min(1, raid.stamina + N.RAID.regen * Math.max(0, now - raid.lastTick) / 1000);
  raid.lastTick = now;
  if (now >= raid.endsAt) raid.result = "escaped";
}

/** One helper's credit for a landed raid (protocol.ts RaidCredit): only those who dealt any wear helped. */
export function creditFor(raid: Raid, key: string, secret: string, now: number): string | undefined {
  const h = raid.helpers.get(key);
  if (raid.result !== "landed" || !h || h.dealt <= 0) return undefined;
  const credit: N.RaidCredit = { m: h.uid, f: raid.fish, r: raid.roll, o: raid.opener, i: raid.id, e: now + N.RAID.creditTtlMs };
  return signCredit(credit, secret);
}

export function signCredit(credit: N.RaidCredit, secret: string): string {
  const payload = Buffer.from(JSON.stringify(credit)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

/** What one client sees of the raid (room timeline `endsAt`). */
export function raidView(raid: Raid | null, key: string, epoch: number, credit?: string): N.RaidView {
  if (!raid) return N.NO_RAID;
  return {
    id: raid.id, fish: raid.fish, area: raid.area, x: raid.x, z: raid.z, stamina: Math.round(raid.stamina * 1000) / 1000,
    helpers: raid.helpers.size, endsAt: Math.max(0, raid.endsAt - epoch), joined: raid.helpers.has(key),
    ...(raid.result ? { result: raid.result } : {}), ...(credit ? { credit } : {}),
  };
}
