"use client";

/**
 * A rod's awakening as a cutscene (David 2026-11-04: "awakening needs animation and cut scene, like how when pokemon
 * evlolve, same concept with rod"; "when awakened, rarity change and the rod design will have improvements"): the kit's
 * Awakening with the rod's own model large and turning. A glow gathers on the rod itself in the colour of the rung it
 * had (never white, David 2026-11-05), it moves its own way (rodMotion: the Tidewarden rides a swell, the Tempest whips
 * in the wind, the Titanium's steel catches a sheen, the Training rod twirls; its effect grows stronger, the
 * Tidewarden's water wrapping further down its shaft), pulses between its old look and its new one, flares into its new rung's colour, shows
 * its improved design alone, and only then steps aside for the card, where its stats slide from the old shape to the
 * new on its radar once the card has landed ("the eye cant look at two things at once"). A pitch for David's review on /dev/economy?view=awakening; the land's reward card ("Awakened!",
 * rodNews in lib/game/useFishingSession.ts) stays until he approves it.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AWAKEN_CARD_MS, AWAKEN_MS, AWAKEN_ROOM, Awakening, DarkButton, type AwakenPhase } from "@/components/gui/flat";
import { FittedModel } from "@/components/economy/ItemViewer";
import { RodRadar } from "@/components/economy/RodGear";
import TurnStage from "@/components/economy/TurnStage";
import { AudioManager } from "@/lib/game/audio";
import { awakened, type RodTier } from "@/lib/game/rods";
import { rodSpec } from "@/lib/icons/itemModel";
import { RARITY_LABEL } from "@/lib/rarity";
import { glowOn, sparkRecipe } from "@/lib/game/fx/glowOn";
import { useGlowParticles, type GlowParticles } from "./GlowFx";
import type { FxKind } from "@/lib/game/fx/library";
import HolderFx from "./fx/HolderFx";
import { AWAKEN_FX, BEAT, auraAt, gatherAt, moveOf, type Move } from "./rodMotion";

const GATHER: FxKind[] = ["gather"], NONE: FxKind[] = [];

/**
 * The improved design at each awakening (by rod, first awakening first) for a rod whose awakening has no model of its
 * own yet (rods.ts Awakening `model`): the rod's parts re-tinted, by material, a stand-in until the model lands.
 */
const FINISH: Record<string, readonly Record<string, string>[]> = {
  // A steel-blue blank, a deep-blue grip, silver fittings; then violet with gold fittings; then gold with ivory and brass.
  rod_training: [{ Yellow: "#9fb8dd", Blue: "#1f4fa8", Red: "#e8edf3", Cream: "#ffffff" }, { Yellow: "#7a4fd8", Blue: "#2d2448", Red: "#f2c14e", Cream: "#f4edff" },
    { Yellow: "#f2c14e", Blue: "#fff4d6", Red: "#b8862a", Cream: "#fffaf0" }],
};

