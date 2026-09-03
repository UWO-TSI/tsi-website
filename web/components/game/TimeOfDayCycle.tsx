"use client";

/**
 * TimeOfDayCycle — extracted from GameWorld.tsx (2026-09-02) so the
 * applicant island (components/game/mini) can share the exact sky, sun,
 * fill and fog chemistry of the member world. Behaviour is unchanged for
 * GameWorld; the only additions are `hourOverride` (pin the sky to one
 * hour) and `groundColor` (hemisphere bounce), both optional.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Weather } from "@/lib/game/weather";
import { applyEnvironment, disposeEnvironment } from "@/lib/game/envLight";

export type TodPhase = "day" | "night" | "dawn" | "dusk";

// ─── Time-of-Day (v2 spec Section 8.1) ──────────────────────────
// [hour, skyTop, skyBottom, sunColor, sunIntensity, ambientColor, ambientIntensity]
// Cozy push 2026-07-03: day keys re-graded toward ACNH pastels — saturated
// azure tops, soft mint-cream horizons (the old #B8E4F0 horizon doubled as
// the fog color and read as gray soup), warm golden sun instead of pure
// white, ambient lifted slightly so default-on soft shadows stay gentle.
// Art pass 2026-07-07 (New Leaf bright): the old warm-cream day sun over
// lavender ambient mixed to olive on the ACNH albedos ("muddy"). NL's
// actual daytime read is a near-WHITE sun, clean sky-blue ambient bounce,
// and the saturated grass doing the color work. Tone mapping also moved
// ACES→None (ACES desaturates midtones — a second muddiness source).
// Lighting v3 (2026-07-14 lab): strong sun over lean fills — the old
// triple fill flooded the sun shadows invisible.
// Lighting v4 (research application, specs/lighting-research.md L2+L3):
// densified toward ACNH's per-hour grading with the Minecraft-pack color
// discipline — noon sun slightly COOL-white over blue ambient (warm-cool
// hue contrast; BSL noon is (196,220,255)), golden hour gets the most
// keys with a sunset POWER RAMP (color saturates AND darkens together,
// Complementary-style), dawn eases through cream, night keeps the blue
// floor. Fog anchors at 7/10-15/17/21 unchanged (sky-art contract).
export const TOD_KEYS: [number, string, string, string, number, string, number][] = [
  [5,  "#FFB878", "#FFDDB8", "#FFD9B0", 0.6,  "#C8BCFF", 0.34], // dawn peach
  [6,  "#8FC4EE", "#F2E2C8", "#FFE7C4", 0.95, "#D8D4F2", 0.36], // sunrise cream
  [7,  "#63C2F7", "#BEE4EE", "#FFF9E8", 1.25, "#CFE7FF", 0.38],
  // AC-ref correction: the BSL cool-white noon was Minecraft's look, not
  // AC's — the references read WARM cream key over cool fill. Key goes
  // back to cream; the blue ambient keeps the shadows cool (law 1 intact).
  [10, "#4FB6F5", "#A9DCF2", "#FFF7E4", 1.4,  "#CFE2FF", 0.35], // noon: cream sun / blue fill
  [14, "#53B8F2", "#C8E6E4", "#FFF4DC", 1.3,  "#D4E4EC", 0.36],
  [16, "#7FB4D8", "#F2DCB8", "#FFC98F", 1.05, "#EBD8C0", 0.36], // golden ramp begins
  [17, "#FF9966", "#FFD4A8", "#FFA35C", 0.95, "#FFD4A8", 0.34], // golden peak (BSL 255,160,80)
  [18, "#E87A5A", "#F2B888", "#FF8E4A", 0.7,  "#E8B090", 0.3],  // saturate + darken
  [19, "#FF9966", "#2D2D6B", "#FF7A48", 0.35, "#6B5A8B", 0.26], // last ember
  [21, "#1A1A40", "#2D2D6B", "#334466", 0.0,  "#334466", 0.22], // blue night floor
];
const _tc = new THREE.Color();
const _sunPos = new THREE.Vector3();

/**
 * Sun + moon direction from wall-clock hour.
 *
 * R3-3 (P12 + P17 redo): two prior attempts billboard-meshed the disc as
 * scene geometry and lost the frustum / blended into fog. This time the
 * disc lives inside the sky shader so it's always rendered, additive over
 * the gradient, never clipped by camera-far.
 *
 * Northern-hemisphere convention: noon → sun is high in the southern sky;
 * midnight → moon is high. The sun arcs east→south→west, moon arcs the
 * opposite half of the day. Both are unit vectors in world space.
 */
