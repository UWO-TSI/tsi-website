/** In-memory IdentityStore mirroring 034_identity.sql (tests, dev harness). */
import type { Family } from "@/lib/oracle/engine";
import { DEFAULT_SETTINGS, type AccountSettings } from "./settings";
import { IdentityError, type Attempt, type IdentityRow, type IdentityStore, type ProfileFacts } from "./store";

export function memoryIdentityStore(clock: () => Date = () => new Date()) {
  const ids = new Map<string, IdentityRow>();
  const profiles = new Map<string, ProfileFacts>();
  const attempts = new Map<string, Attempt & { key: string }>();
  const responses = new Map<string, Record<string, number>>();
  const auras = new Map<string, Set<Family>>();
  const settings = new Map<string, AccountSettings>();
  const coins = new Map<string, number>();
  const respecs: { member: string; from: Family | null; to: Family; fee: number }[] = [];
  const reports: { reporter: string; target: string; reason: string }[] = [];
  let seq = 0;
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
    async openAttempt(m) {
      for (const a of attempts.values()) if (a.member_id === m && a.status === "open") return { ...a };
      return null;
    },
    async getAttempt(id) {
      const a = attempts.get(id);
      return a ? { ...a } : null;
    },
    async startAttempt(m, key, order, fee, cooldownDays) {
      for (const a of attempts.values()) if (a.member_id === m && (a.status === "open" || a.key === key)) return { attempt_id: a.id, fee_paid: a.fee_paid, resumed: true };
      const r = row(m);
      let paid = 0;
      if (r.quiz_taken_at) {
        if (clock().getTime() - Date.parse(r.quiz_taken_at) < cooldownDays * 86_400_000) throw new IdentityError("cooldown");
        paid = fee;
        if ((coins.get(m) ?? 0) < paid) throw new IdentityError("insufficient");
        coins.set(m, (coins.get(m) ?? 0) - paid);
      }
      const id = `00000000-0000-4000-8000-00000000a${String(++seq).padStart(3, "0")}`;
      attempts.set(id, { id, key, member_id: m, item_order: order, status: "open", fee_paid: paid, mbti_type: null, family: null, started_at: clock().toISOString(), completed_at: null });
      return { attempt_id: id, fee_paid: paid, resumed: false };
    },
    async saveAnswers(id, a) {
      responses.set(id, { ...(responses.get(id) ?? {}), ...a });
    },
    async answers(id) {
      return { ...(responses.get(id) ?? {}) };
    },
    async complete(id, m, type, family) {
      const a = attempts.get(id);
      if (!a || a.member_id !== m) throw new IdentityError("not_found");
      if (a.status === "completed") return { family: a.family!, previous_family: respecs.find((x) => x.member === m && x.to === a.family)?.from ?? null, aura_new: false, replayed: true };
      if (Object.keys(responses.get(id) ?? {}).length < a.item_order.length) throw new IdentityError("incomplete");
      const r = row(m);
      const prev = r.family;
      Object.assign(a, { status: "completed", completed_at: clock().toISOString(), mbti_type: type, family });
      Object.assign(r, { mbti_type: type, family, quiz_taken_at: clock().toISOString() });
      const set = auras.get(m) ?? new Set<Family>();
      const fresh = !set.has(family);
      set.add(family);
      auras.set(m, set);
      if (a.fee_paid > 0 || prev) respecs.push({ member: m, from: prev, to: family, fee: a.fee_paid });
      return { family, previous_family: prev, aura_new: fresh, replayed: false };
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
    store, respecs, reports,
    setProfile: (m: string, p: Partial<ProfileFacts>) => profiles.set(m, { tier: 4, membership: "member", is_active: true, ...profiles.get(m), ...p }),
    fund: (m: string, n: number) => coins.set(m, n),
    coinsOf: (m: string) => coins.get(m) ?? 0,
  };
}
