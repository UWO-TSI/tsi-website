"use client";

/**
 * A v2 kit's own gauges on the ruins HUD (classes v2; the LOCKED Ranger sections), in the cream kit, read from the
 * runtime each publish: Focus and the fire rate (a focus passive), the cylinder's six chambers with special rounds
 * loaded next, the reload bar with its gold span and where the reload is (R), a spun cylinder's hammer and window,
 * the Killstreak's pips and the traps out against their cap ("Unseen" is the HUD's status line). Only what the kit has shows.
 */
import { trapCap } from "@/lib/game/combat/abilities";
import { fireRate } from "@/lib/game/combat/classFire";
import type { CombatRuntime } from "@/lib/game/combat/runtime";
import { keyName } from "@/lib/game/movement/keys";
import styles from "./ClassGauges.module.css";

export default function ClassGauges({ rt, swapKey }: { rt: CombatRuntime; swapKey: string }) {
  const v = rt.v2!, kit = v.kit, f = kit.fire, live = v.live, pv = v.passive;
  const ammo = f?.ammo, focus = pv.kind === "focus", streak = pv.kind === "killstreak", traps = kit.traps ? rt.units.filter(u => u.def.kind === "trap").length : null;
  if (!f && !streak && traps === null) return null;
  const spun = live.cockEvery > 0;
  return <div className={styles.gauges} style={{ ["--class" as string]: kit.look.ramp[1] }}>
    {focus && f && <div className={styles.focus} role="meter" aria-label="Focus" aria-valuenow={Math.round(live.focus * 100)} aria-valuemin={0} aria-valuemax={100}>
      <b>Focus</b><span><i style={{ width: `${live.focus * 100}%` }} /></span><small>{fireRate(rt).toFixed(1)}/s</small>
    </div>}
    {ammo && <div className={styles.cylinder} data-spun={spun || undefined} aria-label={`${live.ammo} of ${ammo.size} rounds`}>
      <ol>{Array.from({ length: ammo.size }, (_, i) => {
        // Chambers fire in order; the ones still loaded run from the current chamber; special rounds sit next up.
        const k = (i - live.chamber + ammo.size) % ammo.size, loaded = k < live.ammo, round = loaded ? live.loaded[k] : undefined;
        return <li key={i} data-loaded={loaded || undefined} data-next={(k === 0 && loaded) || undefined} data-last={i === ammo.size - 1 || undefined}
          style={round ? { background: f?.rounds?.[round]?.tint ?? "var(--class)" } : undefined} />;
      })}</ol>
      {live.reload !== null ? <div className={styles.reload} aria-label="Reloading">
        <span style={{ left: `${ammo.gold[0] * (ammo.reload_s / live.reloadLen) * 100}%`, width: `${(ammo.gold[1] - ammo.gold[0]) * (ammo.reload_s / live.reloadLen) * 100}%` }} data-tried={live.tried || undefined} />
        <i style={{ left: `${Math.min(1, live.reload / live.reloadLen) * 100}%` }} />
        <small><kbd>{keyName(swapKey)}</kbd> in the gold</small>
      </div> : spun ? <small className={styles.hammer} data-ready={live.cock <= 0 || undefined}>{live.cock > 0 ? "Cocking…" : "Hammer cocked"} · {Math.ceil(live.window)} s</small>
        : <small className={styles.hint}>{live.bonus > 0 ? `+${Math.round(ammo.bonus * 100)}% · ${live.bonus} left` : <><kbd>{keyName(swapKey)}</kbd> Reload</>}</small>}
    </div>}
    {streak && <div className={styles.streak} aria-label={`Killstreak ${live.streak}`}>
      <b>Streak</b>{Array.from({ length: pv.cap ?? 5 }, (_, i) => <i key={i} data-on={i < live.streak || undefined} />)}
    </div>}
    {traps !== null && <small className={styles.hint}>Traps {traps}/{trapCap(rt)}</small>}
  </div>;
}
