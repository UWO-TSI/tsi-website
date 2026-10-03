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
import IslandSheet from "../IslandSheet";
import { SignInText } from "@/components/gui";
import styles from "../DefaultIslandWorld.module.css";

const TEMPLATE: Record<string, string> = { hunt: "Hunt", fetch: "Fetch", survive: "Survive waves", escort: "Escort" };
const ZONE: Record<string, string> = { outer: "Outer wild", inner: "Inner temple", boss: "Guardian's chamber" };
const hoursLeft = (iso: string) => Math.ceil((Date.parse(iso) - Date.now()) / 3_600_000);

/** E at the board opens it and E closes it. The board's body subscribes to the combat runtime only while it shows. */
export default function MissionBoardSheet({ open, onClose, gateNote }: { open: boolean; onClose: () => void; gateNote: string | null }) {
  return <IslandSheet open={open} title="Ruins mission board" onClose={onClose} testId="mission-board" keys="e"><MissionBoard gateNote={gateNote} /></IslandSheet>;
}

function MissionBoard({ gateNote }: { gateNote: string | null }) {
  // Mounted only while the sheet shows (it re-rendered ~10×/s, closed, all through a ruins run).
  useCombatVersion();
  const [note, setNote] = useState<string | null>(null);
  /** Hours left on each mission's cooldown, as of opening the board. */
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  useEffect(() => {
    void missionBoard().then(r => { if (r.ok) setCooldowns(Object.fromEntries(r.data.filter(m => m.cooldown_until).map(m => [m.key, hoursLeft(m.cooldown_until!)]))); });
  }, []);
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
    if (!m?.progressId) { setNote("Claimed on this device. Sign in to keep the rewards."); setMission(null); return; }
    const queued = takeMissionQueue();
    if (queued.length) await postMissionEvents(m.progressId, queued);
    const r = await completeMissionRemote(m.progressId);
    setNote(r.ok ? `+${r.data.xp_awarded} XP · +${r.data.coins_awarded} TC · ${materialsLabel(r.data.materials_awarded)}` : r.error);
    if (r.ok) { setMission(null); setCooldowns(c => ({ ...c, [m.def.id]: 20 })); }
  };
  return <>
    {gateNote && <p className={styles.hint}><SignInText text={gateNote} /></p>}
    {note && <p className={styles.hint} role="status"><SignInText text={note} /></p>}
    <ul className={styles.missionList}>{MISSIONS.map((m, i) => {
      const mine = active?.def.id === m.id, cool = cooldowns[m.id];
      return <li key={m.id} data-active={mine || undefined}>
        {m.zone !== MISSIONS[i - 1]?.zone && <h3>{ZONE[m.zone]}</h3>}
        <span className={styles.missionTemplate}>{TEMPLATE[m.template]} · <span aria-label={`Difficulty ${m.difficulty} of 5`}>{"★".repeat(m.difficulty)}{"☆".repeat(5 - m.difficulty)}</span></span>
        <b>{m.title}</b>
        <p>{m.blurb}</p>
        <small>{m.reward.coins} TC · {m.reward.xp} XP · {materialsLabel(m.reward.materials)}</small>
        {mine ? <div className={styles.missionState}>
          <span>{active.note}</span>
          {active.status === "complete" ? <button onClick={() => void claim()}>Claim</button>
            : <button onClick={() => setMission(null)}>{active.status === "active" ? "Abandon" : "Clear"}</button>}
        </div> : cool ? <small>On cooldown · back in {cool} h</small>
          : <button disabled={active?.status === "active"} onClick={() => void accept(m.id)}>Accept</button>}
      </li>;
    })}</ul>
  </>;
}
