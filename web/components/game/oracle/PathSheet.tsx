"use client";

/**
 * The Oracle's path sheet (rows 20, 38, 50, 207): at level 10 choose one of
 * your family's four subclasses (first choice free, a change costs coins,
 * confirmed first); pick the four abilities you carry into the ruins from the
 * kit; spend stat points (totals are sent, so a retry changes nothing) or
 * reset them for a fee. Every write goes through /api/combat/* and the
 * server decides; the sheet then re-reads.
 *
 * Classes v2 (the classes_v2 flag, the view's `classes` block; design sheet §1.11): the Oracle's suggestion first
 * with the keeper's reason (two when the reading is unclear), no fee: the first choice is free and then locked, a
 * change spends the repick token (a paid reading, or the launch gift); a ceremony with the weapon forming; the Kit
 * tab shows keys 1–5, the combos, the ult, the passives, the stat direction and the mastery track, and the mastery
 * frames to wear. The loadout picker is gone (keys are fixed per class).
 */
import { useState } from "react";
import { FAMILIES } from "@/lib/game/oracle/family";
import { FAMILY_ABILITIES, kitOptions, SLOTS, subclassByKey, subclassesFor, TRAITS, traitMastery, type Ability, type Subclass } from "@/lib/combat/kits";
import { SUBCLASS_LEVEL, STAT_LABEL, STATS, type StatBlock } from "@/lib/combat/progression";
import { allocateRemote, chooseSubclassRemote, equipCosmeticRemote, resetStatsRemote, setLoadoutRemote, type ProgressionView } from "@/lib/game/combat/progression";
import { CLASS_RENAMES, classKit, classMods, kitAt, statAt, STAT_DIRECTION_LABEL, type ClassKit } from "@/lib/combat/classes";
import { masteryCosmetics, MASTERY_EQUIP } from "@/lib/combat/mastery";
import { shakeCamera, widenFov } from "@/lib/game/cameraJuice";
import type { Family } from "@/lib/oracle/engine";
import IslandSheet from "../IslandSheet";
import styles from "../DefaultIslandWorld.module.css";

type Tab = "subclass" | "abilities" | "stats";

function AbilityLine({ a }: { a: Ability }) {
  return <span className={styles.pathAbility}><b>{a.name}</b>{a.incantation && <i className={styles.runeTag}>rune · {a.incantation}</i>}
    <small>{a.description} {a.cooldown_s}s · {a.energy} energy</small></span>;
}

const INPUT_WORD: Record<string, string> = { tap: "Tap", hold: "Hold", charge: "Hold to charge", toggle: "Toggle", recast: "Press again", drawn: "Draw" };
const nameOf = (key: string) => classKit(key)?.name ?? CLASS_RENAMES[key] ?? subclassByKey(key)?.name ?? key;

