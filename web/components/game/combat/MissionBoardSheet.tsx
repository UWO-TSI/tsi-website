"use client";

/**
 * Mission board at the ruins gate (row 231; specs/combat-content.md A4): the ten authored missions from the systems
 * roster, outer wild first, each with its difficulty, rewards (XP, coins, materials) and the 20 h cooldown from
 * /api/combat/missions. Accepting starts it on /api/combat/missions/start (the ruins then post progress events); a
 * finished mission is claimed here.
 *
 * Laid out cleaner (David, flat UI round 2: "cleaner mission board design"): the mission under way sits on top with its
 * progress and its one action; below, the missions by area as quiet rows (what kind, how hard, when it's back), and
 * the one you open shows its story, its rewards and Accept.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Footprints, Package, ShieldHalf, Swords } from "lucide-react";
import { MISSIONS } from "@/lib/game/combat/data";
import type { MissionDef } from "@/lib/game/combat/contract";
import { materialsLabel, startMission } from "@/lib/game/combat/missions";
import { completeMissionRemote, missionBoard, postMissionEvents, startMissionRemote } from "@/lib/game/combat/progression";
import { attachProgressId, combat, setMission, takeMissionQueue, useCombatVersion } from "@/lib/game/combat/runtime";
import IslandSheet from "../IslandSheet";
import { Button, Progress, SignInText } from "@/components/gui";
import { Fold, Folds, QuietButton, Section } from "@/components/gui/cream";
import { Amount } from "@/components/economy/Amount";
import menus from "@/components/progression/menus.module.css";
import s from "./MissionBoard.module.css";

const TEMPLATE: Record<string, string> = { hunt: "Hunt", fetch: "Fetch", survive: "Survive waves", escort: "Escort" };
const TEMPLATE_ICON: Record<string, ReactNode> = { hunt: <Swords size={17} />, fetch: <Package size={17} />, survive: <ShieldHalf size={17} />, escort: <Footprints size={17} /> };
const ZONE: Record<string, string> = { outer: "Outer wild", inner: "Inner temple", boss: "Guardian's chamber" };
const ZONES = ["outer", "inner", "boss"] as const;
const hoursLeft = (iso: string) => Math.ceil((Date.parse(iso) - Date.now()) / 3_600_000);

/** E at the board opens it and E closes it. The board's body subscribes to the combat runtime only while it shows. */
export default function MissionBoardSheet({ open, onClose, gateNote }: { open: boolean; onClose: () => void; gateNote: string | null }) {
  return <IslandSheet flat open={open} title="Ruins mission board" onClose={onClose} testId="mission-board" keys="e" size="lg" icon={<Swords size={20} />}><MissionBoard gateNote={gateNote} /></IslandSheet>;
}

/** How hard, out of five, as pips. */
function Pips({ n }: { n: number }) {
  return <span className={s.pips} role="img" aria-label={`Difficulty ${n} of 5`}>{[1, 2, 3, 4, 5].map(i => <i key={i} data-on={i <= n || undefined} />)}</span>;
}

/** What a mission pays: coins, XP and materials. */
function Rewards({ m }: { m: MissionDef }) {
  const mats = materialsLabel(m.reward.materials);
  return <ul className={s.rewards} aria-label="Rewards">
    <li><Amount n={m.reward.coins} /></li>
    <li><b>{m.reward.xp}</b> XP</li>
    {mats ? <li>{mats}</li> : null}
  </ul>;
}

