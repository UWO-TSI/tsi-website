"use client";

/**
 * SkyDome: the sky (lib/game/skyShader.ts) over the island and the title, fed each frame from the real sky over
 * London, Ontario (lib/game/atmosphere.ts): the sun where it is (below the horizon too), the moon where it is and as
 * full as it is, the stars turned to the hour, and the clouds the weather brings, drifting with the wind.
 *
 * The dome is pinned to the camera and drawn at the far plane, so it never clips however far the island stretches,
 * and only the pixels where sky shows pay for it.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CLOUD_STYLE, DRIFT_WRAP, cloudTexture, cloudData, skyDome, skyUniforms, type CloudStyle } from "@/lib/game/skyShader";
import { cloudField, skyBend, type CloudView } from "@/lib/game/clouds";
import { SKY_GRADE, compassDir, gradeSky, moonPosition, skyExposure, skyRadiance, starFrame, transmittance, type Vec3 } from "@/lib/game/atmosphere";
import { NIGHT_SKY } from "@/lib/game/lookPreset";
import { skyInstant, solarPosition } from "@/lib/game/sunPath";
import { LONDON_ON, type IslandWeather } from "@/lib/game/islandWeather";
import { WIND_DIR } from "@/lib/game/worldFx";
import { ACTIVE_WORLD_BEND, ACTIVE_WORLD_BEND_SIDE } from "@/lib/game/curvedWorld";
import { worldNow, worldTime } from "@/lib/game/worldClock";
import { useSkyLab } from "@/lib/game/skyLab";
import { WIND } from "@/lib/game/wind";
import SkyClouds from "./SkyClouds";

/** Inside every canvas's far plane (game 120, title 140); the vertex shader puts it at the far plane anyway. */
const RADIUS = 110;

/** Per weather: the share of the sky's squares with a cumulus, their size (km), grey, cirrus, haze at the skyline, drift (km a second). */
const WEATHER_SKY: Record<IslandWeather, readonly [number, number, number, number, number, number]> = {
  clear: [0.55, 0.6, 0, 0.55, 0, 0.05],
  wind: [0.5, 0.5, 0.04, 0.3, 0, 0.16],
  fog: [0.35, 0.55, 0.35, 0, 1, 0.03],
  rain: [0.9, 0.65, 0.72, 0, 0.45, 0.09],
  snow: [0.85, 0.65, 0.55, 0, 0.6, 0.05],
};
/** How fast the sky follows a change of weather (per second, an ease). */
const WEATHER_RATE = 0.4;
/** The moon's light on the air for a full moon (a deep blue night through the night's exposure). */
const MOON_SKY = 0.0035;
/** How often the slower sums (the exposure, the light on the clouds) are redone, ms: the sun moves 0.004° a second. */
const SLOW_MS = 500;

/** 0 at `from`, 1 at `to` (either way round), smooth between. */
const ease = (from: number, to: number, x: number) => { const t = THREE.MathUtils.clamp((x - from) / (to - from), 0, 1); return t * t * (3 - 2 * t); };

const state = { slowAt: -Infinity, weather: null as number[] | null, speed: 0, moonIllum: 0 };
const sun: Vec3 = [0, 1, 0], moon: Vec3 = [0, 1, 0], tmp: Vec3 = [0, 0, 0], tmp2: Vec3 = [0, 0, 0];
const rot = new THREE.Matrix3(), horizon = new THREE.Color(), raised: Vec3 = [0, 0, 0], drawn: Vec3 = [0, 0, 0];
const fwd = new THREE.Vector3(), sea = new THREE.Vector3(), view: CloudView = { x: 0, y: 0, z: 1, cos: -1 };

/**
 * How far below the true horizon the sea's far edge shows (radians): the far plane's sea straight ahead, bent as the
 * curved world bends it (curvedWorld, view space). The sky's skyline is drawn there (clouds.ts skyBend).
 */
function seaDip(camera: THREE.PerspectiveCamera): number {
  camera.getWorldDirection(fwd);
  const h = Math.hypot(fwd.x, fwd.z) || 1, far = camera.far * 0.95;
  sea.set(camera.position.x + (fwd.x / h) * far, 0, camera.position.z + (fwd.z / h) * far).applyMatrix4(camera.matrixWorldInverse);
  sea.y -= sea.z * sea.z * ACTIVE_WORLD_BEND + sea.x * sea.x * ACTIVE_WORLD_BEND_SIDE;
  sea.applyMatrix4(camera.matrixWorld).sub(camera.position);
  return Math.min(0.6, Math.max(0, -Math.atan2(sea.y, Math.hypot(sea.x, sea.z))));
}

