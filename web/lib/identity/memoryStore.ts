/** In-memory IdentityStore mirroring 20260926150700_identity.sql (tests, dev harness). */
import type { Family } from "@/lib/oracle/engine";
import { DEFAULT_SETTINGS, type AccountSettings } from "./settings";
import { IdentityError, type IdentityRow, type IdentityStore, type ProfileFacts } from "./store";

export function memoryIdentityStore(clock: () => Date = () => new Date()) {
  const ids = new Map<string, IdentityRow>();
  const profiles = new Map<string, ProfileFacts>();
  const auras = new Map<string, Set<Family>>();
  const settings = new Map<string, AccountSettings>();
  const reports: { reporter: string; target: string; reason: string }[] = [];
  const row = (m: string): IdentityRow => {
    let r = ids.get(m);
    if (!r) ids.set(m, (r = { world_name: null, world_name_key: null, name_set_at: null, name_changes: 0, mbti_type: null, family: null, quiz_taken_at: null, muted_until: null }));
    return r;
  };
  const store: IdentityStore = {
    async identity(m) {
      return { ...row(m) };
    },
    async profile(m) {
      return profiles.get(m) ?? { tier: 4, membership: "member", is_active: true };
    },
    async keyOwner(key) {
      for (const [m, r] of ids) if (r.world_name_key === key) return m;
      return null;
    },
    async setName(m, name, key, actor, cooldownDays) {
      const admin = actor !== m;
      if (admin && ![1, 2].includes((await store.profile(actor)).tier)) throw new IdentityError("forbidden");
      const r = row(m);
      if (r.world_name === name && r.world_name_key === key) return { world_name: name, name_changes: r.name_changes, replayed: true };
      if (!admin && r.name_set_at && clock().getTime() - Date.parse(r.name_set_at) < cooldownDays * 86_400_000) throw new IdentityError("too_soon");
      for (const [other, o] of ids) if (other !== m && o.world_name_key === key) throw new IdentityError("name_taken");
      if (r.world_name) r.name_changes += 1;
      r.world_name = name;
      r.world_name_key = key;
      r.name_set_at = clock().toISOString();
      return { world_name: name, name_changes: r.name_changes, replayed: false };
    },
    async auras(m) {
      return [...(auras.get(m) ?? [])];
    },
    async settings(m) {
      return settings.get(m) ?? { ...DEFAULT_SETTINGS, key_bindings: { ...DEFAULT_SETTINGS.key_bindings } };
    },
    async saveSettings(m, s) {
      settings.set(m, s);
    },
    async report(reporter, target, reason) {
      if (!reports.some((r) => r.reporter === reporter && r.target === target)) reports.push({ reporter, target, reason });
    },
    async resolveReports(target, status) {
      for (const r of reports) if (r.target === target) (r as { status?: string }).status = status;
    },
    async setMute(target, until) {
      row(target).muted_until = until;
    },
  };
  return {
    store, reports,
    setProfile: (m: string, p: Partial<ProfileFacts>) => profiles.set(m, { tier: 4, membership: "member", is_active: true, ...profiles.get(m), ...p }),
  };
}
