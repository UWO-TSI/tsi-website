"use client";

import { useEffect, type RefObject } from "react";
import { CLIP_BY_NAME } from "@/lib/game/character/look";
import { getPeacefulTarget } from "@/lib/game/peacefulNear";
import type { CharacterMotion, ClipName } from "@/lib/game/character/clips";

/**
 * World interactions → player clips (row 111), shared by the outdoor and
 * interior controllers. Peaceful tools stay invisible (row 136).
 *   tsi:fish-cast {x, z} → Fish, then FishHold until tsi:fish-end
 *   tsi:peaceful-act → Net at a bug, Dig at a shovel find (buried clam, rock), otherwise Forage;
 *   tsi:flower-pick → Forage; tsi:critter-catch → Net
 *   tsi:emote {clip} → any catalogue clip as a one-shot (emote menu, study, admin tools)
 */
const ACT_CLIP = { bug: "Net", dig: "Dig", forage: "Forage" } as const;
export function useWorldClips(motion: RefObject<CharacterMotion>, face: (x: number, z: number) => void) {
  useEffect(() => {
    const set = (patch: Partial<CharacterMotion>) => Object.assign(motion.current, patch);
    const on: Record<string, (e: Event) => void> = {
      "tsi:fish-cast": e => { const d = (e as CustomEvent<{ x: number; z: number }>).detail; if (d) face(d.x, d.z); set({ play: "Fish", pose: "FishHold" }); },
      "tsi:fish-end": () => { if (motion.current.pose === "FishHold") set({ pose: null }); },
      "tsi:peaceful-act": () => {
        const t = getPeacefulTarget();
        if (t?.at) face(t.at[0], t.at[1]);
        set({ play: ACT_CLIP[t?.kind ?? "forage"] });
      },
      "tsi:flower-pick": () => set({ play: "Forage" }),
      "tsi:critter-catch": () => set({ play: "Net" }),
      "tsi:emote": e => { const clip = (e as CustomEvent<{ clip: ClipName }>).detail?.clip; if (clip && CLIP_BY_NAME.has(clip)) set({ play: clip }); },
    };
    for (const [name, fn] of Object.entries(on)) window.addEventListener(name, fn);
    return () => { for (const [name, fn] of Object.entries(on)) window.removeEventListener(name, fn); };
  }, [motion, face]);
}
