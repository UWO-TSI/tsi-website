"use client";

/**
 * The member island's fishing overlay (David, 2026-10-28: "update the ui for fishing to look nicer ... add small micro
 * animation and juice ... redo the fishing bar"; specs/design-bible.md UI): the flat kit's fishing pieces
 * (components/gui/flat/reel) over the shared rules (lib/game/useFishingSession, useReelLoop, useCastMeter,
 * useCatchCard). The applicant island keeps its own (components/game/FishingOverlay.tsx), on the same rules.
 *
 * Calm while you fish, juicy at the big moments: the hook (the black chip springs in and tugs; the "!" over you and
 * its sound are the world's), the catch (the fish leaps out of the track in a burst, the card lands with a spring),
 * and a rare fish (its card's edge flares and throws sparks in its rarity). Values move, never jump.
 */
import { useEffect, useRef } from "react";
import { Fish, FishOff, Waves } from "lucide-react";
import { CatchCard, CatchTag, LineGauge, PowerMeter, ReelPanel, ReelTags, ReelTrack, StatusChip, confettiBurst, reelStyles, sparkBurst, splash, type ChipTone } from "@/components/gui/flat/reel";
import { AudioManager } from "@/lib/game/audio";
import { BOSS, BOSS_CALL } from "@/lib/game/fishingReel";
import { CAST, RARITY_META, START_PROGRESS, fishOdds, iconFor, type FishDef } from "@/lib/game/fishing";
import { FISHING_HINTS, type CastDevice, type FishingHeldInput } from "@/lib/game/fishingInput";
import { oneLinerFor } from "@/lib/game/peaceful";
import type { RodEffects, RodTier } from "@/lib/game/rods";
import { useCastMeter } from "@/lib/game/useCastMeter";
import { useCatchCard } from "@/lib/game/useCatchCard";
import { useFishingSession } from "@/lib/game/useFishingSession";
import { useReelLoop } from "@/lib/game/useReelLoop";
import m from "./MemberFishing.module.css";

/** Rare and up: a rare fish's card flares and throws sparks. */
const RARE = new Set(["rare", "epic", "legendary", "divine"]);
const QUARTERS = [0.25, 0.5, 0.75] as const;
/** The meter's line: its tip is the water accent here, not gold (the applicant's overlay keeps FISHING_HINTS' gold tip). */
const CHARGE: Record<CastDevice, string> = { key: "Hold E, let go at the tip", mouse: "Hold the click, let go at the tip", touch: "Keep holding, lift at the tip" };
/**
 * A new species' card (David 2026-10-29: "if new, have slight suspense and confetti, and suspense based off rarity"):
 * how long the silhouette builds before it develops (ms), and how many bursts of confetti follow. A repeat has neither.
 */
const SUSPENSE: Record<FishDef["rarity"], { build: number; confetti: number }> = {
  common: { build: 900, confetti: 1 }, uncommon: { build: 1100, confetti: 1 }, rare: { build: 1500, confetti: 2 },
  epic: { build: 2000, confetti: 3 }, legendary: { build: 2600, confetti: 4 }, divine: { build: 3200, confetti: 5 }, contraband: { build: 900, confetti: 1 },
};

export default function MemberFishing({ onActiveChange, rod }: { onActiveChange?: (active: boolean) => void; rod?: RodTier }) {
  const s = useFishingSession({ onActiveChange, rod });
  const { phase, fish, device } = s;
  if (phase === "idle") return null;
  if (phase === "revealing" && fish) {
    return <div className={m.card}>
      <MemberCatchCard fish={fish} sizeCm={s.caughtSize} recipe={s.learned} together={s.buddy} isNew={s.wasNew} newRecord={s.newRecord} delay={s.revealDelay} onDone={s.cancel} />
    </div>;
  }
  const chip: [ChipTone, string, React.ReactNode] =
    phase === "casting" ? [s.maxCast ? "gold" : "plain", s.maxCast ? "Max cast!" : "Casting", <Waves key="i" />]
      : phase === "waiting" ? ["wait", "Waiting for a bite", <Fish key="i" />]
        : phase === "bite" ? ["alert", "Hook it!", <Fish key="i" />]
          : phase === "surfacing" ? ["gold", "Something huge is coming up", <Waves key="i" />]
            : ["plain", s.missNote ?? "It got away", <FishOff key="i" />];
  // One chip at a time, nothing else written (David 2026-10-29: "only have one"); Esc still cancels, it just isn't said.
  return (
    <div className={m.lane} data-member-fishing={phase}>
      {phase === "charging" ? <MemberMeter onRelease={s.castNow} releaseRequestedRef={s.releaseRequestedRef} hint={CHARGE[device]} />
        : phase === "reeling" && fish ? <MemberReel key={fish.key} fish={fish} known={s.owned.has(fish.key)} onDone={s.onReelDone} initialInput={s.reelInput}
          rig={s.rod} help={FISHING_HINTS[device].reel} boss={s.bossMode} raidId={s.raidId} />
          : <StatusChip tone={chip[0]} icon={chip[2]}>{chip[1]}</StatusChip>}
    </div>
  );
}