/** What the dome draws toward `dir` before clouds (the shader's sum, on the CPU): for the light the clouds take from the sky. */
function skyAt(dir: Vec3, exposure: number, moonE: number, night: number, out: THREE.Color): THREE.Color {
  skyRadiance(dir, sun, tmp);
  if (moonE > 0) { skyRadiance(dir, moon, tmp2); for (let c = 0; c < 3; c++) tmp[c] += moonE * tmp2[c]; }
  for (let c = 0; c < 3; c++) tmp[c] *= exposure;
  gradeSky(tmp, tmp);
  const t = NIGHT_SKY.top, h = NIGHT_SKY.horizon, m = Math.sqrt(Math.max(dir[1], 0));
  return out.setRGB(tmp[0] + (h.r + (t.r - h.r) * m) * night, tmp[1] + (h.g + (t.g - h.g) * m) * night, tmp[2] + (h.b + (t.b - h.b) * m) * night, THREE.LinearSRGBColorSpace);
}

/** The light the dome's clouds and discs take from the sun and the moon, redone every SLOW_MS. */
function slowFrame(moonIllum: number, moonUp: number) {
  const u = skyUniforms, g = SKY_GRADE.balance;
  const exposure = skyExposure(sun), adapt = exposure / SKY_GRADE.exposure;
  u.uExposure.value = exposure;
  const moonE = MOON_SKY * Math.pow(moonIllum, 1.5) * moonUp;
  u.uMoonE.value = moonE;
  const night = u.uNight.value;
  transmittance(sun, tmp);
  // Toward orange rather than a dim red at the skyline (the eye adapts to the low sun's light as to its sky).
  u.uSunDisc.value.setRGB(g[0] * tmp[0] ** 0.6 * 2.2, g[1] * tmp[1] ** 0.6 * 2.2, g[2] * tmp[2] ** 0.6 * 2.2, THREE.LinearSRGBColorSpace);
  // On the clouds the sun is white at noon (its own warmth balanced out), gold to rose as it sinks; 1.5 km up they
  // still see it for a degree and a quarter after it has set (and before it rises).
  const k = Math.min(Math.sqrt(adapt), 3);
  raised[0] = sun[0]; raised[1] = sun[1] + 0.022; raised[2] = sun[2];
  transmittance(raised, tmp);
  u.uSunLight.value.setRGB(tmp[0] ** 0.75 * k, 1.03 * tmp[1] ** 0.75 * k, 1.1 * tmp[2] ** 0.75 * k, THREE.LinearSRGBColorSpace);
  // The cirrus, 7 km up, about three degrees.
  raised[1] = sun[1] + 0.05;
  transmittance(raised, tmp);
  u.uCirrusLight.value.setRGB(tmp[0] ** 0.6 * k, 1.03 * tmp[1] ** 0.6 * k, 1.1 * tmp[2] ** 0.6 * k, THREE.LinearSRGBColorSpace);
  u.uMoonLight.value.setRGB(0.16, 0.18, 0.24).multiplyScalar(moonIllum * moonUp * night);
  // The sky's light on them: from above a share of the zenith's blue over a grey floor, from below the skyline's.
  // The sky's light on them: from above the zenith's colour and a grey share of its brightness, from below the
  // skyline's (the sea's bounce), so they keep their shape as the light goes.
  const top = skyAt([0, 1, 0], exposure, moonE, night, u.uAmbTop.value), l = 0.2126 * top.r + 0.7152 * top.g + 0.0722 * top.b;
  u.uSkyTop.value.copy(top);
  // By night they are darker than the sky behind them, so they read as cloud, not glass.
  const dim = 1 - 0.4 * night;
  top.multiplyScalar(0.35).addScalar(0.4 * l).multiplyScalar(dim);
  const hz = u.uAmbBottom.value.setRGB(0, 0, 0);
  for (let i = 0; i < 4; i++) hz.add(skyAt(compassDir(5, i * 90), exposure, moonE, night, horizon).multiplyScalar(0.25));
  u.uSkyHorizon.value.copy(hz);
  hz.multiplyScalar(0.6 * dim);
}

