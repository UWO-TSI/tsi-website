/**
 * The reel's loop (the fishing overlays' shared rules): one rAF steps the simulation (lib/game/fishingReel.ts) at its
 * 60 Hz on any display, holds and releases come from fishingInput's bindings, the world hears the fight (`live`: the
 * fish's pull, the line's tension, the reel cranking, a boss's stamina and move), a raid's stamina is the room's and
 * this reel reports its wear (lib/net/raid.ts), and the feel every reel shares plays here: the bar's soft knock, the
 * tension zoom, a boss's warnings, moves and phases on the camera. Each overlay draws its own look in `onFrame`
 * (refs and styles, no React renders) and may play an exit before the end is reported (`onEnd`: its length in ms).
 */
import { useEffect, useRef } from "react";
import { AudioManager } from "./audio";
import { punchZoom, setTensionZoom, shakeCamera } from "./cameraJuice";
import type { FishDef } from "./fishing";
import { advanceFishingReel, createFishingReel, type FishingReel } from "./fishingReel";
import { bindFishingInput, type FishingHeldInput } from "./fishingInput";
import { live } from "./fishingRig";
import { liveIslandWeather, reelWeather } from "./islandWeather";
import { weatherMods } from "./weatherPerks";
import { raidNow, sendRaid } from "@/lib/net/raid";
import { RAID, type RaidView } from "@/lib/net/protocol";

export type ReelEvents = ReturnType<typeof advanceFishingReel>;
export interface ReelFrame { sim: FishingReel; events: ReelEvents; now: number; holding: boolean; raid: RaidView | null }

export function useReelLoop({ fish, boss, raidId, tensionMul = 1, initialInput, focus, onFrame, onPause, onEnd, onDone }: {
  fish: FishDef;
  boss: "solo" | "shared" | null;
  raidId?: string;
  tensionMul?: number;
  initialInput?: FishingHeldInput;
  /** The reel's element: focused while it runs (a pointer press brings the focus back), the old focus restored after. */
  focus: React.RefObject<HTMLElement | null>;
  onFrame: (frame: ReelFrame) => void;
  onPause?: (paused: boolean) => void;
  /** The fight is over: play an exit and say how long it takes (ms), or 0. */
  onEnd?: (success: boolean, sim: FishingReel) => number;
  onDone: (success: boolean) => void;
}) {
  // The callbacks may be new each render; the loop reads the latest.
  const cb = useRef({ onFrame, onPause, onEnd, onDone });
  useEffect(() => { cb.current = { onFrame, onPause, onEnd, onDone }; });
  useEffect(() => {
    let raf = 0, exit = 0, last = performance.now(), reported = last, knocked = 0, paused = false, holding = false, done = false;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const el = focus.current;
    el?.focus({ preventScroll: true });
    const sim = createFishingReel(fish, boss);

    const finish = (success: boolean) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const ms = cb.current.onEnd?.(success, sim) ?? 0;
      if (ms > 0) exit = window.setTimeout(() => cb.current.onDone(success), ms);
      else cb.current.onDone(success);
    };

    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (paused) { raf = requestAnimationFrame(step); return; }
      const events = advanceFishingReel(sim, dt, holding, weatherMods(reelWeather(liveIslandWeather())).dartChanceMul, Math.random, tensionMul);
      // The fight in the world: the fish pulls the bobber across, the line tightens, the reel cranks while held.
      live.pull = sim.fishPosition * 2 - 1; live.tension = sim.tension; live.reeling = holding; live.reeled = sim.boss ? 1 - sim.boss.stamina : sim.progress;
      let raid: RaidView | null = null;
      if (sim.boss?.shared && raidId) {
        // The room's fish: its stamina is the server's, the landing and the escape too; this reel reports its wear.
        raid = raidNow();
        if (raid.id !== raidId) return finish(false);
        sim.boss.stamina = raid.stamina;
        if (raid.result) return finish(raid.result === "landed");
        if (now - reported >= RAID.hitEveryMs) {
          reported = now;
          if (sim.boss.dealt > 0) sendRaid({ op: "hit", id: raidId, dealt: Math.min(1, sim.boss.dealt) });
          sim.boss.dealt = 0;
        }
      }
      if (sim.result !== null) return finish(sim.result);
      if (events.bounced && now - knocked > 250) {
        knocked = now;
        AudioManager.playSFX("click", { rate: 0.75, gain: 0.4 }); // the bar knocking the track's end: a soft tick
      } else events.bounced = false;
      setTensionZoom(sim.tension);
      if (sim.boss) {
        live.boss = { stamina: sim.boss.stamina, move: sim.boss.move, stage: sim.boss.stage };
        // The warning lands as a jolt and a low chime; the move itself as a harder one; a new phase as the hardest.
        if (events.warned) { AudioManager.playSFX("confirm", { rate: 0.62, gain: 0.7 }); shakeCamera(0.03); }
        if (events.moved) shakeCamera(events.moved === "jump" ? 0.09 : 0.06);
        if (events.phased) { shakeCamera(0.1); punchZoom(2.5); }
      }
      cb.current.onFrame({ sim, events, now, holding, raid });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const releaseInput = bindFishingInput({
      initialInput,
      onHold: (h) => { holding = h; },
      onCancel: () => finish(false),
      onPointerFocus: () => el?.focus({ preventScroll: true }),
      onPause: (p) => {
        paused = p;
        last = performance.now();
        if (p) setTensionZoom(0);
        cb.current.onPause?.(p);
      },
    });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(exit);
      setTensionZoom(0);
      live.reeling = false;
      live.boss = null;
      releaseInput();
      if (document.activeElement === el && previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
    // One loop per mount: the parent remounts the reel for a new fight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
