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
import { AWAKEN_CARD_MS, AWAKEN_ROOM, Awakening, DarkButton, type AwakenPhase } from "@/components/gui/flat";
import { FittedModel } from "@/components/economy/ItemViewer";
import { RodRadar } from "@/components/economy/RodGear";
import TurnStage from "@/components/economy/TurnStage";
import { AudioManager } from "@/lib/game/audio";
import { awakened, type RodTier } from "@/lib/game/rods";
import { keyModel } from "@/lib/icons/itemModel";
import { RARITY_LABEL } from "@/lib/rarity";
import { glowOn, sparkRecipe } from "@/lib/game/fx/glowOn";
import { useGlowParticles, type GlowParticles } from "./GlowFx";
import { BEAT, auraAt, moveOf, type Move } from "./rodMotion";

/**
 * The improved design at each awakening (by rod, first awakening first), as a stand-in until the awakened models land
 * from the tool pipeline: the rod's parts re-tinted, by material.
 */
const FINISH: Record<string, readonly Record<string, string>[]> = {
  // A steel-blue blank, a deep-blue grip, silver fittings; then violet with gold fittings; then gold with ivory and brass.
  rod_training: [{ Yellow: "#9fb8dd", Blue: "#1f4fa8", Red: "#e8edf3", Cream: "#ffffff" }, { Yellow: "#7a4fd8", Blue: "#2d2448", Red: "#f2c14e", Cream: "#f4edff" },
    { Yellow: "#f2c14e", Blue: "#fff4d6", Red: "#b8862a", Cream: "#fffaf0" }],
  rod_titanium: [{ Slate: "#cdd6e0", Lilac: "#b98cff" }],
  rod_tidewarden: [{ Teal: "#22b8aa" }, { Teal: "#1ad6c4", Gold: "#ffd75e" }],
  rod_tempest: [{ Ice: "#b6e2ff" }, { Ice: "#8fd3ff", Pale: "#eef7ff" }],
};

/** `rod` (as bought) reaching its `stage`th awakening (1 is its first); `onClose` when it's put away. */
export default function RodAwakening({ rod, stage, onClose }: { rod: RodTier; stage: number; onClose: () => void }) {
  const before = awakened(rod, rod.awakenings[stage - 2]?.at ?? 0), after = awakened(rod, rod.awakenings[stage - 1].at);
  const looks = useMemo(() => {
    const spec = keyModel(rod.key), finish = (n: number) => FINISH[rod.key]?.[n - 1];
    return spec && ([stage - 1, stage] as const).map(n => (finish(n) ? { ...spec, tints: { ...spec.tints, ...finish(n) } } : spec));
  }, [rod.key, stage]);
  const [grown, setGrown] = useState(false), [ready, setReady] = useState(false);
  const loaded = useCallback(() => setReady(true), []);
  const beats = useRef(0), timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onPhase = (p: AwakenPhase | "beat") => {
    if (p === "beat") AudioManager.playSFX("blip3", { rate: 0.8 + 0.05 * beats.current++, gain: 0.3 });
    if (p === "burst") AudioManager.playSFX("bite-legendary", { gain: 0.7 });
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
    thing={(next, phase) => looks && <TurnStage label={rod.name} cameraZ={3.3 * AWAKEN_ROOM}>
      <Suspense fallback={null}>
        <Motion move={moveOf(rod.key)} phase={phase} from={before.rarity} to={after.rarity}>
          <group visible={!next}><FittedModel spec={looks[0]} aura={auraAt(stage - 1) + BEAT[phase].aura} /></group>
          <group visible={next}><FittedModel spec={looks[1]} aura={auraAt(stage) + BEAT[phase].aura} /></group>
        </Motion>
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
    return { e: 0, glow: 0, twirl: 0, colour: of(from), from: of(from), to: of(to), lit: new Map<THREE.MeshStandardMaterial, THREE.Color>(), burst: false };
  });
  const glow = useGlowParticles();
  useFrame(({ clock }, dt) => { if (group.current) pose(group.current, light.current, live, glow, move, phase, clock.elapsedTime, Math.min(dt, 0.1)); });
  return <group ref={group}>{children}<pointLight ref={light} intensity={0} distance={0.9} decay={1} /></group>;
}

const LATER: AwakenPhase[] = ["burst", "show", "reveal"];
/** Module scope (the react compiler forbids writing through hook values): one frame of Motion. */
type Live = { e: number; glow: number; twirl: number; colour: THREE.Color; from: THREE.Color; to: THREE.Color; lit: Map<THREE.MeshStandardMaterial, THREE.Color>; burst: boolean };
const at = new THREE.Vector3();
function pose(g: THREE.Group, light: THREE.PointLight | null, live: Live, pool: GlowParticles, move: Move, phase: AwakenPhase, t: number, dt: number) {
  const ease = 1 - Math.exp(-dt * 3), beat = BEAT[phase];
  live.e += (beat.energy - live.e) * ease;
  live.glow += (beat.glow - live.glow) * (phase === "burst" ? 1 - Math.exp(-dt * 10) : ease);
  live.colour.lerp(LATER.includes(phase) ? live.to : live.from, 1 - Math.exp(-dt * 6));
  const p = move(t, live.e);
  live.twirl += p.twirl * dt;
  g.position.set(p.x, p.y, 0);
  g.rotation.set(p.tip, live.twirl, p.roll);
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
