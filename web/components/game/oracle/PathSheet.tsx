"use client";

/**
 * The Oracle's path sheet (rows 20, 38, 50, 207): at level 10 choose one of
 * your family's four subclasses (first choice free, a change costs coins,
 * confirmed first); pick the four abilities you carry into the ruins from the
 * kit; spend stat points (totals are sent, so a retry changes nothing) or
 * reset them for a fee. Every write goes through /api/combat/* and the
 * server decides; the sheet then re-reads.
 */
import { useState } from "react";
import { FAMILIES } from "@/lib/game/oracle/family";
import { FAMILY_ABILITIES, kitOptions, SLOTS, subclassByKey, subclassesFor, TRAITS, traitMastery, type Ability, type Subclass } from "@/lib/combat/kits";
import { SUBCLASS_LEVEL, STAT_LABEL, STATS, type StatBlock } from "@/lib/combat/progression";
import { allocateRemote, chooseSubclassRemote, resetStatsRemote, setLoadoutRemote, type ProgressionView } from "@/lib/game/combat/progression";
import type { Family } from "@/lib/oracle/engine";
import IslandSheet from "../IslandSheet";
import styles from "../DefaultIslandWorld.module.css";

type Tab = "subclass" | "abilities" | "stats";

function AbilityLine({ a }: { a: Ability }) {
  return <span className={styles.pathAbility}><b>{a.name}</b>{a.incantation && <i className={styles.runeTag}>rune · {a.incantation}</i>}
    <small>{a.description} {a.cooldown_s}s · {a.energy} energy</small></span>;
}

export default function PathSheet({ view, onClose, onChanged }: { view: ProgressionView; onClose: () => void; onChanged: () => void }) {
  const family = view.family as Family;
  const current = subclassByKey(view.subclass?.key); // the local kit objects, so ability identity checks hold
  const [tab, setTab] = useState<Tab>(current ? "abilities" : "subclass");
  const [confirm, setConfirm] = useState<Subclass | null>(null);
  const [picked, setPicked] = useState<string[]>(view.loadout);
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
  const choose = (s: Subclass) => {
    if (current && !confirm) { setConfirm(s); return; }
    void run(() => chooseSubclassRemote(s.key), current ? `You walk the ${s.name}'s path now.` : `You're a ${s.name}. The ruins gate is open.`).then(ok => { if (ok) { setConfirm(null); setTab("abilities"); } });
  };
  const options = current ? kitOptions(current, view.traits) : [];
  const toggle = (key: string) => setPicked(p => p.includes(key) ? p.filter(k => k !== key) : p.length < SLOTS ? [...p, key] : p);
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
      {(["subclass", "abilities", "stats"] as Tab[]).map(t => <button key={t} role="tab" aria-selected={tab === t} disabled={t === "abilities" && !current} onClick={() => { setTab(t); setNote(null); setConfirm(null); }}>
        {t === "subclass" ? "Subclass" : t === "abilities" ? "Abilities" : `Stats${view.points_available ? ` · ${view.points_available}` : ""}`}</button>)}
    </div>

    {tab === "subclass" && <div className={styles.pathCards} data-testid="subclass-choice">
      {subclassesFor(family).map(s => <article key={s.key} data-current={current?.key === s.key || undefined} style={{ ["--family" as string]: color }}>
        <header><b>{s.name}</b><small>{s.weapon_affinity.join(" · ")}</small></header>
        <AbilityLine a={s.signature} />
        {s.abilities.map(a => <AbilityLine key={a.key} a={a} />)}
        {s.key === "transmuter" && <small className={styles.pathNote}>Learns an ability from each monster species it defeats.</small>}
        <p><b>{s.passive.name}</b> <small>{s.passive.description}</small></p>
        {s.starter_note && <small className={styles.pathNote}>{s.starter_note}</small>}
        {current?.key === s.key ? <span className={styles.pathBadge}>Your subclass</span>
          : <button className={styles.oracleBegin} disabled={!unlocked || busy} onClick={() => choose(s)}>
            {!unlocked ? `Level ${SUBCLASS_LEVEL}` : current ? `Change · ${view.fees.subclass_change} coins` : "Choose"}</button>}
      </article>)}
      {confirm && <div className={styles.pathConfirm} role="alertdialog" aria-label="Confirm the change">
        <p>Change from {current?.name} to {confirm.name} for {view.fees.subclass_change} coins? Your level, stats and gear stay; family abilities you equipped stay equipped.</p>
        <button className={styles.oracleBegin} disabled={busy} onClick={() => choose(confirm)}>Pay {view.fees.subclass_change} and change</button>
        <button className={styles.oracleBack} onClick={() => setConfirm(null)}>Keep {current?.name}</button>
      </div>}
    </div>}

    {tab === "abilities" && current && <div data-testid="loadout">
      <p className={styles.hint}>Carry four into the ruins (keys 1–4). Summons and totems from an ability you take off leave with it.</p>
      <ul className={styles.pathLoadout}>{options.map(a => {
        const slot = picked.indexOf(a.key), trait = TRAITS.find(t => t.ability.key === a.key);
        const tag = a === current.signature ? "Signature" : FAMILY_ABILITIES[family].includes(a) ? family : trait ? `${trait.part} · mastery ${traitMastery(view.traits[trait.key] ?? 0)}` : current.name;
        return <li key={a.key}><button aria-pressed={slot >= 0} onClick={() => toggle(a.key)}>
          <kbd>{slot >= 0 ? slot + 1 : "·"}</kbd><AbilityLine a={a} /><em>{tag}</em></button></li>;
      })}</ul>
      <button className={styles.oracleBegin} disabled={busy || !picked.length || picked.join() === view.loadout.join()} onClick={() => void run(() => setLoadoutRemote(picked), "Loadout saved.")}>Save loadout</button>
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
