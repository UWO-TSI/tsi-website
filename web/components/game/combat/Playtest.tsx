"use client";

/**
 * The class playtest in the island (specs/classes/playtest.md), dev-only and `?combat=demo` only: its section of the
 * dev panel (switch subclass and mastery in place, fill the ult, god mode, infinite mana, reset cooldowns, slow motion,
 * Reduce flashing and Screen shake, the spawner) and its ruins HUD (the 5 s DPS meter, the Note box on N, the key card
 * that H hides). Logic: lib/game/combat/playtest.ts.
 */
import { Fragment, useEffect, useState } from "react";
import { COMBO_WINDOW, STAT_DIRECTION_LABEL, type ClassAbility } from "@/lib/combat/classes";
import { ULT } from "@/lib/combat/ult";
import { setComfort, useComfort, type ShakeLevel } from "@/lib/game/comfortSettings";
import { holdItem } from "@/lib/game/heldStore";
import { keyName, useAbilityKeys } from "@/lib/game/movement/keys";
import { devSlowMotion } from "@/lib/game/slowMotion";
import { WEAPONS } from "@/lib/game/combat/data";
import { installCombatDemo } from "@/lib/game/combat/demo";
import { addNote, bestSignature, classRows, clearPlaytest, DPS_WINDOW, dpsView, PLAYTEST, playtestHarness, playtestOn, setPlaytest, SPAWNER, spawnPlaytest } from "@/lib/game/combat/playtest";
import { combat, publishCombat, setWeapon, useCombatValue, useCombatVersion, V2_SLOT_IDS, type AbilityId, type CombatRuntime } from "@/lib/game/combat/runtime";
import css from "./Playtest.module.css";

const post = (path: string, body: unknown) => {
  installCombatDemo();
  return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null);
};
/**
 * The kit's signature weapon in hand, on the wheel and kept as the demo's equipped one, all before the next render: the
 * wheel's own effects then agree with the runtime (they chase each other when the two differ, wave-0 question 19).
 */
async function holdSignature(kitKey: string) {
  const rt = combat.rt, sig = bestSignature(kitKey, rt.player.owned);
  if (!sig) return;
  if (rt.player.weapon !== sig && setWeapon(rt, sig)) { holdItem(`weapon:${sig}`); publishCombat(); }
  await post("/api/combat/equip", { weapon: sig });
}
/** A panel button gives focus back to the game, so WASD walks again. */
const blur = (e: { currentTarget: HTMLElement }) => e.currentTarget.blur();

/** The dev panel's section (DefaultIslandWorld): nothing outside the demo. `onChanged` re-reads progression (the kit, the aura, the Path sheet). */
export function PlaytestControls(props: { ruins: boolean; onChanged: () => void }) {
  const [on] = useState(playtestOn);
  return on ? <Controls {...props} /> : null;
}

