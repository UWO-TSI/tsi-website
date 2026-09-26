"use client";

/**
 * Ruins HUD: health, dodge, equipped weapon + durability, ability bar (1–4,
 * remappable), mission tracker, boss bar, safe-zone badge, hurt vignette,
 * defeat card, pooled damage numbers, and the incantation overlay.
 */
import { ABILITIES, ENERGY, combat, publishCombat, readAbilityKeys, useCombatVersion } from "@/lib/game/combat/runtime";
import { runeById } from "@/lib/game/combat/runes";
import { WEAPONS } from "@/lib/game/combat/data";
import { resolveCast } from "@/lib/game/combat/actions";
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
  const onCancel = () => { combat.rt.casting = null; publishCombat(); };
  return <>
    <div className={styles.hurt} data-on={p.hurt > 0 || undefined} aria-hidden="true" />
    <div className={styles.floaters} aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <div key={i} ref={el => { floaterNodes[i] = el; }} className={styles.floater} />)}</div>
    <section className={styles.combatHud} aria-label="Combat status">
      <div className={styles.hpBar} role="meter" aria-label="Health" aria-valuenow={Math.round(p.hp)} aria-valuemin={0} aria-valuemax={p.maxHp}>
        <span style={{ width: `${(p.hp / p.maxHp) * 100}%` }} /><b>{Math.ceil(p.hp)} / {p.maxHp}</b>
      </div>
      <div className={`${styles.hpBar} ${styles.energyBar}`} role="meter" aria-label="Energy" aria-valuenow={Math.round(p.energy)} aria-valuemin={0} aria-valuemax={ENERGY.max}>
        <span style={{ width: `${(p.energy / ENERGY.max) * 100}%` }} /><b>Energy {Math.floor(p.energy)}</b>
      </div>
      <div className={styles.weaponLine}>
        <span>{w.name}</span>
        <small data-broken={p.durability[p.weapon] <= 0 || undefined}>Durability {p.durability[p.weapon]}/{w.maxDurability}{p.durability[p.weapon] <= 0 ? " · broken, half damage" : ""}</small>
        <small className={styles.dodgePip} data-ready={p.dodgeCd <= 0 || undefined}><kbd>Space</kbd> Dodge</small>
      </div>
      <ol className={styles.abilityBar}>{ABILITIES.map(a => <li key={a.id} data-cooling={rt.cooldowns[a.id] > 0 || undefined}>
        <kbd>{keys[a.id].toUpperCase()}</kbd><span>{a.id === "signature" ? rt.signature?.name ?? "Signature" : a.name}</span>
        {(a.id === "spark" || a.id === "binding") && <small>{runeById(a.id).energy}</small>}
        {a.id === "signature" && rt.signature && <small>{rt.signature.energy}</small>}
        {rt.cooldowns[a.id] > 0 && <em>{Math.ceil(rt.cooldowns[a.id])}</em>}
      </li>)}</ol>
    </section>
    {p.safe && <p className={styles.safeBadge} role="status">Safe zone · enemies can&apos;t follow you here</p>}
    {rt.mission && <aside className={styles.missionTracker} data-status={rt.mission.status}>
      <b>{rt.mission.def.title}</b><span>{rt.mission.status === "complete" ? "Complete" : rt.mission.status === "failed" ? "Failed" : ""} {rt.mission.note}</span>
      {rt.escort && <small>{(rt.mission.def.params.escortee ?? "escort").replace(/^./, c => c.toUpperCase())} {Math.max(0, Math.ceil(rt.escort.hp))} / 60</small>}
    </aside>}
    {boss && rt.bossEngaged && <div className={styles.bossBar} role="meter" aria-label={boss.type.name} aria-valuenow={boss.hp} aria-valuemax={boss.type.hp}>
      <b>{boss.type.name} · Lv {boss.type.level}</b><span><i style={{ width: `${(boss.hp / boss.type.hp) * 100}%` }} /></span>
      <small>A wall until you&apos;re geared (row 230).</small>
    </div>}
    {!p.alive && <p className={styles.defeat} role="alert">You&apos;re down. Waking at the gate…</p>}
    {rt.casting && <IncantationOverlay key={rt.casting.id} runeId={rt.casting.rune} onDone={onDone} onCancel={onCancel} />}
  </>;
}
