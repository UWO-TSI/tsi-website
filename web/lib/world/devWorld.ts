/**
 * The local two-client bench (specs/evidence/v1-community): with dev tokens (`?mp=dev&as=Name`, the realtime server's
 * DEV_AUTH) and no Supabase, the world routes act for `x-dev-as: Name` on an in-memory island, so two headless clients
 * can friend each other end to end. Never in production (NODE_ENV) and never where a service key is set (a developer's
 * real environment): there the header means nothing and the routes ask Supabase who you are, as always.
 * Server only (node:crypto).
 */
import { createHash } from "node:crypto";
import { memoryFriendStore } from "./friendsMemory";

const DEV_NAME = /^[A-Za-z0-9_-]{1,24}$/;

/** The realtime server's dev uid for a name (realtime/src/auth/verify.ts devUid): the same player on both sides. */
export function devUid(name: string): string {
  const h = createHash("sha256").update(`dev:${name.toLowerCase()}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Who a bench request acts for, or null (production, a service key, no header, a bad name). */
export function devActor(request: Request): { userId: string; name: string } | null {
  if (process.env.NODE_ENV === "production" || process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const name = request.headers.get("x-dev-as");
  return name && DEV_NAME.test(name) ? { userId: devUid(name), name } : null;
}

/** The bench's friends, one per server process; a caller is a member from their first request. */
export function devFriends(actor: { userId: string; name: string }) {
  const g = globalThis as unknown as { __tsiDevFriends?: ReturnType<typeof memoryFriendStore> };
  const m = (g.__tsiDevFriends ??= memoryFriendStore());
  m.member(actor.userId, actor.name);
  return m.store;
}