export function computeSunMoonDirs(hour: number): { sunDir: THREE.Vector3; moonDir: THREE.Vector3 } {
  // Sun parameter s: 0 at sunrise (6), 0.5 at noon (12), 1 at sunset (18).
  // Outside 6→18 the sun is below the horizon — we still emit a dir but the
  // visibility uniform drops to 0 so the disc doesn't show. Moon is the
  // antipode (180° offset) so when the sun sets the moon rises.
  const s = (hour - 6) / 12; // 6→0, 12→0.5, 18→1
  const azimuthDeg = -90 + s * 180; // east (-90) → south (0) → west (+90)
  // Elevation rides a low 5-13° band (was 0-60°). W18-1: the camera rig is
  // pitched down at the player and only a thin sky sliver above the fog line
  // is ever in frame, so a high sun was invisible every hour of the day. The
  // floor keeps the disc above the fog-terrain silhouette at dawn/dusk; the
  // 13° peak keeps noon inside the visible band. Reads as a stylized
  // low-hanging PS1 sun arcing east → south → west.
  // Camera-pinned dome (2026-07-12): view direction == dome direction now,
  // and the default pose tops out ~3° above the geometric horizon. The old
  // 3-8° band (tuned for the origin-anchored dome) parked the sun just out
  // of frame all day. 1.5-3.5° keeps the sprite's upper half in the visible
  // sliver across the arc.
  const elevationDeg = 1.5 + Math.sin(s * Math.PI) * 2;
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  // World axes: +X east, +Y up, -Z south (because spec puts Oracle Temple at +Z
  // labeled "north" via the compass — see CompassFeed). atan2(fwd.x, fwd.z) +
  // π maps so south sun = +Z. We aim sun toward +Z at az=0.
  const sunDir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  // Moon is the antipode in azimuth + mirrored elevation about the hour
  // 12 offset. Simplest stable form: rotate sun dir 180° around Y and lift it
  // by the night-portion elevation. At hour=0 (midnight), sun is far below
  // the horizon at south; moon is high above the south.
  const ns = (((hour + 12) % 24) - 6) / 12; // moon equivalent of s
  const mAz = (-90 + ns * 180) * Math.PI / 180;
  const mEl = (1.5 + Math.sin(ns * Math.PI) * 2) * Math.PI / 180; // same low band as the sun
  const moonDir = new THREE.Vector3(
    Math.sin(mAz) * Math.cos(mEl),
    Math.sin(mEl),
    Math.cos(mAz) * Math.cos(mEl),
  );
  return { sunDir, moonDir };
}

let _shadowFrameFlip = false;
function updateShadowRig(gl: THREE.WebGLRenderer, sun: THREE.DirectionalLight, playerPos: THREE.Vector3, sunWorld: THREE.Vector3) {
  sun.position.set(playerPos.x + sunWorld.x, sunWorld.y, playerPos.z + sunWorld.z);
  sun.target.position.set(playerPos.x, 0, playerPos.z);
  sun.target.updateMatrixWorld();
  // R3F sets shadow-camera-* props but never calls updateProjectionMatrix —
  // without this the ortho frustum stays at its construction defaults and
  // the map renders a tiny box nowhere near the view (classic gotcha).
  sun.shadow.camera.updateProjectionMatrix();
  gl.shadowMap.autoUpdate = false;
  _shadowFrameFlip = !_shadowFrameFlip;
  if (_shadowFrameFlip) gl.shadowMap.needsUpdate = true;
}