function Controls({ ruins, onChanged }: { ruins: boolean; onChanged: () => void }) {
  const kitKey = useCombatValue(() => combat.rt.v2?.kit.key ?? ""), mastery = useCombatValue(() => combat.rt.v2?.mastery ?? 0);
  const comfort = useComfort();
  const [rows] = useState(classRows);
  const [flags, setFlags] = useState({ ...PLAYTEST });
  const [slow, setSlow] = useState(1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Opened from /lab/classes, the kit's signature weapon is in hand in the ruins (on entry, and after a switch); later picks on the wheel stand.
  useEffect(() => {
    if (!ruins || !kitKey || !playtestHarness()) return;
    const t = window.setTimeout(() => void holdSignature(kitKey), 0); // after this commit's own effects
    return () => window.clearTimeout(t);
  }, [ruins, kitKey]);
  useEffect(() => () => devSlowMotion(1), []);

  const switchTo = async (subclass: string, level: number) => {
    setBusy(true); setStatus(null);
    const r = await post("/api/combat/dev-class", { subclass, mastery: level });
    if (r?.ok) {
      const p = combat.rt.player;
      for (const k of r.owned as string[]) if (WEAPONS[k] && !p.owned.includes(k)) { p.owned.push(k); p.durability[k] = WEAPONS[k].maxDurability; }
      if (ruins) await holdSignature(subclass);
      const url = new URL(window.location.href);
      url.searchParams.set("subclass", subclass); url.searchParams.set("mastery", String(level));
      window.history.replaceState(window.history.state, "", url); // a reload keeps this class
      onChanged();
    } else setStatus(r?.error ?? "Couldn't switch the class.");
    setBusy(false);
  };
  const flag = (k: keyof typeof PLAYTEST) => { setPlaytest(k, !PLAYTEST[k]); setFlags({ ...PLAYTEST }); };
  const v2 = () => combat.rt.v2;
  return <section className={css.section} aria-label="Class playtest">
    <h2>Class playtest</h2>
    <div className={css.selects}>
      <label>Subclass
        <select value={kitKey} disabled={busy} onChange={e => { void switchTo(e.target.value, mastery || 20); blur(e); }}>
          {!kitKey && <option value="">None</option>}
          {kitKey && !rows.some(r => r.key === kitKey) && <option value={kitKey}>{combat.rt.v2?.kit.name}</option>}
          {rows.map(r => <option key={r.key} value={r.key} disabled={!r.kit}>{r.name}{r.kit ? "" : " (coming)"}</option>)}
        </select>
      </label>
      <label>Mastery
        <select value={mastery || ""} disabled={busy || !kitKey} onChange={e => { void switchTo(kitKey, Number(e.target.value)); blur(e); }}>
          {!mastery && <option value="">–</option>}
          {Array.from({ length: 20 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
        </select>
      </label>
    </div>
    {status && <p className={css.note} role="status">{status}</p>}
    <div className={css.pair}>
      <button className={css.btn} disabled={!kitKey} onClick={e => { const v = v2(); if (v) { v.meter = ULT.max; publishCombat(); } blur(e); }}>Fill ult</button>
      <button className={css.btn} onClick={e => {
        const rt = combat.rt, v = rt.v2;
        if (v) { v.cd = {}; v.moveCd = 0; }
        for (const k of Object.keys(rt.cooldowns) as AbilityId[]) rt.cooldowns[k] = 0;
        publishCombat(); blur(e);
      }}>Reset cooldowns</button>
      <button className={css.btn} aria-pressed={flags.god} onClick={e => { flag("god"); blur(e); }} title="Hits still show; your health stays full">God mode</button>
      <button className={css.btn} aria-pressed={flags.mana} onClick={e => { flag("mana"); blur(e); }}>Infinite mana</button>
    </div>
    <div className={css.field}>Slow motion
      <div className={css.seg} role="group" aria-label="Slow motion">{[1, 0.5, 0.25].map(k => <button key={k} aria-pressed={slow === k} onClick={e => { setSlow(k); devSlowMotion(k); blur(e); }}>{k}×</button>)}</div>
    </div>
    <button className={css.btn} aria-pressed={comfort.reduceFlashing} onClick={e => { setComfort({ reduceFlashing: !comfort.reduceFlashing }); blur(e); }}>Reduce flashing</button>
    <div className={css.field}>Screen shake
      <div className={css.seg} role="group" aria-label="Screen shake">{(["full", "low", "off"] as ShakeLevel[]).map(k => <button key={k} aria-pressed={comfort.screenShake === k} onClick={e => { setComfort({ screenShake: k }); blur(e); }}>{k[0].toUpperCase() + k.slice(1)}</button>)}</div>
    </div>
    {ruins ? <>
      <h2>Spawn at the gate</h2>
      <div className={css.pair}>
        {SPAWNER.map(s => <button key={s.id} className={css.btn} title={s.title} onClick={e => { spawnPlaytest(combat.rt, s.id); publishCombat(); blur(e); }}>{s.label}</button>)}
        <button className={`${css.btn} ${css.wide}`} onClick={e => { clearPlaytest(combat.rt); publishCombat(); blur(e); }}>Clear all</button>
      </div>
      <p className={css.note}>They appear just past the safe zone and wait for you. Clear all first for an empty field; leaving the ruins brings the wild back.</p>
    </> : <p className={css.note}>The spawner opens in the ruins.</p>}
  </section>;
}

// ── The ruins HUD ───────────────────────────────────────────────
const CARD_KEY = "tsi.playtest.keyCard.v1";
const typing = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest("input, textarea, select");

/** The meter, the Note box and the key card, in the ruins (DefaultIslandWorld): only when opened from /lab/classes. */
export function PlaytestHud() {
  const [on] = useState(playtestHarness);
  return on ? <Hud /> : null;
}

function Hud() {
  useCombatVersion();
  const rt = combat.rt, view = dpsView(rt);
  const [card, setCard] = useState(() => { try { return localStorage.getItem(CARD_KEY) !== "hidden"; } catch { return true; } });
  const [noting, setNoting] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "h") setCard(c => { try { localStorage.setItem(CARD_KEY, c ? "hidden" : "shown"); } catch { /* this session */ } return !c; });
      if (k === "n") { e.preventDefault(); setNoting(true); }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);
  useEffect(() => { if (!saved) return; const t = window.setTimeout(() => setSaved(false), 1600); return () => window.clearTimeout(t); }, [saved]);
  return <div className={css.hud}>
    {card && rt.v2 && <KeyCard rt={rt} />}
    <section className={`${css.card} ${css.meter}`} aria-label="Damage meter">
      <div className={css.dps}><span><small>DPS, last {DPS_WINDOW} s of fight</small><b data-testid="playtest-dps">{view.dps.toFixed(1)}</b></span>
        {!noting && <button onClick={() => setNoting(true)}><kbd>N</kbd> Note</button>}</div>
      <small>{view.total ? `${Math.round(view.total)} damage · biggest ${view.biggest?.n ?? 0}${view.biggest?.crit ? " crit" : ""}` : "Hit something to start the meter"}</small>
      <div className={css.hits} aria-label="Last hits">{view.last.map((h, i) => <span key={`${h.t}-${i}`} data-crit={h.crit || undefined}>{h.n}</span>)}</div>
      {noting && <form className={css.noteRow} onSubmit={e => { e.preventDefault(); const text = new FormData(e.currentTarget).get("note"); if (addNote(rt, String(text ?? ""))) setSaved(true); setNoting(false); }}>
        <input name="note" aria-label="Note" placeholder="What felt off?" autoFocus autoComplete="off" onKeyDown={e => { if (e.key === "Escape") setNoting(false); }} />
        <button type="submit">Save</button>
      </form>}
      {saved && <small role="status">Noted. It&apos;s on /lab/classes.</small>}
    </section>
  </div>;
}

/** How a key fires, in words. */
function inputWord(a: ClassAbility): string {
  const i = a.input;
  switch (i?.kind) {
    case "hold": return "hold";
    case "charge": return "hold, then let go";
    case "toggle": return "press again to end";
    case "recast": return `press again within ${i.window_s} s`;
    case "drawn": return `draw a ${i.shape}`;
    default: return "";
  }
}

/** Everything the class's keys do at this mastery, read off its kit (so a family that lands brings its own card). Each line is cut to two; hover shows it whole. */
function KeyCard({ rt }: { rt: CombatRuntime }) {
  const keys = useAbilityKeys(), v = rt.v2!, kit = v.kit;
  const drawn = v.keys.some(a => a?.input?.kind === "drawn"), holds = v.combos.filter(c => c.hold), fire = kit.fire;
  const key = (i: number) => keyName(keys[V2_SLOT_IDS[i]]);
  const line = (text: string) => <span title={text}>{text}</span>;
  return <section className={`${css.card} ${css.keyCard}`} aria-label={`${kit.name} keys`} data-testid="playtest-keycard">
    <header><span><b>{kit.name}</b> · mastery {v.mastery} · {kit.style === "basic" ? "basic-attack" : "skill"} class, builds {STAT_DIRECTION_LABEL[kit.stat.kind].toLowerCase()}</span><small><kbd>H</kbd> hides</small></header>
    <dl>
      <dt><kbd>Click</kbd></dt><dd><b>Attack</b><em> · skills need your {kit.signature.name}{kit.forms ? "; a form brings its own attack" : ""}</em>
        {fire && line(`${fire.rate} shots a second${fire.drop ? "; arrows drop with distance" : ""}${fire.weak ? "; weak points always crit" : ""}.`)}</dd>
      {fire?.ammo && <><dt><kbd>{keyName(keys.swap)}</kbd></dt><dd><b>Reload</b><em> · {fire.ammo.size} rounds</em>
        {line(`Automatic when empty. Press it again in the gold zone: an instant reload and +${Math.round(fire.ammo.bonus * 100)}% damage on the next ${fire.ammo.size}.`)}</dd></>}
      {kit.keys.map((base, i) => {
        const a = v.keys[i], how = a ? inputWord(a) : "";
        return <Fragment key={base.key}><dt><kbd>{key(i)}</kbd></dt>
          <dd data-locked={!a || undefined}><b>{base.name}</b>{how && <em> · {how}</em>}{!a && <em> · {base.learn ? "learn it by defeating its creature" : base.tame ? "tame it at the ritual circle" : base.unlock && base.unlock > v.mastery ? `mastery ${base.unlock}` : "locked"}</em>}{line(base.description)}</dd></Fragment>;
      })}
      {v.combos.length > 0 && <><dt>Combos</dt><dd data-short><b>Two keys within {COMBO_WINDOW} s, either order</b>
        <span className={css.combos}>{v.combos.map(c => <i key={c.ability.key}>{key(c.keys[0])}+{key(c.keys[1])} {c.ability.name}</i>)}
          {kit.combos!.length > v.combos.length && <i>{kit.combos!.length - v.combos.length} more with mastery</i>}</span>
        {holds.map(c => <Fragment key={c.hold!.key}>{line(`Hold ${key(c.keys[0])}+${key(c.keys[1])}: ${c.hold!.description.replace(/^Held:\s*/i, "")}`)}</Fragment>)}</dd></>}
      <dt><kbd>{keyName(keys.ult)}</kbd></dt><dd><b>{v.ult.name}</b><em> · ultimate, fills as you fight</em>{line(v.ult.description)}</dd>
      <dt>Passive</dt><dd data-short><b>{v.passive.name}</b>{line(v.passive.description)}</dd>
      {kit.movement && <><dt>Move</dt><dd data-short><b>{kit.movement.name}</b><em> · ruins only</em>{line(kit.movement.description)}</dd></>}
      {drawn && <><dt>Draw</dt><dd><b>Trace the shape</b>{line("The closer the stroke, the stronger: 60% for a rough sketch up to 150% for a clean one; under half fizzles.")}</dd></>}
    </dl>
  </section>;
}
