/**
 * The cast meter's loop (the fishing overlays' shared rules; David 2026-07-23): held, the power ping-pongs 0 → 1 → 0;
 * let go inside the gold tip (CAST.maxZone) for a MAX CAST. The first sweep is a slow CAST.cycleMs and each one after is
 * 15% quicker (up to 2.2×), so greedy re-tries are harder; sunny days slow it (weatherPerks). The avatar's wind-up
 * deepens with it (`live.power`). Each overlay draws the power in `onFrame` (refs, no renders); on release it reports
 * the power once.
 */
import { useEffect, useRef } from "react";
import { CAST } from "./fishing";
import { live } from "./fishingRig";
import { liveIslandWeather, reelWeather } from "./islandWeather";
import { weatherMods } from "./weatherPerks";

export function useCastMeter({ releaseRequestedRef, onRelease, onFrame }: {
  releaseRequestedRef: React.RefObject<boolean>;
  onRelease: (power: number) => void;
  onFrame: (power: number, inTip: boolean) => void;
}) {
  const cb = useRef({ onRelease, onFrame });
  useEffect(() => { cb.current = { onRelease, onFrame }; });
  useEffect(() => {
    let raf = 0, last = performance.now(), vt = 0, speedMul = 1, lastCycle = 0, p = 0, released = false;
    const cycleMs = CAST.cycleMs * weatherMods(reelWeather(liveIslandWeather())).castCycleMul;
    const step = (now: number) => {
      if (releaseRequestedRef.current) {
        if (!released) { released = true; cb.current.onRelease(p); }
        return;
      }
      vt += Math.min(now - last, 100) * speedMul;
      last = now;
      const cycle = Math.floor(vt / cycleMs);
      if (cycle > lastCycle) { lastCycle = cycle; speedMul = Math.min(2.2, speedMul * 1.15); }
      // A triangle wave 0 → 1 → 0 over cycleMs of virtual time.
      const k = (vt % cycleMs) / cycleMs;
      p = k < 0.5 ? k * 2 : (1 - k) * 2;
      live.power = p;
      cb.current.onFrame(p, p >= CAST.maxZone);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // One loop per mount: the meter mounts for each wind-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
