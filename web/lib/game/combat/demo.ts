/**
 * Dev-only: `?combat=demo` runs the island's /api/combat/* calls against the
 * systems agent's real service on an in-memory store (memoryCombatStore), as
 * a level-10 member with a family and subclass, so the gate, kills, wear and
 * missions can be played signed out. `?family=` picks the family;
 * `?subclass=<key>` picks the subclass (and its family), `?subclass=none`
 * leaves the level-10 choice open; `?loadout=a,b,c` sets the four slots;
 * the family preset is spent unless `?stats=none`.
 *
 * Classes v2 (wave 0): `?subclass=demo` is the dev-only test kit (lib/combat/demoKit.ts) with the classes_v2 flag
 * on; `?classes=v2` turns the flag on for any subclass whose family wave has landed; `?mastery=N` starts its mastery
 * at level N; `?repick=oracle|launch` hands over a repick token; `?type=INTP` is the Oracle reading (`&unclear=JP`
 * makes that dichotomy 8% clear); `?frame=bronze|silver|gold` wears that mastery frame.
 */
import { memoryCombatStore } from "@/lib/combat/memoryStore";
import { allocateStats, claimBossReward, completeMission, getProgression, listMissions, missionProgress, recordKill, reportWear, resetStats, setLoadout, startMission, chooseSubclass } from "@/lib/combat/service";
import { islandProgression } from "@/lib/combat/islandAdapter";
import { subclassByKey, subclassesFor } from "@/lib/combat/kits";
import { equipCosmetic } from "@/lib/combat/service";
import { memberKit } from "@/lib/combat/classes";
import { xpForMastery } from "@/lib/combat/mastery";
import { presetAllocation, xpForLevel } from "@/lib/combat/progression";
import type { Family } from "@/lib/oracle/engine";
import { installDemoFetch, reply } from "../demoFetch";

const ME = "00000000-0000-4000-8000-0000000c0de5";

export function installCombatDemo(): void {
  installDemoFetch("combat", "/api/combat/", q => {
    const m = memoryCombatStore();
    const picked = subclassByKey(q.get("subclass")) ?? memberKit(q.get("subclass"));
    const family = picked?.family ?? (["Arcane", "Ranger", "Vanguard", "Warden"].find(f => f.toLowerCase() === (q.get("family") ?? "").toLowerCase()) ?? "Arcane") as Family;
    const ready = (async () => {
      m.setFamily(ME, family); m.fund(ME, 2000);
      await m.store.grantXp(ME, xpForLevel(10), "admin", "demo", "demo-level-10");
      if (q.get("stats") !== "none") await allocateStats(m.store, ME, presetAllocation(family, 10));
      if (q.get("classes") === "v2" || memberKit(q.get("subclass"))) m.setSetting("classes_v2", 1);
      if (q.get("subclass") !== "none") await chooseSubclass(m.store, ME, (picked ?? subclassesFor(family)[0]).key, "demo-subclass-1");
      if (q.get("loadout")) await setLoadout(m.store, ME, q.get("loadout")!.split(","));
      const sub = (await m.store.progression(ME)).subclass;
      if (sub === "demo") m.giveWeapon(ME, "staff-oak"); // the dev kit's signature type, on the wheel (Tab); members pick theirs there too
      if (sub && q.get("mastery")) m.setMasteryXp(ME, sub, xpForMastery(Number(q.get("mastery"))));
      const token = q.get("repick");
      if (token === "oracle" || token === "launch") m.grantRepick(ME, token);
      if (q.get("type")) m.setReading(ME, q.get("type")!.toUpperCase(), (["EI", "SN", "TF", "JP"] as const).map(d => ({ dichotomy: d, clarity: q.get("unclear") === d ? 8 : 60 })));
      if (sub && q.get("frame")) await equipCosmetic(m.store, ME, sub, "frame", `mastery:${q.get("frame")}`);
    })();
    return async (path, body) => {
      await ready;
      const now = new Date();
      switch (path) {
        case "/api/combat/progression": {
          const r = await getProgression(m.store, ME);
          return r.ok ? new Response(JSON.stringify({ ok: true, progression: r.data, gate: islandProgression(r.data) })) : reply(r, "progression");
        }
        case "/api/combat/kill": return reply(await recordKill(m.store, ME, body.enemy, body.event_key), "xp");
        case "/api/combat/wear": return reply(await reportWear(m.store, ME, body.weapon, body.hits, body.defeated, body.idempotency_key), "weapon");
        case "/api/combat/missions": return reply(await listMissions(m.store, ME, now), "missions");
        case "/api/combat/missions/start": return reply(await startMission(m.store, ME, body.mission, body.start_key, now), "mission");
        case "/api/combat/missions/progress": return reply(await missionProgress(m.store, ME, body.progress_id, body.events), "mission");
        case "/api/combat/missions/complete": return reply(await completeMission(m.store, ME, body.progress_id), "rewards");
        case "/api/combat/boss-reward": return reply(await claimBossReward(m.store, ME, body.event_key), "boss");
        case "/api/combat/subclass": return reply(await chooseSubclass(m.store, ME, body.subclass, body.idempotency_key), "subclass");
        case "/api/combat/loadout": return reply(await setLoadout(m.store, ME, body.loadout), "loadout");
        case "/api/combat/cosmetic": return reply(await equipCosmetic(m.store, ME, body.subclass, body.kind, body.value), "cosmetics");
        case "/api/combat/allocate": return reply(await allocateStats(m.store, ME, body), "stats");
        case "/api/combat/reset-stats": return reply(await resetStats(m.store, ME, body.idempotency_key), "reset");
        default: return new Response(JSON.stringify({ ok: false, error: "Not in the demo" }), { status: 404 });
      }
    };
  });
}
