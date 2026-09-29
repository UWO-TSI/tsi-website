"use client";

/**
 * Mission board at the ruins gate (row 231; specs/combat-content.md A4): the
 * ten authored missions from the systems roster, outer wild first, each with
 * its difficulty, rewards (XP, coins, materials) and the 20 h cooldown from
 * /api/combat/missions. Accepting starts it on /api/combat/missions/start
 * (the ruins then post progress events); a finished mission is claimed here.
 */
import { useEffect, useState } from "react";
import { MISSIONS } from "@/lib/game/combat/data";
import { materialsLabel, startMission } from "@/lib/game/combat/missions";
import { completeMissionRemote, missionBoard, postMissionEvents, startMissionRemote } from "@/lib/game/combat/progression";
import { attachProgressId, combat, setMission, takeMissionQueue, useCombatVersion } from "@/lib/game/combat/runtime";
import styles from "../DefaultIslandWorld.module.css";

const TEMPLATE: Record<string, string> = { hunt: "Hunt", fetch: "Fetch", survive: "Survive waves", escort: "Escort" };
const ZONE: Record<string, string> = { outer: "Outer wild", inner: "Inner temple", boss: "Guardian's chamber" };
const hoursLeft = (iso: string) => Math.ceil((Date.parse(iso) - Date.now()) / 3_600_000);

export default function MissionBoardSheet({ open, onClose, gateNote }: { open: boolean; onClose: () => void; gateNote: string | null }) {
  useCombatVersion();
  const [note, setNote] = useState<string | null>(null);
  /** Hours left on each mission's cooldown, as of opening the board. */
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!open) return;
    void missionBoard().then(r => { if (r.ok) setCooldowns(Object.fromEntries(r.data.filter(m => m.cooldown_until).map(m => [m.key, hoursLeft(m.cooldown_until!)]))); });
  }, [open]);
  if (!open) return null;
  const active = combat.rt.mission;
  const accept = async (id: string) => {
    const def = MISSIONS.find(m => m.id === id)!;
    setMission(startMission(def));
    const r = await startMissionRemote(id);
    if (r.ok) { attachProgressId(id, r.data.progress_id); setNote(null); }
    else if (!r.ok) setNote(r.status === 401 ? "Playing offline: sign in to earn the reward." : r.error);
  };
  const claim = async () => {
    const m = combat.rt.mission;
    if (!m?.progressId) { setNote("Claimed locally. Rewards need a signed-in account."); setMission(null); return; }
    const queued = takeMissionQueue();
    if (queued.length) await postMissionEvents(m.progressId, queued);
    const r = await completeMissionRemote(m.progressId);
    setNote(r.ok ? `+${r.data.xp_awarded} XP · +${r.data.coins_awarded} coins · ${materialsLabel(r.data.materials_awarded)}` : r.error);
    if (r.ok) { setMission(null); setCooldowns(c => ({ ...c, [m.def.id]: 20 })); }
  };
  return <section className={`${styles.sheet} ${styles.missionSheet}`} role="dialog" aria-modal="false" aria-labelledby="missions-title" data-testid="mission-board">
    <header><h2 id="missions-title">Ruins mission board</h2><button onClick={onClose} aria-label="Close">×</button></header>
    {gateNote && <p className={styles.hint}>{gateNote}</p>}
    {note && <p className={styles.hint} role="status">{note}</p>}
    <ul className={styles.missionList}>{MISSIONS.map((m, i) => {
      const mine = active?.def.id === m.id, cool = cooldowns[m.id];
      return <li key={m.id} data-active={mine || undefined}>
        {m.zone !== MISSIONS[i - 1]?.zone && <h3>{ZONE[m.zone]}</h3>}
        <span className={styles.missionTemplate}>{TEMPLATE[m.template]} · <span aria-label={`Difficulty ${m.difficulty} of 5`}>{"★".repeat(m.difficulty)}{"☆".repeat(5 - m.difficulty)}</span></span>
        <b>{m.title}</b>
        <p>{m.blurb}</p>
        <small>{m.reward.coins} coins · {m.reward.xp} XP · {materialsLabel(m.reward.materials)}</small>
        {mine ? <div className={styles.missionState}>
          <span>{active.note}</span>
          {active.status === "complete" ? <button onClick={() => void claim()}>Claim</button>
            : <button onClick={() => setMission(null)}>{active.status === "active" ? "Abandon" : "Clear"}</button>}
        </div> : cool ? <small>On cooldown · back in {cool} h</small>
          : <button disabled={active?.status === "active"} onClick={() => void accept(m.id)}>Accept</button>}
      </li>;
    })}</ul>
  </section>;
}