/** Classes v2's Kit tab: the class's keys (all equipped), combos, ult, passives, stat direction and track, and its mastery frames. */
function ClassKitPanel({ kit, view, busy, run }: { kit: ClassKit; view: ProgressionView; busy: boolean; run: (f: () => Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean> }) {
  const c = view.classes!, m = c.mastery.mastery, at = kitAt(kit, m), mods = classMods(kit, m), look = masteryCosmetics(m);
  return <div data-testid="class-kit">
    <p className={styles.hint}>Mastery {m}{c.mastery.needed ? ` · ${c.mastery.into} / ${c.mastery.needed} XP to ${m + 1}` : " · mastered"}{c.next ? ` · Mastery ${c.next.at}: ${c.next.what.join(", ")}` : ""}</p>
    <ul className={styles.pathLoadout}>{kit.keys.map((base, i) => { const a = at.keys[i]; return <li key={base.key} data-locked={!a || undefined}>
      <button disabled aria-disabled="true"><kbd>{i + 1}</kbd><AbilityLine a={a ?? base} /><em>{a ? INPUT_WORD[a.input?.kind ?? "tap"] : `Mastery ${base.unlock}`}</em></button></li>; })}
      {(kit.combos ?? []).map(cb => { const a = at.combos.find(x => x.ability.key === cb.ability.key)?.ability; return <li key={cb.ability.key} data-locked={!a || undefined}>
        <button disabled aria-disabled="true"><kbd>{cb.keys[0] === cb.keys[1] ? `${cb.keys[0] + 1}${cb.keys[0] + 1}` : `${cb.keys[0] + 1}+${cb.keys[1] + 1}`}</kbd><AbilityLine a={a ?? cb.ability} /><em>{a ? "Combo" : `Mastery ${cb.ability.unlock}`}</em></button></li>; })}
      <li><button disabled aria-disabled="true"><kbd>F</kbd><AbilityLine a={at.ult} /><em>Ultimate</em></button></li>
    </ul>
    <p><small>Passive</small> <b>{at.passive.name}</b> <small>{at.passive.description}</small></p>
    {kit.movement && <p><small>Movement (ruins)</small> <b>{kit.movement.name}</b> <small>{kit.movement.description}</small></p>}
    <p className={styles.hint}>{STAT_DIRECTION_LABEL[kit.stat.kind]}: {Math.round(statAt(kit, m) * 100) / 100} now, {kit.stat.at20} at mastery 20{kit.stat.kind === "max_mana" ? ` (regen ${mods.energyRegen.toFixed(1)}/s)` : ""}. Your {kit.signature.name} must be in hand for your skills and {kit.ult.name}.</p>
    <p className={styles.hint}>Nameplate frame</p>
    <div className={styles.segmented} role="group" aria-label="Nameplate frame">
      <button aria-pressed={!c.cosmetics.frame} disabled={busy} onClick={() => void run(() => equipCosmeticRemote(kit.key, "frame", null), "Frame off.")}>None</button>
      {(["mastery:bronze", "mastery:silver", "mastery:gold"] as const).map(f => <button key={f} aria-pressed={c.cosmetics.frame === f} disabled={busy || m < MASTERY_EQUIP[f].at}
        title={m < MASTERY_EQUIP[f].at ? `Mastery ${MASTERY_EQUIP[f].at}` : undefined} onClick={() => void run(() => equipCosmeticRemote(kit.key, "frame", f), "Frame on.")}>{f.slice(8, 9).toUpperCase() + f.slice(9)}</button>)}
    </div>
    <p className={styles.hint}>Aura tier {look.aura}{look.trim ? " · mastery trim on your weapon" : ""}{look.colour ? " · mastery aura colour" : ""}</p>
  </div>;
}

export default function PathSheet({ view, onClose, onChanged }: { view: ProgressionView; onClose: () => void; onChanged: () => void }) {
  const family = view.family as Family;
  const current = subclassByKey(view.subclass?.key); // the local kit objects, so ability identity checks hold
  const v2 = view.classes, chosen = view.subclass_key, kit = v2 && chosen ? classKit(chosen) : null;
  const [ceremony, setCeremony] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(current || kit ? "abilities" : "subclass");
  const [confirm, setConfirm] = useState<Subclass | null>(null);
  // Loadout edits in progress; null follows the server's loadout (after a save or a subclass change).
  const [pending, setPending] = useState<string[] | null>(null);
  const picked = pending ?? view.loadout;
  const [add, setAdd] = useState<StatBlock>({ might: 0, finesse: 0, arcana: 0, spirit: 0, vitality: 0 });
  const [resetting, setResetting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const color = FAMILIES[family].color;
  const run = async (f: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true); setNote(null);
    const r = await f();
    setBusy(false);
    setNote(r.ok ? done : r.error ?? "The crystal is quiet right now.");
    if (r.ok) onChanged();
    return r.ok;
  };

  const unlocked = view.level >= SUBCLASS_LEVEL;
  // Classes v2 (§1.11): free the first time, then locked; a change spends the repick token. Two steps, the second says so.
  const [pending2, setPending2] = useState<string | null>(null);
  const choose2 = (key: string) => {
    if (pending2 !== key) { setPending2(key); return; }
    void run(() => chooseSubclassRemote(key), `You walk the ${nameOf(key)}'s path.`).then(ok => {
      if (!ok) return;
      setPending2(null); setTab("abilities"); setCeremony(key);
      shakeCamera(0.1); widenFov(1.5); // the weapon forming lands at the heavy tier (§1.5, §1.6)
    });
  };
  const suggestion = v2?.suggestion && v2.suggestion.family === family ? v2.suggestion : null;
  const order2 = v2 ? [...new Set([...(suggestion ? [suggestion.subclass] : []), ...subclassesFor(family).map(s => s.key), ...v2.kits])] : [];
  const choose = (s: Subclass) => {
    if (current && !confirm) { setConfirm(s); return; }
    void run(() => chooseSubclassRemote(s.key), current ? `You walk the ${s.name}'s path now.` : `You're a ${s.name}. The ruins gate is open.`).then(ok => { if (ok) { setConfirm(null); setPending(null); setTab("abilities"); } });
  };
  const options = current ? kitOptions(current, view.traits) : [];
  const toggle = (key: string) => setPending(picked.includes(key) ? picked.filter(k => k !== key) : picked.length < SLOTS ? [...picked, key] : picked);
  const left = view.points_available - STATS.reduce((n, k) => n + add[k], 0);
  const preset = () => {
    const target = view.preset?.at_level;
    if (!target) return;
    // Presets only add: every stat goes up to the preset or stays where it is, within the points you have.
    const next = { ...add };
    let budget = view.points_available;
    for (const k of STATS) { const want = Math.max(0, target[k] - view.stats[k]); next[k] = Math.min(want, budget); budget -= next[k]; }
    setAdd(next);
  };

  return <IslandSheet title="Your path" onClose={onClose} className={`${styles.oracleSheet} ${styles.pathSheet}`} testId="path-sheet">
    <p className={styles.oracleResult} style={{ ["--family" as string]: color }}>
      <b>{family}</b> · level {view.level}{current ? ` · ${current.name}` : ""}<br />
      <small>{current ? current.passive.name + ": " + current.passive.description : unlocked ? "Level 10: choose your subclass. The first choice is free." : `Subclasses open at level ${SUBCLASS_LEVEL}. Here's what waits for you.`}</small>
    </p>
    <div className={styles.segmented} role="tablist" style={{ gridTemplateColumns: "repeat(3, 1fr)", margin: "12px 0" }}>
      {(["subclass", "abilities", "stats"] as Tab[]).map(t => <button key={t} role="tab" aria-selected={tab === t} disabled={t === "abilities" && !current && !kit} onClick={() => { setTab(t); setNote(null); setConfirm(null); setPending2(null); }}>
        {t === "subclass" ? "Subclass" : t === "abilities" ? (v2 ? "Kit" : "Abilities") : `Stats${view.points_available ? ` · ${view.points_available}` : ""}`}</button>)}
    </div>

    {ceremony && <div className={styles.ceremony} role="status" data-testid="class-ceremony" style={{ ["--family" as string]: color, ["--class" as string]: classKit(ceremony)?.look.ramp[1] ?? color }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the class emblem over the family's light */}
      {classKit(ceremony) && <img src={classKit(ceremony)!.look.icon} alt="" />}
      <b>{nameOf(ceremony)}</b>
      <span>{suggestion?.subclass === ceremony ? suggestion.reason : "The light settles. This path is yours now."}</span>
      {classKit(ceremony) && <small>Your {classKit(ceremony)!.signature.name} forms in your hands. Mastery 1.</small>}
      <button className={styles.oracleBegin} onClick={() => setCeremony(null)}>Take it</button>
    </div>}

    {tab === "subclass" && v2 && <div className={styles.pathCards} data-testid="subclass-choice">
      {suggestion && <p className={styles.pathConfirm} data-testid="oracle-suggestion">
        <b>The Oracle suggests {nameOf(suggestion.subclass)}</b><br />{suggestion.reason}
        {suggestion.pair && <><br /><small>The light flickers between {nameOf(suggestion.subclass)} and {nameOf(suggestion.pair)}. {nameOf(suggestion.subclass)} burns brighter.</small></>}
      </p>}
      {order2.map(key => { const k = classKit(key), legacy = subclassByKey(key), mine = chosen === key, canPick = unlocked && (!chosen || !!v2.repick);
        return <article key={key} data-current={mine || undefined} data-suggested={suggestion?.subclass === key || undefined} style={{ ["--family" as string]: color }}>
          <header><b>{nameOf(key)}</b><small>{suggestion?.subclass === key ? "The Oracle suggests" : k ? k.role : legacy?.weapon_affinity.join(" · ")}</small></header>
          {k ? <><p><small>Signature</small> <b>{k.signature.name}</b> · <small>Ult</small> <b>{k.ult.name}</b></p>
            <p><small>Keys</small> {k.keys.map(a => a.name).join(", ")}</p>
            <p><small>Builds toward</small> {STAT_DIRECTION_LABEL[k.stat.kind]}</p></>
            : <small className={styles.pathNote}>Its new kit arrives with its family&apos;s wave.</small>}
          {mine ? <span className={styles.pathBadge}>Your subclass · mastery {v2.rows.find(r => r.subclass === key)?.mastery ?? 1}</span>
            : <button className={styles.oracleBegin} disabled={!canPick || busy} onClick={() => choose2(key)}>
              {!unlocked ? `Level ${SUBCLASS_LEVEL}` : !chosen ? (pending2 === key ? "Confirm" : "Choose") : v2.repick ? (pending2 === key ? "Confirm repick" : "Repick") : "Locked"}</button>}
          {pending2 === key && <small className={styles.pathNote} role="alert">{chosen ? `This spends your repick (${v2.repick === "launch" ? "the launch gift" : "your Oracle reading"}). Mastery stays with each subclass.` : "Locked until you redo the Oracle (250 coins, 7 days after your last reading)."}</small>}
        </article>; })}
      {chosen && !v2.repick && <p className={styles.hint}>Your path is locked. Redo the Oracle (250 coins, 7 days after your last reading) to choose again; one payment covers both.</p>}
    </div>}

    {tab === "abilities" && v2 && (kit ? <ClassKitPanel kit={kit} view={view} busy={busy} run={run} /> : <p className={styles.hint}>Your subclass&apos;s new kit arrives with its family&apos;s wave. Until then you fight with today&apos;s.</p>)}

    {tab === "subclass" && !v2 && <div className={styles.pathCards} data-testid="subclass-choice">
      {confirm && <div className={styles.pathConfirm} role="alertdialog" aria-label="Confirm the change">
        <p>Change from {current?.name} to {confirm.name} for {view.fees.subclass_change} coins? Your level, stats and gear stay; family abilities you equipped stay equipped.</p>
        <button className={styles.oracleBegin} disabled={busy} onClick={() => choose(confirm)}>Pay {view.fees.subclass_change} and change</button>
        <button className={styles.oracleBack} onClick={() => setConfirm(null)}>Keep {current?.name}</button>
      </div>}
      {subclassesFor(family).map(s =><article key={s.key} data-current={current?.key === s.key || undefined} style={{ ["--family" as string]: color }}>
        <header><b>{s.name}</b><small>{s.weapon_affinity.join(" · ")}</small></header>
        <AbilityLine a={s.signature} />
        {s.abilities.map(a => <AbilityLine key={a.key} a={a} />)}
        {s.key === "transmuter" && <small className={styles.pathNote}>Learns an ability from each monster species it defeats.</small>}
        <p><small>Passive</small> <b>{s.passive.name}</b> <small>{s.passive.description}</small></p>
        {s.starter_note && <small className={styles.pathNote}>{s.starter_note}</small>}
        {current?.key === s.key ? <span className={styles.pathBadge}>Your subclass</span>
          : <button className={styles.oracleBegin} disabled={!unlocked || busy} onClick={() => choose(s)}>
            {!unlocked ? `Level ${SUBCLASS_LEVEL}` : current ? `Change · ${view.fees.subclass_change} coins` : "Choose"}</button>}
      </article>)}
    </div>}

    {tab === "abilities" && current && !v2 && <div data-testid="loadout">
      <p className={styles.hint}>Carry four into the ruins (keys 1–4). Summons and totems from an ability you take off leave with it.</p>
      <ul className={styles.pathLoadout}>{options.map(a => {
        const slot = picked.indexOf(a.key), trait = TRAITS.find(t => t.ability.key === a.key);
        const tag = a === current.signature ? "Signature" : FAMILY_ABILITIES[family].includes(a) ? family : trait ? `${trait.part} · mastery ${traitMastery(view.traits[trait.key] ?? 0)}` : current.name;
        return <li key={a.key}><button aria-pressed={slot >= 0} onClick={() => toggle(a.key)}>
          <kbd>{slot >= 0 ? slot + 1 : "·"}</kbd><AbilityLine a={a} /><em>{tag}</em></button></li>;
      })}</ul>
      <button className={styles.oracleBegin} disabled={busy || !picked.length || picked.join() === view.loadout.join()} onClick={() => void run(() => setLoadoutRemote(picked), "Loadout saved.").then(ok => { if (ok) setPending(null); })}>Save loadout</button>
    </div>}

    {tab === "stats" && <div data-testid="stats">
      <p className={styles.hint}>{view.points_available} point{view.points_available === 1 ? "" : "s"} to spend · 3 per level. Any build works with any weapon; the weapon&apos;s stat decides how hard it hits.</p>
      <ul className={styles.pathStats}>{STATS.map(k => <li key={k}>
        <span>{STAT_LABEL[k]}</span><b>{view.stats[k] + add[k]}</b>
        <button aria-label={`Less ${STAT_LABEL[k]}`} disabled={add[k] === 0} onClick={() => setAdd(a => ({ ...a, [k]: a[k] - 1 }))}>−</button>
        <button aria-label={`More ${STAT_LABEL[k]}`} disabled={left <= 0} onClick={() => setAdd(a => ({ ...a, [k]: a[k] + 1 }))}>+</button>
        <small>preset {view.preset?.at_level[k] ?? 0}</small>
      </li>)}</ul>
      <p className={styles.hint}>HP {view.derived.max_hp} · crit {(view.derived.crit_chance * 100).toFixed(1)}% · summon capacity {view.derived.summon_capacity}</p>
      <button className={styles.oracleBack} disabled={!view.preset || !view.points_available} onClick={preset}>Family preset</button>{" "}
      <button className={styles.oracleBegin} disabled={busy || left === view.points_available}
        onClick={() => void run(() => allocateRemote(Object.fromEntries(STATS.map(k => [k, view.stats[k] + add[k]])) as StatBlock), "Points spent.").then(ok => { if (ok) setAdd({ might: 0, finesse: 0, arcana: 0, spirit: 0, vitality: 0 }); })}>Spend points</button>
      {resetting
        ? <div className={styles.pathConfirm} role="alertdialog" aria-label="Confirm the reset">
          <p>Reset every point for {view.fees.stat_reset} coins? Your level and XP stay; you spend the points again.</p>
          <button className={styles.oracleBegin} disabled={busy} onClick={() => void run(resetStatsRemote, "Points returned.").then(() => setResetting(false))}>Pay {view.fees.stat_reset} and reset</button>
          <button className={styles.oracleBack} onClick={() => setResetting(false)}>Keep them</button>
        </div>
        : <button className={styles.oracleBack} disabled={view.points_available === (view.level - 1) * 3} onClick={() => setResetting(true)}>Reset · {view.fees.stat_reset} coins</button>}
    </div>}
    {note && <p role="status" className={styles.pathStatus}>{note}</p>}
  </IslandSheet>;
}