/** `rod` (as bought) reaching its `stage`th awakening (1 is its first); `onClose` when it's put away. */
export default function RodAwakening({ rod, stage, onClose }: { rod: RodTier; stage: number; onClose: () => void }) {
  const before = awakened(rod, rod.awakenings[stage - 2]?.at ?? 0), after = awakened(rod, rod.awakenings[stage - 1].at);
  // Before and after: each the rod as it was then (its awakened model, rods.ts awakenedLook, or a FINISH stand-in).
  const looks = useMemo(() => ([stage - 1, stage] as const).map(n => {
    const spec = rodSpec(awakened(rod, rod.awakenings[n - 1]?.at ?? 0)), finish = FINISH[rod.key]?.[n - 1];
    return spec && finish ? { ...spec, tints: { ...spec.tints, ...finish } } : spec;
  }), [rod, stage]);
  const [grown, setGrown] = useState(false), [ready, setReady] = useState(false), [struck, setStruck] = useState(0), [beat, setBeat] = useState(0);
  const loaded = useCallback(() => setReady(true), []);
  const beats = useRef(0), timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const outside = AWAKEN_FX[rod.key];
  // The holders of the library's types: the old form (light gathering in), the new form (the strike, what it wears).
  const [[oldForm, newForm]] = useState(() => [new THREE.Group(), new THREE.Group()] as const);
  const [colours] = useState(() => { const css = getComputedStyle(document.documentElement), of = (r: string) => css.getPropertyValue(`--ui-rarity-${r}`).trim() || "#7FD8FF";
    return { from: of(before.rarity), to: of(after.rarity) }; });
  // The suspense and the hit: the riser under the glow and the pulse (cut dead at the hush), a heartbeat on each beat,
  // the strike's sound (a wave's crash lands on the burst, so it starts in the hush), the hit, the thunder.
  const onPhase = (p: AwakenPhase | "beat") => {
    if (p === "glow") AudioManager.playSFX("aw-riser", { gain: 0.6 });
    if (p === "beat") { AudioManager.playSFX("aw-heart", { rate: 0.85 + 0.05 * beats.current++, gain: 0.55 }); setBeat(beats.current); }
    if (p === "hush") { setStruck(n => n + 1); if (outside?.soundAt === "hush") AudioManager.playSFX(outside.sound, { gain: 0.8 }); }
    if (p === "burst") { AudioManager.playSFX("aw-impact", { gain: 0.9 }); if (outside?.soundAt === "burst") AudioManager.playSFX(outside.sound, { gain: 0.85 }); }
    if (p === "reveal") {
      AudioManager.playSFX("confirm", { rate: 0.92, gain: 0.7 });
      timer.current = window.setTimeout(() => setGrown(true), AWAKEN_CARD_MS);
    }
  };
  const rung = RARITY_LABEL[after.rarity], newPassive = after.passive && after.passive !== before.passive ? after.passive : null;
  return <Awakening label={`Your ${rod.name} awakened`} testId="rod-awakening" from={before.rarity} rarity={after.rarity} rarityLabel={`${rung} rod`}
    lead={`Your ${rod.name} is glowing…`} eyebrow="Awakened!" name={rod.name} onPhase={onPhase} onClose={onClose} ready={ready}
    text={<>{after.rarity === before.rarity ? "Something in it woke up. Its stats are up." : `It fishes like a ${rung.toLowerCase()} rod now, and hooks up to ${RARITY_LABEL[after.hooks].toLowerCase()}.`}
      {newPassive && <><br /><b>{newPassive.name}</b> {newPassive.text}</>}</>}
    thing={(next, phase) => looks[0] && looks[1] && <TurnStage label={rod.name} cameraZ={3.3 * AWAKEN_ROOM}>
      <Suspense fallback={null}>
        <Motion move={moveOf(rod.key)} phase={phase} from={before.rarity} to={after.rarity}>
          <primitive object={oldForm} visible={!next}><FittedModel spec={looks[0]} aura={auraAt(stage - 1) + BEAT[phase].aura} /></primitive>
          <primitive object={newForm} visible={next}><FittedModel spec={looks[1]} aura={outside?.strength?.(phase, beat) ?? auraAt(stage) + BEAT[phase].aura} /></primitive>
        </Motion>
        <HolderFx holder={oldForm} kinds={GATHER} strength={gatherAt(phase, beat)} colour={colours.from} />
        {(outside?.strike || outside?.wears) && <HolderFx holder={newForm} kinds={outside.wears ?? NONE} strength={auraAt(stage) + BEAT[phase].aura} colour={colours.to}
          strike={outside.strike && { kind: outside.strike, hit: AWAKEN_MS.hush / 1000, key: struck }} />}
        <Loaded onLoad={loaded} />
      </Suspense>
    </TurnStage>}
    action={<DarkButton onClick={onClose}>Nice!</DarkButton>}>
    <RodRadar rod={grown ? after : before} from={grown ? before : undefined} size={220} />
  </Awakening>;
}

