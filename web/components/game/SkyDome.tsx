"use client";

/**
 * SkyDome — the tuned dome shader (lib/game/skyShader.ts), in the game.
 *
 * The dome and its eight cloud variants were built and calibrated on the
 * tuning bench (/lab/tune) but the world kept the flat 2D gradient until the
 * cinematic pass (David, 2026-10-10: "the sky needs a skybox"). This mounts
 * the SAME material the bench tunes: the bench's shipped coverage, band and
 * wind numbers stay the single source of truth (lib/game/tuning.ts), while
 * the colours come from the live phase light and the clouds from the weather.
 *
 * The dome is pinned to the camera every frame, so it never clips no matter
 * how far the island stretches; radius 110 sits inside every canvas's far
 * plane (game 120, title 140). Stars fade in by how dark the zenith actually
 * is, which lands them in night and the deep end of dusk with no extra phase
 * plumbing. At night the key light is the moon, so the lit face of a cloud
 * leans back toward the sky colour instead of staying daylight white.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { skyMaterial, advanceSky, type SkyLayerWeights } from "@/lib/game/skyShader";
import { useTuning, type Tuning } from "@/lib/game/tuning";
import { worldTime } from "@/lib/game/worldClock";
import type { IslandLight } from "@/lib/game/islandLighting";
import type { IslandWeather } from "@/lib/game/islandWeather";

const RADIUS = 110;
const WHITE = new THREE.Color(0xffffff);

/** Cloud coverage per weather, as a remix of the bench's shipped sliders. */
function weightsFor(weather: IslandWeather, k: Tuning["sky"]): SkyLayerWeights {
  switch (weather) {
    case "wind": return { cumulus: k.puffy * 0.8, altocumulus: Math.max(k.chunky, 0.35), cirrus: 0, cirrostratus: 0.12, nimbus: 0 };
    case "fog": return { cumulus: 0.15, altocumulus: 0.2, cirrus: 0, cirrostratus: 0.75, nimbus: 0 };
    case "rain": return { cumulus: 0.15, altocumulus: 0.25, cirrus: 0, cirrostratus: 0.85, nimbus: 0.8 };
    case "snow": return { cumulus: 0.2, altocumulus: 0.3, cirrus: 0, cirrostratus: 0.8, nimbus: 0.45 };
    default: return { cumulus: k.puffy, altocumulus: k.chunky, cirrus: 0, cirrostratus: k.overcast, nimbus: k.storm };
  }
}

export default function SkyDome({ light, weather }: { light: IslandLight; weather: IslandWeather }) {
  const t = useTuning();
  const mat = useMemo(() => skyMaterial("luxury"), []);
  const mesh = useRef<THREE.Mesh>(null);
  const col = useMemo(() => ({
    zenith: new THREE.Color(), horizon: new THREE.Color(), lit: new THREE.Color(), dark: new THREE.Color(),
  }), []);
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
    const k = t.sky;
    col.zenith.set(light.skyTop ?? light.sky);
    col.horizon.set(light.sky);
    // Stars by actual darkness: day zenith ~0.4 luminance, night ~0.02.
    const z = col.zenith;
    const night = THREE.MathUtils.clamp((0.14 - (0.2126 * z.r + 0.7152 * z.g + 0.0722 * z.b)) / 0.1, 0, 1);
    col.lit.set(light.sun).lerp(WHITE, 0.55).lerp(col.zenith, night * 0.75);
    col.dark.set(light.sky).multiplyScalar(0.72).lerp(col.zenith, night * 0.5);
    advanceSky(
      worldTime(),
      weightsFor(weather, k),
      { nimbusHeight: k.stormReach, nimbusVariation: 0, borderHeight: k.bandHeight, borderEffect: k.bandEffect, borderVariation: 0 },
      col,
      night,
      1,
      k.wind * (weather === "wind" ? 2.2 : 1),
      k.cloudScale,
    );
  });
  return (
    <mesh ref={mesh} material={mat} scale={[RADIUS, RADIUS, RADIUS]} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[1, 48, 32]} />
    </mesh>
  );
}
