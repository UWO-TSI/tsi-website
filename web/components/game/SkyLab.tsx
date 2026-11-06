"use client";

/**
 * Development only: the sky-ambient lane's shoot hooks on the island (lib/game/skyLab.ts, specs/sky-ambient.md), never
 * in production: the view's tilt and turn toward the sun or the moon, and `window.__sky` (set the switches, move the
 * clock, set the view).
 */
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { setSkyLab, skyLab, useSkyLab, type SkyLabState } from "@/lib/game/skyLab";
import { skyUniforms } from "@/lib/game/skyShader";
import { setWorldClockOffset } from "@/lib/game/worldClock";
import { parseClockOverride } from "@/lib/game/islandTime";
import { orbit } from "@/lib/game/orbitCamera";

if (typeof window !== "undefined") {
  Object.assign(window, { __sky: {
    set: (next: Partial<Omit<SkyLabState, "amb">> & { amb?: string[] }) => setSkyLab({ ...next, amb: next.amb ? new Set(next.amb) as SkyLabState["amb"] : skyLab().amb }),
    /** Move the world clock to HH:MM (Toronto) on a date, `plusMs` after it; the island re-reads it at once. */
    at: (hhmm: string, date: string, plusMs = 0) => {
      const d = parseClockOverride(new URLSearchParams({ at: hhmm, date }));
      if (!d) return false;
      setWorldClockOffset(d.getTime() + plusMs - Date.now());
      document.dispatchEvent(new Event("visibilitychange"));
      return true;
    },
    view: (v: { yaw?: number; pitch?: number; zoom?: number }) => {
      for (const o of [orbit.target, orbit.view]) Object.assign(o, v);
    },
  } });
}

/** The tilt and the turn, after the follow camera (priority -3). */
function SkyCamera({ tilt, face }: { tilt: number; face: SkyLabState["face"] }) {
  useFrame(({ camera }) => {
    if (face) {
      const d = face === "sun" ? skyUniforms.uSunDir.value : skyUniforms.uMoonDir.value;
      orbit.target.yaw = orbit.view.yaw = Math.atan2(d.x, d.z);
    }
    if (tilt) { camera.rotateX(THREE.MathUtils.degToRad(tilt)); camera.updateMatrixWorld(); }
  }, -2);
  return null;
}

export default function SkyLab() {
  const s = useSkyLab();
  return s.tilt !== 0 || s.face ? <SkyCamera tilt={s.tilt} face={s.face} /> : null;
}