/**
 * The rod's own motion and the glow on it (the effects library's motion, glow and sparks: lib/game/fx/library.ts), eased to each beat (rodMotion BEAT): its pose on top of the stage's turn, its
 * materials lit from within (glowOn) in the glow's colour (the rung it had, `from`, until the burst, then the rung it reaches, `to`;
 * the theme's colours), and where its motion has a
 * sheen, a band of light running up it (the light stays in the scene, dark when unused, so nothing recompiles). At the
 * burst, sparks fly off it in the new colour.
 */
function Motion({ move, phase, from, to, children }: { move: Move; phase: AwakenPhase; from: string; to: string; children: ReactNode }) {
  const group = useRef<THREE.Group>(null), light = useRef<THREE.PointLight>(null);
  const [live] = useState(() => {
    const css = getComputedStyle(document.documentElement), of = (r: string) => new THREE.Color(css.getPropertyValue(`--ui-rarity-${r}`).trim() || "#000000");
    return { e: 0, glow: 0, twirl: 0, shake: 0, colour: of(from), from: of(from), to: of(to), lit: new Map<THREE.MeshStandardMaterial, THREE.Color>(), burst: false };
  });
  const glow = useGlowParticles();
  useFrame(({ clock }, dt) => { if (group.current) pose(group.current, light.current, live, glow, move, phase, clock.elapsedTime, Math.min(dt, 0.1)); });
  return <group ref={group}>{children}<pointLight ref={light} intensity={0} distance={0.9} decay={1} /></group>;
}

const LATER: AwakenPhase[] = ["burst", "show", "reveal"];
/** Module scope (the react compiler forbids writing through hook values): one frame of Motion. */
type Live = { e: number; glow: number; twirl: number; shake: number; colour: THREE.Color; from: THREE.Color; to: THREE.Color; lit: Map<THREE.MeshStandardMaterial, THREE.Color>; burst: boolean };
const at = new THREE.Vector3();
function pose(g: THREE.Group, light: THREE.PointLight | null, live: Live, pool: GlowParticles, move: Move, phase: AwakenPhase, t: number, dt: number) {
  const ease = 1 - Math.exp(-dt * 3), beat = BEAT[phase];
  live.e += (beat.energy - live.e) * ease;
  live.glow += (beat.glow - live.glow) * (phase === "burst" ? 1 - Math.exp(-dt * 10) : ease);
  live.colour.lerp(LATER.includes(phase) ? live.to : live.from, 1 - Math.exp(-dt * 6));
  live.shake += (beat.shake - live.shake) * ease;
  const p = move(t, live.e), j = live.shake;
  live.twirl += p.twirl * dt;
  // The tremble on top (the suspense): fast and uneven, harder as it builds.
  g.position.set(p.x + j * 0.5 * Math.sin(t * 47.3), p.y + j * 0.3 * Math.sin(t * 39.1 + 1), 0);
  g.rotation.set(p.tip + j * Math.sin(t * 53.7 + 2), live.twirl, p.roll + j * Math.sin(t * 61.3));
  // Under its full colour, so the rod keeps its own colours inside the glow instead of washing out pale.
  glowOn(g, live.colour, 0.7 * (live.glow + p.flash), live.lit);
  if (phase === "burst" && !live.burst) {
    live.burst = true;
    g.getWorldPosition(at);
    pool.pool.burst(sparkRecipe(1.4), at.x, at.y, at.z, at.y - 5, 0, 0, 1, live.to.getHex(), 7);
  }
  if (light) {
    light.position.set(0, -1 + 2 * (p.sheen ?? 0), 0.45);
    light.intensity = p.sheen === null ? 0 : 6 * live.e;
  }
}

/** Mounts once the models beside it in its Suspense have loaded: the cutscene starts then. */
function Loaded({ onLoad }: { onLoad: () => void }) {
  useEffect(onLoad, [onLoad]);
  return null;
}
