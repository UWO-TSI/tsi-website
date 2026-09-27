"use client";

/**
 * Ruins HUD: health (and shield), energy, equipped weapon + durability, the
 * four equipped kit abilities (keys 1–4, remappable; runes marked), summon and
 * totem caps, mission tracker, boss bar, safe-zone badge, hurt vignette,
 * defeat card, pooled damage numbers, and the incantation overlay.
 */
import { ENERGY, SLOT_IDS, combat, publishCombat, readAbilityKeys, useCombatVersion } from "@/lib/game/combat/runtime";
import { WEAPONS } from "@/lib/game/combat/data";
import { resolveCast } from "@/lib/game/combat/actions";
import { cancelCast } from "@/lib/game/combat/abilities";
import { CAPS } from "@/lib/combat/kits";
import { staggered } from "@/lib/game/combat/sim";
import type { IncantationScore } from "@/lib/game/combat/contract";
import { floaterNodes } from "./EncounterRender";
import IncantationOverlay from "./IncantationOverlay";
import styles from "../DefaultIslandWorld.module.css";

export default function CombatHud({ player }: { player: React.RefObject<{ x: number; z: number }> }) {
  useCombatVersion();
  const rt = combat.rt, p = rt.player, w = WEAPONS[p.weapon];
  const keys = readAbilityKeys();
  const boss = rt.enemies.find(e => e.type.kind === "boss");
  const onDone = (score: IncantationScore) => { const at = player.current; resolveCast(combat.rt, { x: at.x, z: at.z }, score); publishCombat(); };
  const onCancel = () => { cancelCast(combat.rt); publishCombat(); };
  const kit = rt.kit, minions = rt.units.filter(u => u.def.kind === "minion" && u.source !== "weapon"), totems = rt.units.filter(u => u.def.kind === "totem");
  const summons = kit && rt.slots.some(a => a?.effects.some(e => e.kind === "summon" && !["decoy", "tripwire"].includes(e.unit)));
  const usesTotems = kit && rt.slots.some(a => a?.effects.some(e => e.kind === "summon" && e.unit.startsWith("totem")));
  return <>
    <div className={styles.hurt} data-on={p.hurt > 0 || undefined} aria-hidden="true" />
    <div className={styles.floaters} aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <div key={i} ref={el => { floaterNodes[i] = el; }} className={styles.floater} />)}</div>
    <section className={styles.combatHud} aria-label="Combat status">
      <div className={styles.hpBar} role="meter" aria-label="Health" aria-valuenow={Math.round(p.hp)} aria-valuemin={0} aria-valuemax={p.maxHp}>
        <span style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />{p.shield > 0.5 && <i style={{ width: `${Math.min(100, (p.shield / p.maxHp) * 100)}%` }} />}
        <b>{Math.ceil(p.hp)} / {p.maxHp}{p.shield > 0.5 ? ` · shield ${Math.ceil(p.shield)}` : ""}</b>
      </div>
      <div className={`${styles.hpBar} ${styles.energyBar}`} role="meter" aria-label="Energy" aria-valuenow={Math.round(p.energy)} aria-valuemin={0} aria-valuemax={ENERGY.max}>
        <span style={{ width: `${(p.energy / ENERGY.max) * 100}%` }} /><b>Energy {Math.floor(p.energy)}</b>
      </div>
      <div className={styles.weaponLine}>
        <span>{w.name}</span>
        <small data-broken={p.durability[p.weapon] <= 0 || undefined}>Durability {p.durability[p.weapon]}/{w.maxDurability}{p.durability[p.weapon] <= 0 ? " · broken, half damage" : ""}</small>
        <small className={styles.dodgePip} data-ready={p.dodgeCd <= 0 || undefined}><kbd>Space</kbd> Dodge · <kbd>{keys.swap.toUpperCase()}</kbd> Swap</small>
      </div>
      {kit && <small className={styles.kitLine}>{kit.subclass.name} · {kit.subclass.passive.name}{rt.transform ? ` · ${rt.transform.name}` : ""}
        {summons ? ` · Summons ${minions.reduce((n, u) => n + (u.def.cost ?? 1), 0)}/${kit.capacity}` : ""}{usesTotems ? ` · Totems ${totems.length}/${CAPS.totems}` : ""}</small>}
      <ol className={styles.abilityBar}>{SLOT_IDS.map((id, i) => { const a = rt.slots[i]; return <li key={id} data-cooling={rt.cooldowns[id] > 0 || undefined} data-rune={a?.incantation || undefined} title={a?.description}>
        <kbd>{keys[id].toUpperCase()}</kbd><span>{a?.name ?? (kit ? "Empty" : "Choose a subclass")}</span>
        {a && <small>{a.incantation ? "Rune · " : ""}{a.energy}</small>}
        {rt.cooldowns[id] > 0 && <em>{Math.ceil(rt.cooldowns[id])}</em>}
      </li>; })}</ol>
    </section>
    {p.safe && <p className={styles.safeBadge} role="status">Safe zone · enemies can&apos;t follow you here</p>}
    {rt.mission && <aside className={styles.missionTracker} data-status={rt.mission.status}>
      <b>{rt.mission.def.title}</b><span>{rt.mission.status === "complete" ? "Complete" : rt.mission.status === "failed" ? "Failed" : ""} {rt.mission.note}</span>
      {rt.escort && <small>{(rt.mission.def.params.escortee ?? "escort").replace(/^./, c => c.toUpperCase())} {Math.max(0, Math.ceil(rt.escort.hp))} / 60</small>}
    </aside>}
    {boss && rt.bossEngaged && <div className={styles.bossBar} role="meter" aria-label={boss.type.name} aria-valuenow={boss.hp} aria-valuemax={boss.type.hp}>
      <b>{boss.type.name} · Lv {boss.type.level}</b><span><i style={{ width: `${(boss.hp / boss.type.hp) * 100}%` }} /></span>
      <small>{staggered(boss) ? "Staggered: strike now" : boss.phase === 3 ? "Enraged" : boss.phase === 2 ? "Calling rune wisps" : "Watch the ring and the beam"}</small>
    </div>}
    {!p.alive && <p className={styles.defeat} role="alert">You&apos;re down. Waking at the gate…</p>}
    {p.alive && rt.banner && <p className={styles.defeat} role="status">{rt.banner.text}</p>}
    {rt.casting && <IncantationOverlay key={rt.casting.id} runeId={rt.casting.rune} title={rt.casting.ability.name} effect={rt.casting.ability.description} onDone={onDone} onCancel={onCancel} />}
  </>;
}
