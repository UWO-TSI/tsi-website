"use client";

/**
 * The boat trip's veil and skip hint (specs/polish/arrival-wharf.md deliverable 3). The veil is the haze the boat sails
 * into (the hour's own haze colour) while the next island loads, never a black cut: it comes up as the boat heads out,
 * holds with a paper card while the island loads, and lifts as the boat comes in (each on the trip's own times; a skip
 * runs it quick). The hint is the HUD's cream pill: a key or a tap skips the rest.
 */
import { Keycap } from "@/components/gui";
import { TRIP, type TripPhase, type TripPlace } from "@/lib/game/boatTrip";
import s from "./TripVeil.module.css";

/** Where the trip is going, as the card says it. */
const heading = (to: TripPlace, firstLogin: boolean) => (to === "home" ? "Sailing home" : firstLogin ? "Sailing in to Tethos Island" : "Sailing to the village");

export default function TripVeil({ phase, to, firstLogin, quick, haze, touch, onSkip }: {
  phase: TripPhase | null; to: TripPlace; firstLogin: boolean;
  /** A press skipped it: the veil comes up quickly. */
  quick: boolean;
  /** The sky's haze for the hour (the scene's fog colour). */
  haze: string; touch: boolean; onSkip: () => void;
}) {
  const shown = phase === "veil" || phase === "load";
  const time = phase === "veil" ? (quick ? TRIP.quickVeil : TRIP.veil) : phase === "arrive" ? TRIP.lift : TRIP.reveal;
  const skippable = !!phase && phase !== "reveal" && phase !== "done";
  return <>
    <div className={s.veil} data-shown={shown} data-card={phase === "load"} aria-hidden={!shown} role={shown ? "status" : undefined}
      style={{ "--veil": haze, "--veil-time": `${time}s` } as React.CSSProperties}>
      <div className={s.card}>
        <svg className={s.boat} viewBox="0 0 96 54" aria-hidden="true">
          <g className={s.hull}>
            <path d="M10 31 Q48 32 86 27 L78 41 Q48 47 18 41 Z" fill="#fffbe7" stroke="#3a2e22" strokeWidth="3" strokeLinejoin="round" />
            <path d="M14 37 Q48 42 82 35" fill="none" stroke="#4f7fb0" strokeWidth="3" strokeLinecap="round" />
            <path d="M66 28 L66 9" stroke="#3a2e22" strokeWidth="3" strokeLinecap="round" />
            <path d="M66 10 L80 14 L66 18 Z" fill="#e8704a" stroke="#3a2e22" strokeWidth="2.5" strokeLinejoin="round" />
          </g>
          <path className={s.waves} d="M0 49 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="#6fb3d9" strokeWidth="3" strokeLinecap="round" />
        </svg>
        {heading(to, firstLogin)}
      </div>
    </div>
    {skippable && <button type="button" className={s.skip} data-touch={touch || undefined} onClick={onSkip}>
      {touch ? "Tap to skip" : <><Keycap aria-hidden="true">Space</Keycap>Skip</>}
    </button>}
  </>;
}
