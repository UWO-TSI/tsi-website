import { createHmac, timingSafeEqual } from "node:crypto";
import { RAID_CREDIT, type RaidCredit } from "@/lib/net/protocol";

/**
 * A raid helper's credit (protocol.ts RaidCredit, signed by the realtime server, realtime/src/rooms/raid.ts creditFor):
 * the credit if the signature is the shared secret's and it hasn't expired, else null.
 */
export function readRaidCredit(token: string, secret: string | undefined, now: number): RaidCredit | null {
  if (!secret || token.length > RAID_CREDIT.maxBytes) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined || !/^[0-9a-f]{64}$/.test(sig)) return null;
  if (!timingSafeEqual(createHmac("sha256", secret).update(payload).digest(), Buffer.from(sig, "hex"))) return null;
  try {
    const c = JSON.parse(Buffer.from(payload, "base64url").toString()) as RaidCredit;
    const ok = [c.m, c.f, c.r, c.o, c.i].every((v) => typeof v === "string" && v.length > 0 && v.length <= 64) && typeof c.e === "number";
    return ok && c.e > now ? c : null;
  } catch {
    return null;
  }
}