/** Module scope (the react compiler forbids writing through hook values): the sky for this frame. */
function skyFrame(camera: THREE.PerspectiveCamera, scene: THREE.Scene, weather: IslandWeather, style: CloudStyle, dt: number) {
  const u = skyUniforms, now = skyInstant() ?? worldNow();
  u.uTime.value = worldTime();
  const s = solarPosition(new Date(now));
  sun.splice(0, 3, ...compassDir(s.elevation, s.azimuth));
  u.uSunDir.value.set(...sun);
  const m = moonPosition(now, LONDON_ON);
  moon.splice(0, 3, ...compassDir(m.elevation, m.azimuth));
  u.uMoonDir.value.set(...moon);
  rot.fromArray(starFrame(now, LONDON_ON));
  u.uStarRot.value.copy(rot);
  // Night comes on as the sun goes from 2° to 12° under; the stars from 6° to 15°, fewer under a bright moon.
  const moonUp = ease(-2, 8, m.elevation);
  u.uNight.value = ease(-2, -12, s.elevation);
  u.uStarVis.value = ease(-6, -15, s.elevation) * (1 - 0.55 * m.illumination * moonUp);

  // The weather: eased, never switched.
  const target = WEATHER_SKY[weather];
  const w = (state.weather ??= [...target]), k = 1 - Math.exp(-WEATHER_RATE * dt);
  for (let i = 0; i < w.length; i++) w[i] += (target[i] - w[i]) * k;
  // Fair-weather cumulus melt away after sunset (an overcast stays).
  u.uCloud.value.set(w[0] * (1 - 0.6 * u.uNight.value * (1 - w[2])), w[1], w[2], w[3]);
  u.uHaze.value = w[4];
  // Carried by the one wind (lib/game/wind.ts), faster as it swells.
  const speed = w[5] * WIND.swell, dx = WIND_DIR.x, dz = WIND_DIR.z;
  // Every client starts where the world clock puts the clouds, then carries them on at the weather's speed.
  if (state.speed === 0) u.uDrift.value.set(dx, dz).multiplyScalar((w[5] * u.uTime.value) % DRIFT_WRAP);
  state.speed = speed;
  u.uDrift.value.x = (u.uDrift.value.x + dx * speed * dt) % DRIFT_WRAP;
  u.uDrift.value.y = (u.uDrift.value.y + dz * speed * dt) % DRIFT_WRAP;

  // The sky's skyline drawn down to the sea's far edge; the sun and the moon where the dome draws them.
  camera.updateMatrixWorld();
  const dip = (u.uDip.value = seaDip(camera));
  u.uSunDraw.value.set(...skyBend(sun, dip, drawn));
  u.uMoonDraw.value.set(...skyBend(moon, dip, drawn));
  // The clouds in view, nearest first (all three styles read them; round 2's traced ones walk their own).
  if (style !== "traced") {
    const half = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * Math.hypot(1, camera.aspect));
    view.x = fwd.x; view.y = fwd.y; view.z = fwd.z; view.cos = Math.cos(Math.min(Math.PI, half + dip + 0.05));
    const d = u.uDrift.value;
    u.uCloudN.value = cloudField(u.uCloud.value.x, u.uCloud.value.y, d, dip, cloudData, view);
    cloudTexture.needsUpdate = true;
  }
  const e = camera.matrixWorld.elements;
  u.uCamRight.value.set(e[0], e[1], e[2]).normalize();
  u.uCamUp.value.set(e[4], e[5], e[6]).normalize();
  if (scene.fog) u.uFog.value.copy((scene.fog as THREE.Fog).color);

  const t = performance.now();
  if (t - state.slowAt > SLOW_MS || Math.abs(m.illumination - state.moonIllum) > 0.01) {
    state.slowAt = t; state.moonIllum = m.illumination;
    slowFrame(m.illumination, moonUp);
  }
}

export default function SkyDome({ weather }: { weather: IslandWeather }) {
  const lab = useSkyLab(), style = lab.clouds ?? CLOUD_STYLE;
  useEffect(() => { skyUniforms.uStarPx.value = lab.skypx === "light" ? 1.8 : 1; }, [lab.skypx]);
  const { geometry, material } = useMemo(() => skyDome(style), [style]);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ camera, scene }, dt) => {
    mesh.current?.position.copy(camera.position);
    skyFrame(camera as THREE.PerspectiveCamera, scene, weather, style, Math.min(dt, 0.1));
  });
  // After the island's opaque meshes (the far plane only fills what they left), before its transparent ones.
  return <>
    <mesh ref={mesh} geometry={geometry} material={material} scale={RADIUS} frustumCulled={false} renderOrder={1000} />
    <SkyClouds style={style} />
  </>;
}
