"use client";

/**
 * Ruins HUD in the cream UI kit (row 124): health (and shield), energy, equipped weapon + durability, the
 * four equipped kit abilities (their bound keys, full names, a radial cooldown sweep; runes marked), summon
 * and totem caps, mission tracker, boss bar, safe-zone badge, hurt vignette, the defeat card and the victory
 * and trait banners, pooled damage numbers and a separate pool for status words, and the incantation overlay.
 */
import { SLOT_IDS, V2_SLOT_IDS, combat, energyMax, publishCombat, useCombatVersion, type CombatRuntime } from "@/lib/game/combat/runtime";
import { ULT } from "@/lib/combat/ult";
import { masteryTitle } from "@/lib/combat/mastery";
import { holdsSignature } from "@/lib/combat/classes";
import { WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { keyName, useAbilityKeys, useMoveKeys } from "@/lib/game/movement/keys";
import { WEAPONS } from "@/lib/game/combat/data";
import { CAST, cancelCast, FLOATERS, resolveCast } from "@/lib/game/combat/abilities";
import { CAPS } from "@/lib/combat/kits";
import { bigFoe, foeHint, phaseMarks } from "@/lib/game/combat/mobs";
import type { IncantationScore } from "@/lib/game/combat/contract";
import { floaterNodes, noteNodes } from "./EncounterRender";
import IncantationOverlay from "./IncantationOverlay";
import ImpactOverlay from "./ImpactOverlay";
import ClassGauges from "./ClassGauges";
import styles from "../DefaultIslandWorld.module.css";

export default function CombatHud({ player }: { player: React.RefObject<{ x: number; z: number }> }) {
  useCombatVersion();
  const rt = combat.rt, p = rt.player, w = WEAPONS[p.weapon];
  const keys = useAbilityKeys(), dash = useMoveKeys().dash;
  const boss = bigFoe(rt); // the guardian, or a mini-boss in the fight (the elder crab)
  const onDone = (score: IncantationScore) => { const at = player.current; resolveCast(combat.rt, { x: at.x, z: at.z }, score); publishCombat(); };
  const onCancel = () => { cancelCast(combat.rt); publishCombat(); };
  const kit = rt.kit, minions = rt.units.filter(u => u.def.kind === "minion" && u.source !== "weapon"), totems = rt.units.filter(u => u.def.kind === "totem");
  const summons = kit && rt.slots.some(a => a?.effects.some(e => e.kind === "summon" && !["decoy", "tripwire"].includes(e.unit)));
  const usesTotems = kit && rt.slots.some(a => a?.effects.some(e => e.kind === "summon" && e.unit.startsWith("totem")));
  return <>
    <div className={styles.hurt} data-on={p.hurt > 0 || undefined} aria-hidden="true" />
    {rt.v2 && <ImpactOverlay />}
    <div className={styles.floaters} aria-hidden="true">
      {Array.from({ length: FLOATERS.damage }, (_, i) => <div key={i} ref={el => { floaterNodes[i] = el; }} className={styles.floater} />)}
      {Array.from({ length: FLOATERS.info }, (_, i) => <div key={`n${i}`} ref={el => { noteNodes[i] = el; }} className={styles.floater} />)}
    </div>
    <section className={styles.combatHud} aria-label="Combat status">
      <div className={styles.hpBar} role="meter" aria-label="Health" aria-valuenow={Math.round(p.hp)} aria-valuemin={0} aria-valuemax={p.maxHp}>
        <span style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />{p.shield > 0.5 && <i style={{ width: `${Math.min(100, (p.shield / p.maxHp) * 100)}%` }} />}
        <b>{Math.ceil(p.hp)} / {p.maxHp}{p.shield > 0.5 ? ` · shield ${Math.ceil(p.shield)}` : ""}</b>
      </div>
      {/* A max-mana class (the Elementalist) calls its energy Mana; its stat direction raises the pool. */}
      {(() => { const max = energyMax(rt), word = rt.v2?.kit.stat.kind === "max_mana" ? "Mana" : "Energy"; return <div className={`${styles.hpBar} ${styles.energyBar}`} role="meter" aria-label={word} aria-valuenow={Math.round(p.energy)} aria-valuemin={0} aria-valuemax={max}>
        <span style={{ width: `${(p.energy / max) * 100}%` }} /><b>{word} {Math.floor(p.energy)} / {Math.round(max)}</b>
      </div>; })()}
      <div className={styles.weaponLine}>
        <span>{w.name}</span>
        <small data-broken={p.durability[p.weapon] <= 0 || undefined}>Durability {p.durability[p.weapon]}/{w.maxDurability}{p.durability[p.weapon] <= 0 ? " · broken, half damage" : ""}</small>
        <small className={styles.dodgePip} data-ready={p.dodgeCd <= 0 || undefined}><kbd>{keyName(dash)}</kbd> Dodge · <kbd>{keyName(keys.swap)}</kbd> {rt.v2?.kit.fire?.ammo ? "Reload" : "Previous weapon"}</small>
      </div>
      {kit && <small className={styles.kitLine}>{kit.subclass.name} · {kit.subclass.passive.name}{rt.transform ? ` · ${rt.transform.name}` : ""}
        {summons ? ` · Summons ${minions.reduce((n, u) => n + (u.def.cost ?? 1), 0)}/${kit.capacity}` : ""}{usesTotems ? ` · Totems ${totems.length}/${CAPS.totems}` : ""}</small>}
      {rt.v2 ? <ClassBar rt={rt} keys={keys} /> : <ol className={styles.abilityBar}>{SLOT_IDS.map((id, i) => {
        const a = rt.slots[i], cd = rt.cooldowns[id], left = a && cd > 0 ? Math.min(1, cd / Math.max(a.cooldown_s, CAST.recovery)) : 0;
        return <li key={`${id}-${rt.denied[id]}`} data-denied={rt.denied[id] > 0 || undefined} data-cooling={cd > 0 || undefined} data-rune={a?.incantation || undefined}
          title={a ? `${a.name}${a.incantation ? " (drawn rune)" : ""}: ${a.description}` : undefined}>
          {/* The sweep: the dark wedge is the cooldown left, unwinding clockwise. */}
          <span className={styles.sweep} style={{ "--sweep": `${left * 360}deg` } as React.CSSProperties}><kbd>{keyName(keys[id])}</kbd></span>
          <span className={styles.slotName}>{a?.name ?? (kit ? "Empty" : "Choose a subclass")}</span>
          {a && <small>{cd > 0 ? `${cd.toFixed(cd < 1 ? 1 : 0)}s` : `${a.incantation ? "Rune · " : ""}${a.energy}`}</small>}
        </li>;
      })}</ol>}
    </section>
    {p.safe && <p className={styles.safeBadge} role="status">Safe zone · enemies can&apos;t follow you here</p>}
    {rt.mission && <aside className={styles.missionTracker} data-status={rt.mission.status}>
      <b>{rt.mission.def.title}</b><span>{rt.mission.status === "complete" ? "Complete" : rt.mission.status === "failed" ? "Failed" : ""} {rt.mission.note}</span>
      {rt.escort && <small>{(rt.mission.def.params.escortee ?? "escort").replace(/^./, c => c.toUpperCase())} {Math.max(0, Math.ceil(rt.escort.hp))} / 60</small>}
    </aside>}
    {boss && <div className={styles.bossBar} data-mini={boss.type.miniboss ? true : undefined} role="meter" aria-label={boss.type.name} aria-valuenow={boss.hp} aria-valuemax={boss.type.hp}>
      <b>{boss.type.name} · Lv {boss.type.level}{boss.type.miniboss && <em> · {boss.type.miniboss.title}</em>}</b>
      <span>{phaseMarks(boss).map(f => <u key={f} style={{ left: `${f * 100}%` }} />)}<i style={{ width: `${(boss.hp / boss.type.hp) * 100}%` }} /></span>
      <small>{foeHint(boss)}</small>
    </div>}
    {!p.alive && <p className={styles.defeat} role="alert">You&apos;re down. Waking at the gate…</p>}
    {p.alive && rt.banner && <p className={styles.banner} data-kind={rt.banner.kind} role="status"><b>{rt.banner.title}</b><span>{rt.banner.text}</span></p>}
    {rt.casting && <IncantationOverlay key={rt.casting.id} runeId={rt.casting.rune} title={rt.casting.ability.name} effect={rt.casting.ability.description} onDone={onDone} onCancel={onCancel} />}
  </>;
}

const INPUT_WORD: Record<string, string> = { hold: "Hold", charge: "Charge", toggle: "Toggle", recast: "Recast", drawn: "Draw" };
/**
 * Classes v2's bar (design sheet §1.2 HUD, the LOCKED kits): keys 1–5 with the class's own abilities (a locked key
 * shows the mastery it opens at; holds and charges fill as they're held; a toggle shows on), the round ult slot at
 * 1.4× with its clockwise meter ring in the class colour (the icon greyed until full; full, it glows and pulses), the
 * combos, the class line (title, passive, movement passive) and the thin mastery bar.
 */
function ClassBar({ rt, keys }: { rt: CombatRuntime; keys: Record<string, string> }) {
  const v = rt.v2!, kit = v.kit, color = kit.look.ramp[1], meter = v.meter / ULT.max, ready = v.meter >= ULT.max;
  const armed = holdsSignature(kit, SYSTEM_WEAPONS.find(w => w.key === rt.player.weapon)?.type);
  return <>
    <small className={styles.kitLine}><b>{masteryTitle(kit.name, v.mastery)}</b> · mastery {v.mastery} · {v.passive.name}{kit.movement ? ` · ${kit.movement.name}` : ""}{armed ? "" : ` · hold your ${kit.signature.name} for your skills`}</small>
    <div className={styles.classBar} style={{ ["--class" as string]: color }}>
      <ol className={styles.abilityBar} style={{ gridTemplateColumns: `repeat(${v.keys.length}, 1fr)` }}>{v.keys.map((a, i) => {
        const id = V2_SLOT_IDS[i], base = kit.keys[i], cd = a ? v.cd[a.key] ?? 0 : 0, held = v.holding[i];
        const max = a?.input?.kind === "hold" ? a.input.max_s : a?.input?.kind === "charge" ? a.input.max_s : 1;
        const left = held !== null ? 1 - Math.min(1, held / max) : a && cd > 0 ? Math.min(1, cd / Math.max(a.cooldown_s, 0.1)) : 0;
        return <li key={`${id}-${rt.denied[id]}`} data-denied={rt.denied[id] > 0 || undefined} data-cooling={cd > 0 || undefined} data-locked={!a || undefined}
          data-held={held !== null || undefined} data-on={v.toggled[i] || undefined} data-unarmed={!armed || undefined}
          title={a ? `${a.name}${a.input && a.input.kind !== "tap" ? ` (${INPUT_WORD[a.input.kind]})` : ""}: ${a.description} · ${a.cooldown_s ? `${a.cooldown_s.toFixed(1)} s · ` : ""}${a.energy} energy` : `${base.name}: opens at mastery ${base.unlock}`}>
          <span className={styles.sweep} style={{ "--sweep": `${left * 360}deg` } as React.CSSProperties}><kbd>{keyName(keys[id])}</kbd></span>
          {/* eslint-disable-next-line @next/next/no-img-element -- a tiny static ability icon */}
          <span className={styles.slotName}>{base.icon && <img src={base.icon} alt="" width={16} height={16} style={{ verticalAlign: "-3px", marginRight: 3 }} />}{a?.name ?? base.name}</span>
          <small>{!a ? `Mastery ${base.unlock}` : held !== null ? `${INPUT_WORD[a.input!.kind]}…` : cd > 0 ? `${cd.toFixed(cd < 1 ? 1 : 0)}s` : `${a.input && a.input.kind !== "tap" ? `${INPUT_WORD[a.input.kind]} · ` : ""}${a.energy}`}</small>
        </li>;
      })}</ol>
      <div className={styles.ultSlot} data-ready={ready || undefined} data-denied={rt.denied.ult || undefined} key={`ult-${rt.denied.ult}`}
        role="meter" aria-label={`${v.ult.name} charge`} aria-valuenow={Math.floor(v.meter)} aria-valuemin={0} aria-valuemax={ULT.max}
        title={`${v.ult.name}: ${v.ult.description}${ready ? " · ready" : ` · ${Math.floor(v.meter)}%`}`} style={{ "--meter": `${meter * 360}deg` } as React.CSSProperties}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a tiny static class emblem */}
        <img src={v.ult.icon ?? kit.look.icon} alt="" />
        <kbd>{keyName(keys.ult)}</kbd>
      </div>
    </div>
    <ClassGauges rt={rt} swapKey={keys.swap} />
    {v.combos.length > 0 && <small className={styles.kitLine}>{v.combos.map(c => { const [a, b] = c.keys.map(i => keyName(keys[V2_SLOT_IDS[i]])); return `${a === b ? `${a} ${a}` : `${a} + ${b}`}: ${c.ability.name}`; }).join(" · ")}</small>}
    <div className={styles.masteryBar} role="meter" aria-label="Mastery" aria-valuenow={v.progress.into} aria-valuemin={0} aria-valuemax={v.progress.needed || 1}>
      <span style={{ width: `${v.progress.needed ? (v.progress.into / v.progress.needed) * 100 : 100}%` }} />
    </div>
  </>;
}