/** The cast meter: the power rises and falls along the lane, under the character; in the gold tip the readout pops. */
function MemberMeter({ onRelease, releaseRequestedRef, hint }: { onRelease: (power: number) => void; releaseRequestedRef: React.RefObject<boolean>; hint: string }) {
  const meterRef = useRef<HTMLDivElement>(null), fillRef = useRef<HTMLDivElement>(null), readoutRef = useRef<HTMLDivElement>(null);
  const tip = useRef(false);
  useCastMeter({ releaseRequestedRef, onRelease, onFrame: (p, inTip) => {
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
    if (readoutRef.current) readoutRef.current.textContent = inTip ? "Max" : `${Math.round(p * 100)}%`;
    if (inTip !== tip.current) {
      tip.current = inTip;
      if (meterRef.current) meterRef.current.dataset.tip = String(inTip);
      if (inTip) readoutRef.current?.animate([{ transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 260, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" });
    }
  } });
  return <ReelPanel className={m.meter}><PowerMeter horizontal meterRef={meterRef} fillRef={fillRef} readoutRef={readoutRef} zone={1 - CAST.maxZone} hint={hint} /></ReelPanel>;
}

/**
 * The reel: the fish, the water track with the catch window, and the gauge under it that fills while the fish is in the
 * window. No how-to (David's playtest 2026-10-29: "this ui needs to be changed to not include the tutorial on how its
 * done"): the tutorial teaches it once; `help` is only the screen reader's description. A boss adds its stamina (its
 * phases marked) and its call; a raid says how many are reeling.
 */
function MemberReel({ fish, known, onDone, initialInput, rig, help, boss, raidId }: {
  fish: FishDef; known: boolean; onDone: (success: boolean) => void; initialInput: FishingHeldInput; rig: Pick<RodEffects, "tensionMul" | "fillMul" | "barMul">; help: string;
  boss: "solo" | "shared" | null; raidId?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null), trackRef = useRef<HTMLDivElement>(null), windowRef = useRef<HTMLDivElement>(null), markerRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null), fillRef = useRef<HTMLDivElement>(null), staminaRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<HTMLSpanElement>(null), whoRef = useRef<HTMLSpanElement>(null), pausedRef = useRef<HTMLParagraphElement>(null);
  const state = useRef({ inside: true, near: false, low: false, call: "", away: false, tension: "", step: -1, fishAt: 0.5, splashAt: 0 });
  const barW = Math.min(0.5, RARITY_META[fish.rarity].barW * rig.barMul * (boss ? BOSS.barMul[0] : 1));
  const start = boss ? BOSS.line : START_PROGRESS;

  useReelLoop({
    fish, boss, raidId, rig, initialInput, focus: panelRef, onDone,
    onPause: (paused) => { if (pausedRef.current) pausedRef.current.hidden = !paused; },
    onFrame: ({ sim, now, raid }) => {
      const st = state.current, track = trackRef.current;
      if (windowRef.current) windowRef.current.style.transform = `translateX(${(sim.position / sim.barWidth) * 100}%)`;
      if (windowRef.current) windowRef.current.style.width = `${sim.barWidth * 100}%`;
      if (markerRef.current) markerRef.current.style.transform = `translate(${sim.fishPosition * 100}%, ${Math.sin(now / 160) * 2}px)`;
      // In the window (it glows and breathes), or slipping out (a soft red flash and a low tick); back in, it springs.
      if (sim.inside !== st.inside && track) {
        st.inside = sim.inside;
        track.dataset.in = String(sim.inside);
        track.dataset.slip = String(!sim.inside);
        if (sim.inside) windowRef.current?.animate([{ transform: `${windowRef.current.style.transform} scaleY(1.18)` }, { transform: `${windowRef.current.style.transform} scaleY(1)` }], { duration: 220, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" });
        else AudioManager.playSFX("click", { rate: 0.55, gain: 0.3 });
      }
      // The fight: droplets fly off the fish when it darts (a few a second at most).
      const speed = Math.abs(sim.fishPosition - st.fishAt);
      st.fishAt = sim.fishPosition;
      if (speed > 0.004 && now - st.splashAt > 260 && track && markerRef.current?.dataset.away !== "true") {
        st.splashAt = now;
        const box = track.getBoundingClientRect();
        splash(box.left + sim.fishPosition * box.width, box.top + box.height / 2, speed > 0.012 ? 4 : 2);
      }
      // Each tenth the line gains, the gauge surges with a spring and ticks a little higher.
      const step = Math.floor(sim.progress * 10);
      if (st.step >= 0 && step > st.step && !sim.boss) {
        gaugeRef.current?.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(2)", offset: 0.35 }, { transform: "scaleY(1)" }], { duration: 300, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" });
        AudioManager.playSFX("blip3", { rate: 0.85 + step * 0.07, gain: 0.16 });
      }
      st.step = step;
      // The end's build-up: the reel trembles as it nears full, then shakes for the last stretch ("almost!").
      const tension = sim.boss ? "" : sim.progress > 0.9 ? "almost" : sim.progress > 0.75 ? "near" : "";
      if (tension !== st.tension && panelRef.current) {
        if (tension === "almost") AudioManager.playSFX("confirm", { rate: 1.45, gain: 0.22 });
        st.tension = tension;
        if (tension) panelRef.current.dataset.tension = tension; else delete panelRef.current.dataset.tension;
      }
      const away = sim.boss?.stage === "live" && sim.boss.move === "jump";
      if (away !== st.away && markerRef.current) { st.away = away; markerRef.current.dataset.away = String(away); }
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${sim.progress})`;
      gaugeRef.current?.setAttribute("aria-valuenow", String(Math.round(sim.progress * 100)));
      const near = !sim.boss && sim.progress > 0.75, low = sim.progress < 0.25;
      if (near !== st.near && gaugeRef.current) { st.near = near; gaugeRef.current.dataset.near = String(near); }
      if (low !== st.low && gaugeRef.current) { st.low = low; gaugeRef.current.dataset.tone = low ? "low" : ""; }
      if (sim.boss) {
        if (staminaRef.current) staminaRef.current.style.transform = `scaleX(${sim.boss.stamina})`;
        const call = sim.boss.move && sim.boss.stage ? `${sim.boss.stage}:${sim.boss.move}` : "";
        if (call !== st.call && callRef.current) {
          st.call = call;
          callRef.current.dataset.stage = sim.boss.stage ?? "";
          callRef.current.textContent = sim.boss.move && sim.boss.stage ? BOSS_CALL[sim.boss.move][sim.boss.stage] : "";
          if (call) callRef.current.animate([{ transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 240, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" });
        }
      }
      if (raid && whoRef.current) {
        const who = `Raid: ${raid.helpers} reeling`;
        if (whoRef.current.textContent !== who) whoRef.current.textContent = who;
      }
    },
    // The catch: the fish leaps out of the track in a burst and the panel springs away; an escape shakes it and the fish darts off.
    onEnd: (success, sim) => {
      const panel = panelRef.current, marker = markerRef.current, track = trackRef.current;
      if (!panel || !marker || !track) return 0;
      if (success) {
        const box = track.getBoundingClientRect();
        delete panel.dataset.tension;
        sparkBurst(box.left + sim.fishPosition * box.width, box.top + box.height / 2, ["var(--ui-water-deep)", "var(--ui-water-line)", `var(--gui-rarity-${fish.rarity})`], 14);
        splash(box.left + sim.fishPosition * box.width, box.top + box.height / 2, 8);
        track.style.overflow = "visible";
        // The fish itself leaps (its rail stays where it is).
        (marker.firstElementChild as HTMLElement | null)?.animate([{ transform: "none" }, { transform: "translateY(-46px) scale(1.5) rotate(-12deg)", opacity: 1, offset: 0.6 }, { transform: "translateY(-70px) scale(1.2)", opacity: 0 }], { duration: 480, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)", fill: "forwards" });
        panel.animate([{ transform: "scale(1)" }, { transform: "scale(1.04)", offset: 0.3 }, { transform: "scale(1.02)", opacity: 1, offset: 0.7 }, { transform: "scale(0.94) translateY(8px)", opacity: 0 }], { duration: 520, easing: "ease-out", fill: "forwards" });
        return 500;
      }
      delete panel.dataset.tension;
      (marker.firstElementChild as HTMLElement | null)?.animate([{ opacity: 1 }, { transform: `translateX(${sim.fishPosition > 0.5 ? 60 : -60}px) rotate(20deg)`, opacity: 0 }], { duration: 320, easing: "ease-in", fill: "forwards" });
      panel.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)", offset: 0.2 }, { transform: "translateX(5px)", offset: 0.45 }, { transform: "translateY(10px)", opacity: 0 }], { duration: 400, easing: "ease-in", fill: "forwards" });
      return 380;
    },
  });

  return (
    <ReelPanel ref={panelRef} role="application" aria-label="Fishing reel" aria-describedby="member-reel-help" tabIndex={0} className={m.reel}>
      {boss && <div className={m.boss}>
        <div className={m.row}><span ref={whoRef} className={m.label}>{raidId ? "Raid" : "It fights back"}</span><span ref={callRef} className={reelStyles.call} aria-live="assertive" /></div>
        <LineGauge fillRef={staminaRef} value={1} marks={[1 / 3, 2 / 3]} label="Its stamina" />
      </div>}
      <ReelTags name={known ? fish.name : "???"} water={fish.zone ?? "river"} />
      <ReelTrack trackRef={trackRef} windowRef={windowRef} markerRef={markerRef} picture={iconFor(fish)} unknown={!known} windowWidth={barW} />
      <LineGauge gaugeRef={gaugeRef} fillRef={fillRef} value={start} marks={boss ? [] : QUARTERS} label={boss ? "Line" : `Catch progress: ${known ? fish.name : "an unknown fish"}`} />
      <p id="member-reel-help" hidden>{help}</p>
      <p ref={pausedRef} hidden className={m.help}>Paused · click the reel to resume</p>
    </ReelPanel>
  );
}

/** The catch card: the fish on its white stage, developing from a silhouette on a first catch; a rare one throws sparks. */
export function MemberCatchCard({ fish, sizeCm, recipe, together = null, isNew, newRecord, delay, onDone }: {
  fish: FishDef; sizeCm: number | null; recipe: string | null; together?: string | null; isNew: boolean; newRecord: boolean; delay: number; onDone: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rare = RARE.has(fish.rarity);
  const odds = isNew ? fishOdds(fish) : null;
  const suspense = isNew ? SUSPENSE[fish.rarity] : null;
  const { developed, next } = useCatchCard({ fish, isNew, delay, suspense: suspense?.build, onDone, onDevelop: () => {
    const stage = cardRef.current?.firstElementChild?.getBoundingClientRect();
    if (!stage) return;
    const x = stage.left + stage.width / 2, y = stage.top + stage.height / 2;
    if (rare) sparkBurst(x, y, [`var(--gui-rarity-${fish.rarity})`, "var(--ui-water-deep)", "var(--ui-card)"], fish.rarity === "rare" ? 10 : 18);
    if (suspense) confettiBurst(x, y, [`--gui-rarity-${fish.rarity}`, "--ui-water-deep", "--ui-water-line"], suspense.confetti);
  } });
  // The build's ticks: quicker and higher toward the reveal.
  useEffect(() => {
    if (!suspense || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ticks: number[] = [], n = Math.round(suspense.build / 220);
    for (let i = 0; i < n; i++) ticks.push(window.setTimeout(() => AudioManager.playSFX("click", { rate: 0.8 + (i / n) * 0.9, gain: 0.12 + (i / n) * 0.18 }), delay + suspense.build * (1 - (1 - i / n) ** 2)));
    return () => ticks.forEach(t => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const line = oneLinerFor(fish.key);
  // The card waits for the world's beat (the catch out of the water) before it lands.
  return <div style={{ ["--arrive-delay" as string]: `${delay}ms` }}>
    <CatchCard cardRef={cardRef} picture={iconFor(fish)} name={developed ? fish.name : "???"} developed={developed} build={suspense?.build} rarity={fish.rarity} rarityLabel={RARITY_META[fish.rarity].label} rare={rare}
      label={developed ? `You caught ${fish.label}` : "A catch"}
      tags={<>{isNew && <CatchTag>New</CatchTag>}{!isNew && newRecord && <CatchTag>New record</CatchTag>}{together && <CatchTag>Fished with {together}</CatchTag>}</>}
      facts={<>{sizeCm !== null && <span>{sizeCm} cm</span>}{odds !== null && <span className={reelStyles.quiet}>1 in {odds}</span>}</>}
      line={line ? `“${line}”` : null}
      note={recipe ? <p className={reelStyles.line}>You learned a recipe: {recipe}</p> : null}
      action={{ label: developed ? "Continue" : "Show me", onClick: next }} />
  </div>;
}
