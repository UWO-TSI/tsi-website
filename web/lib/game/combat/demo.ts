/**
 * Dev-only: `?combat=demo` runs the island's /api/combat/* calls against the
 * systems agent's real service on an in-memory store (memoryCombatStore), as
 * a level-10 member with a family and subclass, so the gate, kills, wear and
 * missions can be played signed out. `?family=` picks the family.
 */
import { memoryCombatStore } from "@/lib/combat/memoryStore";
import { claimBossReward, completeMission, getProgression, listMissions, missionProgress, recordKill, reportWear, startMission, chooseSubclass } from "@/lib/combat/service";
import { islandProgression } from "@/lib/combat/islandAdapter";
import { subclassesFor } from "@/lib/combat/kits";
import { xpForLevel } from "@/lib/combat/progression";
import type { Family } from "@/lib/oracle/engine";

const ME = "00000000-0000-4000-8000-0000000c0de5";
let installed = false;

export function installCombatDemo(): void {
  if (installed || process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  if (q.get("combat") !== "demo") return;
  installed = true;
  const m = memoryCombatStore();
  const family = (["Arcane", "Ranger", "Vanguard", "Warden"].find(f => f.toLowerCase() === (q.get("family") ?? "").toLowerCase()) ?? "Arcane") as Family;
  const ready = (async () => {
    m.setFamily(ME, family); m.fund(ME, 2000);
    await m.store.grantXp(ME, xpForLevel(10), "admin", "demo", "demo-level-10");
    await chooseSubclass(m.store, ME, subclassesFor(family)[0].key, "demo-subclass-1");
  })();
  const json = (r: { ok: boolean; status?: number; error?: string; data?: unknown; [k: string]: unknown }, key: string) => {
    const { ok, status, data, ...rest } = r;
    return new Response(JSON.stringify(ok ? { ok: true, [key]: data } : { ok: false, ...rest }), { status: ok ? 200 : (status ?? 500) });
  };
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    if (!url.pathname.startsWith("/api/combat/")) return realFetch(input, init);
    await ready;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const now = new Date();
    switch (url.pathname) {
      case "/api/combat/progression": {
        const r = await getProgression(m.store, ME);
        return r.ok ? new Response(JSON.stringify({ ok: true, progression: r.data, gate: islandProgression(r.data) })) : json(r, "progression");
      }
      case "/api/combat/kill": return json(await recordKill(m.store, ME, body.enemy, body.event_key), "xp");
      case "/api/combat/wear": return json(await reportWear(m.store, ME, body.weapon, body.hits, body.defeated, body.idempotency_key), "weapon");
      case "/api/combat/missions": return json(await listMissions(m.store, ME, now), "missions");
      case "/api/combat/missions/start": return json(await startMission(m.store, ME, body.mission, body.start_key, now), "mission");
      case "/api/combat/missions/progress": return json(await missionProgress(m.store, ME, body.progress_id, body.events), "mission");
      case "/api/combat/missions/complete": return json(await completeMission(m.store, ME, body.progress_id), "rewards");
      case "/api/combat/boss-reward": return json(await claimBossReward(m.store, ME, body.event_key), "boss");
      default: return new Response(JSON.stringify({ ok: false, error: "Not in the demo" }), { status: 404 });
    }
  };
}
