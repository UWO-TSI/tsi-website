/** Identity service: world names, member badge, settings, reports and T1/T2 moderation. */
import { canChangeName, checkName, NAME_CHANGE_COOLDOWN_DAYS } from "./names";
import { mergeSettings, type AccountSettings } from "./settings";
import { toFailure, type Result } from "@/lib/result";
import { IdentityError, type IdentityStore } from "./store";

const ERR: Record<string, [number, string]> = {
  unavailable: [503, "Names can't be saved right now."],
  name_taken: [409, "Someone already has that name."],
  too_soon: [409, `You can change your name once every ${NAME_CHANGE_COOLDOWN_DAYS} days.`],
  forbidden: [403, "T1/T2 only."],
  failed: [500, "Something went wrong. Try again."],
};
const fail = <T>(err: unknown): Result<T> => toFailure(ERR, err);

export async function checkWorldName(store: IdentityStore, m: string, raw: unknown): Promise<Result<{ name: string; available: boolean }>> {
  const c = checkName(raw);
  if (!c.ok) return { ok: false, status: 400, code: c.code, error: c.error };
  try {
    const owner = await store.keyOwner(c.key);
    return { ok: true, data: { name: c.name, available: owner === null || owner === m } };
  } catch (err) {
    return fail(err);
  }
}

export async function setWorldName(store: IdentityStore, m: string, raw: unknown, now: Date): Promise<Result<{ world_name: string; name_changes: number; next_change_at: string | null }>> {
  const c = checkName(raw);
  if (!c.ok) return { ok: false, status: 400, code: c.code, error: c.error };
  try {
    const cur = await store.identity(m);
    if (cur.world_name_key === c.key && cur.world_name === c.name) {
      return { ok: true, data: { world_name: c.name, name_changes: cur.name_changes, next_change_at: null } };
    }
    const allowed = canChangeName(cur.name_set_at, now, cur.world_name === null);
    if (!allowed.ok) return { ok: false, status: 409, code: "too_soon", error: `${ERR.too_soon[1]} Next change: ${new Date(allowed.until).toLocaleDateString("en-CA")}.` };
    const r = await store.setName(m, c.name, c.key, m, NAME_CHANGE_COOLDOWN_DAYS);
    return { ok: true, data: { world_name: r.world_name, name_changes: r.name_changes, next_change_at: new Date(now.getTime() + NAME_CHANGE_COOLDOWN_DAYS * 86_400_000).toISOString() } };
  } catch (err) {
    return fail(err);
  }
}

export type Badge = "member" | null;
/** Row 223: a subtle glow / blue dot for TSI members; public accounts get none. */
export function badgeFor(p: { membership: "member" | "public"; is_active: boolean }): Badge {
  return p.membership === "member" && p.is_active ? "member" : null;
}

export async function me(store: IdentityStore, m: string) {
  try {
    const [id, profile, settings, auras] = await Promise.all([store.identity(m), store.profile(m), store.settings(m), store.auras(m)]);
    return {
      ok: true as const,
      data: { world_name: id.world_name, badge: badgeFor(profile), family: id.family, mbti_type: id.mbti_type, auras, settings, muted_until: id.muted_until, name_set_at: id.name_set_at },
    };
  } catch (err) {
    return fail<never>(err);
  }
}

export async function updateSettings(store: IdentityStore, m: string, patch: unknown): Promise<Result<AccountSettings>> {
  try {
    const r = mergeSettings(await store.settings(m), patch);
    if (!r.ok) return { ok: false, status: 400, code: "invalid", error: r.error };
    await store.saveSettings(m, r.settings);
    return { ok: true, data: r.settings };
  } catch (err) {
    return fail(err);
  }
}

export async function reportName(store: IdentityStore, reporter: string, target: string, reason: string): Promise<Result<{ reported: true }>> {
  if (reporter === target) return { ok: false, status: 400, code: "invalid", error: "You can't report yourself." };
  try {
    await store.report(reporter, target, reason.slice(0, 200));
    return { ok: true, data: { reported: true } };
  } catch (err) {
    return fail(err);
  }
}

/** How long a moderation mute lasts (names and the reported-text queue). */
export const MUTE_DAYS = 7;

/** Row 221: T1-T2 can mute (letters/notes/chat) or remove a name (reset to a placeholder). */
export async function moderate(store: IdentityStore, actor: string, actorTier: number, target: string, action: "mute" | "unmute" | "reset_name" | "dismiss", now: Date, muteDays = MUTE_DAYS): Promise<Result<{ action: string }>> {
  if (actorTier !== 1 && actorTier !== 2) return { ok: false, status: 403, code: "forbidden", error: ERR.forbidden[1] };
  try {
    if (action === "mute") await store.setMute(target, new Date(now.getTime() + muteDays * 86_400_000).toISOString());
    if (action === "unmute") await store.setMute(target, null);
    if (action === "reset_name") {
      const placeholder = `Islander ${target.replace(/-/g, "").slice(-6)}`;
      const c = checkName(placeholder);
      if (!c.ok) throw new IdentityError("failed");
      await store.setName(target, c.name, c.key, actor, NAME_CHANGE_COOLDOWN_DAYS);
    }
    // Open name reports about this member close with the admin's action (row 221 log).
    if (action !== "unmute") await store.resolveReports(target, action === "dismiss" ? "dismissed" : "actioned");
    return { ok: true, data: { action } };
  } catch (err) {
    return fail(err);
  }
}