function MissionBoard({ gateNote }: { gateNote: string | null }) {
  // Mounted only while the sheet shows (it re-rendered ~10×/s, closed, all through a ruins run).
  useCombatVersion();
  const [note, setNote] = useState<string | null>(null);
  /** Hours left on each mission's cooldown, as of opening the board. */
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const active = combat.rt.mission;
  // The open row: the first mission you can take, until you pick one (none while one is under way: it's on top).
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void missionBoard().then(r => { if (r.ok) setCooldowns(Object.fromEntries(r.data.filter(m => m.cooldown_until).map(m => [m.key, hoursLeft(m.cooldown_until!)]))); });
  }, []);
  const accept = async (id: string) => {
    const def = MISSIONS.find(m => m.id === id)!;
    setMission(startMission(def));
    setPicked(null);
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
    setNote(r.ok ? `+${r.data.xp_awarded} XP · +${r.data.coins_awarded} coins · ${materialsLabel(r.data.materials_awarded)}` : r.error);
    if (r.ok) { setMission(null); setCooldowns(c => ({ ...c, [m.def.id]: 20 })); }
  };
  const free = MISSIONS.find(m => !cooldowns[m.id] && m.id !== active?.def.id)?.id ?? null;
  const openId = picked === undefined ? (active ? null : free) : picked;
  const counted = active && active.def.template !== "fetch" && active.goal > 1;
  return <>
    {gateNote && <p className={menus.note}><SignInText text={gateNote} /></p>}
    {note && <p className={menus.note} role="status"><SignInText text={note} /></p>}
    {active ? <section className={s.now} aria-label="Under way" data-status={active.status}>
      <span className={s.nowIcon} aria-hidden="true">{TEMPLATE_ICON[active.def.template]}</span>
      <div className={s.nowText}>
        <p className={menus.kicker}>{active.status === "complete" ? "Done" : active.status === "failed" ? "Didn't work out" : "Under way"} · {ZONE[active.def.zone]}</p>
        <h3 className={s.nowTitle}>{active.def.title}</h3>
        {counted ? <Progress value={Math.min(active.progress.counter, active.goal)} max={active.goal} kind="xp" label={`${active.def.title} progress`} className={s.nowBar} /> : null}
        <p className={s.nowNote}>{active.note}</p>
      </div>
      <div className={s.nowActions}>
        {active.status === "complete" ? <Button onClick={() => void claim()}>Claim rewards</Button>
          : <QuietButton onClick={() => setMission(null)}>{active.status === "active" ? "Abandon" : "Clear"}</QuietButton>}
      </div>
    </section> : <p className={s.lead}>Take one mission at a time. Each comes back 20 hours after you finish it.</p>}
    {ZONES.map(zone => {
      const list = MISSIONS.filter(m => m.zone === zone);
      if (!list.length) return null;
      return <Section key={zone} title={ZONE[zone]} className={s.zone}>
        <Folds label={ZONE[zone]}>{list.map(m => {
          const mine = active?.def.id === m.id, cool = cooldowns[m.id];
          return <Fold key={m.id} testId="mission" lead={TEMPLATE_ICON[m.template]} title={m.title} line={TEMPLATE[m.template]}
            state={mine ? "now" : "plain"} label={`${m.title}, ${TEMPLATE[m.template]}, difficulty ${m.difficulty} of 5${mine ? ", under way" : cool ? `, back in ${cool} hours` : ""}`}
            meta={<>{mine ? <span className={s.tag}>{active?.status === "complete" ? "Done" : "Under way"}</span> : cool ? <span className={s.cool}>Back in {cool} h</span> : null}<Pips n={m.difficulty} /></>}
            open={openId === m.id} onToggle={() => setPicked(openId === m.id ? null : m.id)}>
            <p className={s.blurb}>{m.blurb}</p>
            <Rewards m={m} />
            <div className={menus.actions}>
              {mine ? <span className={menus.aside}>Under way: its progress is at the top.</span>
                : cool ? <span className={menus.aside}>On cooldown. Back in {cool} h.</span>
                : <>
                  <Button disabled={active?.status === "active"} onClick={() => void accept(m.id)}>Accept</Button>
                  {active?.status === "active" ? <span className={menus.aside}>Finish or abandon {active.def.title} first.</span> : null}
                </>}
            </div>
          </Fold>;
        })}</Folds>
      </Section>;
    })}
  </>;
}