export function TimeOfDayCycle({ weather, todPhase, shadowsOn, playerPosRef, hourOverride, groundColor = "#8CBA5E" }: {
  weather: Weather;
  todPhase: TodPhase;
  shadowsOn: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  /** Pin the sky + sun to a fixed hour (the applicant island). Wall clock when omitted. */
  hourOverride?: number;
  /** Hemisphere ground bounce color. */
  groundColor?: string;
}) {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  // Sky system 2026-07-12 (David-approved): painted equirect panoramas on a
  // CAMERA-PINNED dome (sky never translates → reads infinitely far), all
  // four time-of-day textures bound at once and crossfaded via a vec4
  // weight uniform (mutated with .value.set(), never reassigned — the
  // established compiler-safe pattern). A slightly smaller cloud shell
  // drifts independently for parallax wind. Sun/moon are ACNH sprites now;
  // the old in-shader discs are gone. Placeholder skies are baked from the
  // TOD palette — David's AI art drops into /assets/sky/ as a file swap.
  const skyTextures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const load = (url: string, wrap = false) => {
      const t = loader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      if (wrap) t.wrapS = THREE.RepeatWrapping;
      return t;
    };
    // Rain days v1: same four phases, weather picks the texture set.
    // File contract: /assets/sky/sky_{time}_{weather}.webp. Cloudy (v2)
    // reuses the sunny panoramas — the denser, darker cloud shell and
    // dimmed sun carry the overcast read until David's cloudy art lands.
    const texWeather = weather === "cloudy" ? "sunny" : weather;
    return {
      phases: [
        load(`/assets/sky/sky_morning_${texWeather}.webp`),
        load(`/assets/sky/sky_afternoon_${texWeather}.webp`),
        load(`/assets/sky/sky_evening_${texWeather}.webp`),
        load(`/assets/sky/sky_night_${texWeather}.webp`),
      ],
      clouds: load("/assets/sky/clouds.webp", true),
      sun: load("/assets/sky/sun.png"),
      moon: load("/assets/sky/moon.png"),
    };
  }, [weather]);

  const skyMat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      t0: { value: skyTextures.phases[0] },
      t1: { value: skyTextures.phases[1] },
      t2: { value: skyTextures.phases[2] },
      t3: { value: skyTextures.phases[3] },
      weights: { value: new THREE.Vector4(0, 1, 0, 0) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D t0, t1, t2, t3;
      uniform vec4 weights;
      varying vec2 vUv;
      void main(){
        vec3 col = texture2D(t0, vUv).rgb * weights.x
                 + texture2D(t1, vUv).rgb * weights.y
                 + texture2D(t2, vUv).rgb * weights.z
                 + texture2D(t3, vUv).rgb * weights.w;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }), [skyTextures]);

  const cloudMat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true,
    uniforms: {
      tex: { value: skyTextures.clouds },
      // x = u-offset (drift), y = opacity, z = brightness tint
      params: { value: new THREE.Vector4(0, 0.85, 1, 0) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tex;
      uniform vec4 params;
      varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tex, vec2(vUv.x + params.x, vUv.y));
        gl_FragColor = vec4(c.rgb * params.z, c.a * params.y);
      }
    `,
  }), [skyTextures]);

  const skyGroupRef = useRef<THREE.Group>(null);
  const sunSpriteRef = useRef<THREE.Sprite>(null);
  const moonSpriteRef = useRef<THREE.Sprite>(null);
  const { camera: skyCam, gl } = useThree();

  // P3 (2026-07-13): ACNH cozy-reflection pass — PMREM environment baked
  // from the TOD palette, regenerated only on phase flips. Every standard
  // material picks up sky-colored ambience + a warm sun glint.
  useEffect(() => {
    applyEnvironment(gl, scene, todPhase);
  }, [gl, scene, todPhase]);
  // shadow target follows the player; three needs the target in the graph
  useEffect(() => {
    const sun = sunRef.current;
    if (!sun) return;
    scene.add(sun.target);
    return () => { scene.remove(sun.target); };
  }, [scene]);
  useEffect(() => () => disposeEnvironment(scene), [scene]);

  useFrame(() => {
    const now = new Date();
    const h = hourOverride ?? now.getHours() + now.getMinutes() / 60;

    // Find bounding keyframes
    let ai = TOD_KEYS.length - 1, bi = 0;
    for (let i = 0; i < TOD_KEYS.length - 1; i++) {
      if (h >= TOD_KEYS[i][0] && h < TOD_KEYS[i + 1][0]) { ai = i; bi = i + 1; break; }
    }
    const a = TOD_KEYS[ai], b = TOD_KEYS[bi];

    let t: number;
    if (ai < bi) {
      t = (h - a[0]) / (b[0] - a[0]);
    } else {
      // Night→Dawn wrap (21→5)
      const span = (24 - a[0]) + b[0];
      t = (h >= a[0] ? h - a[0] : h + 24 - a[0]) / span;
    }
    t = THREE.MathUtils.clamp(t, 0, 1);

    // Sky crossfade: map the hour onto the four panoramas with 1.5h blend
    // windows (morning 5-10, afternoon 10-17, evening 17-20.5, night rest).
    {
      const EDGES = [5, 10, 17, 20.5]; // segment starts for tex 0..3
      const BLEND = 1.5;
      let wi = 3; // default night
      for (let i = 0; i < 4; i++) {
        const from = EDGES[i];
        const to = EDGES[(i + 1) % 4];
        const inSeg = from < to ? h >= from && h < to : h >= from || h < to;
        if (inSeg) { wi = i; break; }
      }
      const next = (wi + 1) % 4;
      const nextEdge = EDGES[next];
      let until = nextEdge - h;
      if (until < 0) until += 24;
      const blend = until < BLEND ? 1 - until / BLEND : 0;
      const w = [0, 0, 0, 0];
      w[wi] = 1 - blend;
      w[next] = blend;
      skyMat.uniforms.weights.value.set(w[0], w[1], w[2], w[3]);
    }

    // R3-3: sun + moon orbit from wall-clock hour. We pull from the same
    // wall-clock the TOD palette already uses (`h`), so disc position
    // stays locked to the sky tone — at hour 17 (sunset key) the sun
    // sits near the west horizon, just above the orange band.
    const { sunDir, moonDir } = computeSunMoonDirs(h);
    // Visibility: sun only when it's above the horizon, moon only when
    // *it* is. A small smoothstep fade keeps the disc from popping at
    // y=0 (≈ sunrise/sunset edges where TOD_KEYS already lerps the sky).
    // We mutate the Vector4 in place via .set(...) so eslint
    // react-hooks/immutability stays happy (no property reassignment on
    // the uniforms object returned from useMemo).
    const sunVis = THREE.MathUtils.smoothstep(sunDir.y, -0.05, 0.15);
    const moonVis = THREE.MathUtils.smoothstep(moonDir.y, -0.05, 0.15);
    // Weather grades: rain flattens hard, cloudy softens.
    const wDim = weather === "rain" ? 0.5 : weather === "cloudy" ? 0.8 : 1;
    const wBody = weather === "rain" ? 0.08 : weather === "cloudy" ? 0.45 : 1;
    // ACNH sun/moon sprites ride the arc on the pinned dome.
    if (sunSpriteRef.current) {
      sunSpriteRef.current.position.copy(sunDir).multiplyScalar(200);
      (sunSpriteRef.current.material as THREE.SpriteMaterial).opacity = sunVis * wBody;
    }
    if (moonSpriteRef.current) {
      moonSpriteRef.current.position.copy(moonDir).multiplyScalar(200);
      (moonSpriteRef.current.material as THREE.SpriteMaterial).opacity = moonVis * 0.95 * wBody;
    }
    // Pin the whole sky to the camera: it rotates with the view but never
    // translates — the parallax contrast against the sliding world is what
    // sells infinite distance.
    if (skyGroupRef.current) skyGroupRef.current.position.copy(skyCam.position);
    // Cloud shell drift + day/night dimming. Rain: denser, darker, faster.
    {
      const sunI = (a[4] + (b[4] - a[4]) * t) * wDim;
      const prev = cloudMat.uniforms.params.value as THREE.Vector4;
      const drift = weather === "rain" ? 0.00003 : 0.000012;
      const cOpacity = weather === "rain" ? 0.95 : 0.85;
      // wave-26 follow-up: night clouds dimmed (0.45->0.32 floor)
      cloudMat.uniforms.params.value.set(prev.x + drift, cOpacity, (0.32 + sunI * 0.68) * (weather === "rain" ? 0.75 : 1), 0);
    }

    // Sun
    if (sunRef.current) {
      sunRef.current.color.set(a[3]).lerp(_tc.set(b[3]), t);
      sunRef.current.intensity = (a[4] + (b[4] - a[4]) * t) * wDim;
      // Cozy push 2026-07-03: the LIGHT rides a classic high arc (15-60°)
      // even though the visible DISC stays low (W18-1 keeps it in the
      // camera-reachable band). Sharing the low arc made midday light skim
      // from the horizon — flat, gloomy, and shadow streaks across the whole
      // village. Azimuth still tracks the disc so shadows lean the right way.
      const s = (h - 6) / 12;
      const lightEl = ((15 + Math.sin(Math.min(Math.max(s, 0), 1) * Math.PI) * 45) * Math.PI) / 180;
      const lightAz = ((-90 + s * 180) * Math.PI) / 180;
      _sunPos.set(
        Math.sin(lightAz) * Math.cos(lightEl),
        Math.sin(lightEl),
        Math.cos(lightAz) * Math.cos(lightEl)
      ).multiplyScalar(30);
      if (shadowsOn) {
        updateShadowRig(gl, sunRef.current, playerPosRef.current, _sunPos);
      } else {
        sunRef.current.position.copy(_sunPos);
      }
    }
    // Ambient
    if (ambRef.current) {
      ambRef.current.color.set(a[5]).lerp(_tc.set(b[5]), t);
      ambRef.current.intensity = (a[6] + (b[6] - a[6]) * t) * (weather === "rain" ? 0.85 : 1);
    }
    // Hemisphere rides the sun curve (art pass 2026-07-07). Lighting v3:
    // retuned for the stronger sun — 0.2 floor at night → ~0.4 at noon
    // (was 0.3 + sunI×0.55 ≈ 0.82, a shadow-flooding fill).
    if (hemiRef.current) {
      const sunI = (a[4] + (b[4] - a[4]) * t) * wDim;
      hemiRef.current.intensity = 0.2 + sunI * 0.14;
    }
    // Fog still follows the TOD horizon palette (the placeholder skies are
    // baked from the same table, so they stay in sync). Rain pulls it
    // toward the overcast gray so the haze matches the rain skies.
    if (scene.fog) {
      const f = (scene.fog as THREE.Fog).color.set(a[2]).lerp(_tc.set(b[2]), t);
      if (weather === "rain") f.lerp(_tc.set("#AAB2BC"), 0.65);
    }
  });

  return (
    <>
      <group ref={skyGroupRef}>
        <mesh scale={[240, 240, 240]} renderOrder={-3}>
          <sphereGeometry args={[1, 32, 24]} />
          <primitive object={skyMat} attach="material" />
        </mesh>
        <mesh scale={[226, 226, 226]} renderOrder={-2}>
          <sphereGeometry args={[1, 32, 24]} />
          <primitive object={cloudMat} attach="material" />
        </mesh>
        <sprite ref={sunSpriteRef} scale={[26, 26, 1]} renderOrder={-1}>
          <spriteMaterial map={skyTextures.sun} color="#FFEDB8" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
        </sprite>
        <sprite ref={moonSpriteRef} scale={[15, 15, 1]} renderOrder={-1}>
          <spriteMaterial map={skyTextures.moon} transparent opacity={0} depthWrite={false} fog={false} />
        </sprite>
      </group>
      <hemisphereLight ref={hemiRef} args={["#EAF6FF", groundColor, 0.8]} />
      <ambientLight ref={ambRef} intensity={0.5} color="#D6ECFF" />
      {/* P-light v2 (2026-07-13, ACNH lighting deep-dive): one soft PCF
          shadow map from the sun — buildings/trees/landmarks cast onto
          terrain+roads. ACNH shadows are never black: the strong
          ambient/hemi/IBL fill lifts them into warm sky-tinted shade.
          Gated by the shadows setting; blob discs remain the fallback.
          Bounds cover the respaced island (was ±30 pre-2026-07-07). */}
      <directionalLight
        ref={sunRef}
        color="#FFFFFF" intensity={1.0} position={[15, 30, 15]}
        castShadow={shadowsOn}
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-near={5} shadow-camera-far={90}
        shadow-camera-left={-22} shadow-camera-right={22}
        shadow-camera-top={22} shadow-camera-bottom={-22}
        shadow-bias={-0.0004} shadow-normalBias={0.03}
      />
      <directionalLight color="#C0D0FF" intensity={0.15} position={[-12, 18, -8]} />
    </>
  );
}
