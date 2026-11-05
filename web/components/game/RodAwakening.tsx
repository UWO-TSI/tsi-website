"use client";

/**
 * A rod's awakening as a cutscene (David 2026-11-04: "awakening needs animation and cut scene, like how when pokemon
 * evlolve, same concept with rod"; "when awakened, rarity change and the rod design will have improvements"): the kit's
 * Awakening with the rod's own model large and turning. It glows white, pulses between its old look and its new one,
 * bursts, and comes back in its new rung's ring with its improved design, its stats sliding from the old shape to the
 * new on its radar. A pitch for David's review on /dev/economy?view=awakening; the land's reward card ("Awakened!",
 * rodNews in lib/game/useFishingSession.ts) stays until he approves it.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Awakening, DarkButton, type AwakenPhase } from "@/components/gui/flat";
import { FittedModel } from "@/components/economy/ItemViewer";
import { RodRadar } from "@/components/economy/RodGear";
import TurnStage from "@/components/economy/TurnStage";
import { AudioManager } from "@/lib/game/audio";
import { awakened, type RodTier } from "@/lib/game/rods";
import { keyModel } from "@/lib/icons/itemModel";
import { RARITY_LABEL } from "@/lib/rarity";

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
      timer.current = window.setTimeout(() => setGrown(true), 700);
    }
  };
  const rung = RARITY_LABEL[after.rarity], newPassive = after.passive && after.passive !== before.passive ? after.passive : null;
  return <Awakening label={`Your ${rod.name} awakened`} testId="rod-awakening" rarity={after.rarity} rarityLabel={`${rung} rod`}
    lead={`Your ${rod.name} is glowing…`} eyebrow="Awakened!" name={rod.name} onPhase={onPhase} onClose={onClose} ready={ready}
    text={<>{after.rarity === before.rarity ? "Something in it woke up. Its stats are up." : `It fishes like a ${rung.toLowerCase()} rod now, and hooks up to ${RARITY_LABEL[after.hooks].toLowerCase()}.`}
      {newPassive && <><br /><b>{newPassive.name}</b> {newPassive.text}</>}</>}
    thing={next => looks && <TurnStage label={rod.name} cameraZ={3.3}>
      <Suspense fallback={null}>
        <group visible={!next}><FittedModel spec={looks[0]} /></group>
        <group visible={next}><FittedModel spec={looks[1]} /></group>
        <Loaded onLoad={loaded} />
      </Suspense>
    </TurnStage>}
    action={<DarkButton onClick={onClose}>Nice!</DarkButton>}>
    <RodRadar rod={grown ? after : before} from={grown ? before : undefined} size={220} />
  </Awakening>;
}

/** Mounts once the models beside it in its Suspense have loaded: the cutscene starts then. */
function Loaded({ onLoad }: { onLoad: () => void }) {
  useEffect(onLoad, [onLoad]);
  return null;
}
