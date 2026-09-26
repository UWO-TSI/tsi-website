"use client";

/**
 * Mission board at the ruins gate (row 231; specs/combat-foundation.md §6):
 * one authored mission per template from the systems roster. Accepting
 * starts it on /api/combat/missions/start (the ruins then post progress
 * events); a finished mission is claimed here for its XP and coins.
 */
import { useState } from "react";
import { BOARD_MISSIONS } from "@/lib/game/combat/data";
import { startMission } from "@/lib/game/combat/missions";
import { completeMissionRemote, postMissionEvents, startMissionRemote } from "@/lib/game/combat/progression";
import { attachProgressId, combat, setMission, takeMissionQueue, useCombatVersion } from "@/lib/game/combat/runtime";
import styles from "../DefaultIslandWorld.module.css";

const TEMPLATE: Record<string, string> = { hunt: "Hunt", fetch: "Fetch", survive: "Survive waves", escort: "Escort" };

export default function MissionBoardSheet({ open, onClose, gateNote }: { open: boolean; onClose: () => void; gateNote: string | null }) {
  useCombatVersion();
  const [note, setNote] = useState<string | null>(null);
  if (!open) return null;
  const active = combat.rt.mission;
  const accept = async (id: string) => {
    const def = BOARD_MISSIONS.find(m => m.id === id)!;
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
    setNote(r.ok ? `+${r.data.xp_awarded} XP · +${r.data.coins_awarded} coins` : r.error);
    if (r.ok) setMission(null);
  };
  return <section className={`${styles.sheet} ${styles.missionSheet}`} role="dialog" aria-modal="false" aria-labelledby="missions-title" data-testid="mission-board">
    <header><h2 id="missions-title">Ruins mission board</h2><button onClick={onClose} aria-label="Close">×</button></header>
    {gateNote && <p className={styles.hint}>{gateNote}</p>}
    {note && <p className={styles.hint} role="status">{note}</p>}
    <ul className={styles.missionList}>{BOARD_MISSIONS.map(m => {
      const mine = active?.def.id === m.id;
      return <li key={m.id} data-active={mine || undefined}>
        <span className={styles.missionTemplate}>{TEMPLATE[m.template]}</span>
        <b>{m.title}</b>
        <p>{m.blurb}</p>
        <small>{m.reward.coins} coins · {m.reward.xp} XP</small>
        {mine ? <div className={styles.missionState}>
          <span>{active.note}</span>
          {active.status === "complete" ? <button onClick={() => void claim()}>Claim</button>
            : <button onClick={() => setMission(null)}>{active.status === "active" ? "Abandon" : "Clear"}</button>}
        </div> : <button disabled={active?.status === "active"} onClick={() => void accept(m.id)}>Accept</button>}
      </li>;
    })}</ul>
  </section>;
}
