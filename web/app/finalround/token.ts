import { createHmac, timingSafeEqual } from "node:crypto";

// Token format must match scripts/finalround-links.mjs.
export type Invite = { name: string; project: string };

export function verifyInvite(token: string): Invite | null {
  const secret = process.env.FINALROUND_SECRET;
  if (!secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest().subarray(0, 18);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { n, p } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof n !== "string" || !n.trim()) return null;
    return { name: n.trim(), project: typeof p === "string" ? p.trim() : "" };
  } catch {
    return null;
  }
}
