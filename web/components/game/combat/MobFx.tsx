"use client";

/**
 * Zone 1's attack effects (design sheet "Mobs, zone 1"): every effect the mobs push (`rt.fx`, lib/game/combat/mobs.ts)
 * as a burst from our painted mob pack (art/fx/build_mob_pack.py: claw slashes, impact stars, spores, pollen, rune
 * sparks and circles, shell chips), and every hazard on the ground (`rt.hazards`) as a painted decal sized to exactly
 * the area it hurts or slows: the poison puddle (bubbling), the pollen's dusting, the elder's shockwave ring running out
 * with its hit front. Unlit and bright so they read by day and by night; sparks, motes and rune glyphs add light.
 * One instanced draw per layer, nothing allocated per frame (look spec: effects anchored in the world, one clock).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { combat } from "@/lib/game/combat/runtime";
import { FACE, ParticlePool, seedAt, type Recipe } from "@/lib/game/fx/particles";
import { MOB_PACK, MOB_PACK_COLS, MOB_PACK_ROWS, MOB_PACK_URL, type MobSprite } from "@/lib/game/fx/mobPack";
import type { MobFxKind, Hazard } from "@/lib/game/combat/runtime";
import { liveWind, PLACE_NORMAL, PLACE_VERTEX, useMoveParticles, VERTEX_PARS } from "../movement/moveFx";
import { defeatPuff } from "@/lib/game/movement/juice";

type Ground = (x: number, z: number) => number;
type R = Recipe<MobSprite>;
const B = FACE.billboard, G = FACE.ground, S = FACE.standing;

// ── Recipes (world units: a character stands 1.36) ─────────────────
const SLASH: R = { sprite: "slash", count: [1, 1], life: [0.3, 0.34], size: [1.25, 1.25], grow: 1.12, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 1, face: B, rise: [0.45, 0.45], fadeIn: 40 };
const IMPACT: R = { sprite: "impact", count: [1, 1], life: [0.26, 0.3], size: [1.2, 1.2], grow: 1.25, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 1, face: B, rise: [0.7, 0.7], fadeIn: 40 };
const SPORES: R = { sprite: "spores", count: [4, 5], life: [0.75, 1], size: [0.7, 0.9], grow: 1.6, speed: [0.6, 1.4], spread: Math.PI, up: [0.2, 0.6], gravity: 0, drag: 3, wind: 0.4, lift: 0.15, alpha: 0.95, face: S, jitter: 0.3 };
const POLLEN: R = { sprite: "pollen", count: [5, 6], life: [1.8, 2.4], size: [0.65, 0.9], grow: 1.7, speed: [0.5, 1.1], spread: Math.PI, up: [0.1, 0.35], gravity: 0, drag: 2.5, wind: 0.6, lift: 0.06, alpha: 0.9, face: B, jitter: 0.25, rise: [0.35, 0.9] };
const SHARDS: R = { sprite: "shard", count: [5, 6], life: [0.55, 0.7], size: [0.28, 0.36], grow: 1, speed: [2, 3.4], spread: Math.PI, up: [2, 3], gravity: 9, drag: 0.5, wind: 0, alpha: 1, face: B, rise: [0.4, 0.6], fps: 14 };
const MOTES: R = { sprite: "mote", count: [6, 8], life: [0.5, 0.9], size: [0.14, 0.22], grow: 0.8, speed: [0.8, 2], spread: Math.PI, up: [0.8, 1.6], gravity: 1.5, drag: 2, wind: 0.5, alpha: 1, face: B, jitter: 0.3, rise: [0.3, 0.7] };
const SPARKS: R = { ...MOTES, count: [4, 5], life: [0.22, 0.3], size: [0.16, 0.22], speed: [2, 3.2], spread: 0.8, up: [1, 2], gravity: 7, drag: 0.5 };
const RUNE: R = { sprite: "runeSpark", count: [1, 1], life: [0.4, 0.45], size: [0.95, 0.95], grow: 1.15, speed: [0, 0], spread: 0, up: [0.4, 0.4], gravity: 0, drag: 0, wind: 0, alpha: 1, face: B, rise: [0.8, 0.8], fadeIn: 30 };
const RUNE_HIT: R = { ...RUNE, size: [1.1, 1.1], rise: [0.35, 0.35] }; // low on the body, under a nameplate
const CIRCLE: R = { sprite: "runeCircle", count: [1, 1], life: [0.55, 0.6], size: [1.9, 1.9], grow: 1.1, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 1, face: G, fadeIn: 30 };

const TINT = { slash: 0xfff0d6, impact: 0xfff7ea, fox: 0xe9dcff, spores: 0xa8d65a, sporeMote: 0xe3f59a, pollen: 0xffe07a, pollenMote: 0xfff1a8,
  rune: 0x8ff2ff, shell: 0x7a5b45, amber: 0xffc35c, glint: 0xfff8e6 } as const;

/**
 * One zone-1 effect as bursts: `paint` blends (the shapes, readable on bright grass), `glow` adds light (motes, sparks).
 * Billboards stand a little toward the camera (`cx`, `cz`) so a body at the spot doesn't hide them.
 */
function play(kind: MobFxKind, x0: number, z0: number, rot: number, size: number, g: number, paint: ParticlePool, glow: ParticlePool, dust: ParticlePool, cx: number, cz: number) {
  const k = kind === "blink" || kind === "slam" ? 0 : kind === "runes" ? 2 : 1; // a bolt's glyph lands on you: well clear of your body
  const x = x0 + cx * k, z = z0 + cz * k;
  const dx = Math.sin(rot), dz = Math.cos(rot), seed = (salt: number) => seedAt(x, z, salt);
  switch (kind) {
    case "slash": // a claw sweep: three crescents across the swing, and a few glints
      paint.burst(SLASH, x, g, z, g, 0, 0, size, TINT.slash, seed(301));
      glow.burst(SPARKS, x, g, z, g, dx, dz, 0.8, TINT.glint, seed(302), 0.8);
      break;
    case "pounce": // a fox (or the elder's charge) connects: an impact star and violet motes
      paint.burst(IMPACT, x, g, z, g, 0, 0, size, size > 1.2 ? TINT.impact : TINT.fox, seed(311));
      glow.burst(MOTES, x, g, z, g, 0, 0, size, size > 1.2 ? TINT.amber : 0xc9a2ff, seed(312));
      break;
    case "spores": // a spore ball bursts on its ring (the puddle is a hazard decal)
      paint.burst(SPORES, x, g, z, g, 0, 0, size, TINT.spores, seed(321));
      glow.burst(MOTES, x, g, z, g, 0, 0, size, TINT.sporeMote, seed(322), 0.85);
      break;
    case "pollen": // a pollen sprite bursts: a golden cloud that hangs, shedding motes
      paint.burst(POLLEN, x, g, z, g, 0, 0, size, TINT.pollen, seed(331));
      glow.burst(MOTES, x, g, z, g, 0, 0, size * 1.2, TINT.pollenMote, seed(332));
      break;
    case "runes": // a rune bolt lands
      paint.burst(RUNE_HIT, x, g, z, g, 0, 0, 1, TINT.rune, seed(341));
      glow.burst(SPARKS, x, g, z, g, 0, 0, 1, TINT.rune, seed(342));
      break;
    case "blink": // a wisp blinks out (or in): a rune circle on the ground, a glyph rising
      paint.burst(CIRCLE, x, g, z, g, 0, 0, size, TINT.rune, seed(351));
      paint.burst(RUNE, x, g, z, g, 0, 0, size, TINT.rune, seed(352), 0.9);
      glow.burst(MOTES, x, g, z, g, 0, 0, size, TINT.rune, seed(353));
      break;
    case "glance": // a hit turned aside by a shell: sparks off it
      glow.burst(SPARKS, x, g, z, g, dx, dz, 1, TINT.glint, seed(361));
      paint.burst(IMPACT, x, g, z, g, 0, 0, 0.4, TINT.glint, seed(362), 0.9);
      break;
    case "crack": // the elder's shell cracks: chips, a burst of amber, dust
      paint.burst(SHARDS, x, g, z, g, 0, 0, size * 0.8, TINT.shell, seed(371));
      paint.burst(IMPACT, x, g, z, g, 0, 0, size * 1.2, TINT.amber, seed(372));
      glow.burst(MOTES, x, g, z, g, 0, 0, size, TINT.amber, seed(373));
      defeatPuff(dust, x, g, z, 1.4);
      break;
    case "slam": // claws into the ground: chips and dust (the shockwave is a hazard decal)
      paint.burst(SHARDS, x, g, z, g, 0, 0, size * 0.7, 0x9a8a72, seed(381));
      defeatPuff(dust, x, g, z, Math.min(1.2, size * 0.5));
      break;
  }
}

// ── Layers: one instanced quad mesh each, placed in the movement particles' shader ──
let atlas: THREE.Texture | null = null;
function mobAtlas(): THREE.Texture {
  if (!atlas) { atlas = new THREE.TextureLoader().load(MOB_PACK_URL); atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4; }
  return atlas;
}
const PICK = `{
  float pRow = floor((iB.w + 0.5) / ${MOB_PACK_COLS.toFixed(1)});
  float pCol = iB.w - pRow * ${MOB_PACK_COLS.toFixed(1)};
  vMapUv = vec2((pCol + uv.x) / ${MOB_PACK_COLS.toFixed(1)}, 1.0 - (pRow + 1.0 - uv.y) / ${MOB_PACK_ROWS.toFixed(1)});
}`;
/** Unlit: the painted value times the instance tint (and alpha), soft where a puff meets the ground. */
function layerMaterial(additive: boolean): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ map: mobAtlas(), transparent: true, depthWrite: false, toneMapped: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.onBeforeCompile = shader => {
    shader.vertexShader = VERTEX_PARS + shader.vertexShader
      .replace("#include <uv_vertex>", `#include <uv_vertex>\n${PICK}`)
      .replace("#include <begin_vertex>", `${PLACE_NORMAL}\n${PLACE_VERTEX}`);
    shader.fragmentShader = "varying vec4 vTint;\nvarying float vAbove;\n" + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
  diffuseColor *= vTint;
  diffuseColor.a *= smoothstep(0.0, 0.14, vAbove);
  if (diffuseColor.a < 0.003) discard;`);
  };
  m.customProgramCacheKey = () => `mob-fx-${additive ? "add" : "blend"}-v1`;
  return m;
}
interface Layer { mesh: THREE.Mesh; geometry: THREE.InstancedBufferGeometry; attrs: THREE.InstancedBufferAttribute[] }
function layer(arrays: Float32Array[], additive: boolean, renderOrder: number, name: string): Layer {
  const quad = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  for (const k of ["position", "normal", "uv"]) geometry.setAttribute(k, quad.getAttribute(k));
  const attrs = arrays.map((a, k) => { const attr = new THREE.InstancedBufferAttribute(a, 4).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute(`i${"ABCD"[k]}`, attr); return attr; });
  geometry.instanceCount = 0;
  const mesh = new THREE.Mesh(geometry, layerMaterial(additive));
  mesh.name = name; mesh.frustumCulled = false; mesh.renderOrder = renderOrder;
  return { mesh, geometry, attrs };
}
function show(l: Layer, n: number) {
  l.geometry.instanceCount = n;
  l.mesh.visible = n > 0;
  if (n) for (const a of l.attrs) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
}

// ── Hazard decals ───────────────────────────────────────────────────
/** Each hazard's look: its row, its tint, how much of the cell its painted shape fills (so the decal covers exactly its radius). */
const DECAL: Record<Hazard["kind"], { sprite: MobSprite; tint: number; fill: number; alpha: number }> = {
  poison: { sprite: "puddle", tint: 0x7fbf3f, fill: 0.86, alpha: 0.92 },
  pollen: { sprite: "pollen", tint: 0xffe07a, fill: 0.7, alpha: 0.55 },
  wave: { sprite: "shockRing", tint: 0xfff2d8, fill: 0.8, alpha: 1 },
};
const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const RGB = Object.fromEntries(Object.entries(DECAL).map(([k, d]) => [k, [lin((d.tint >> 16) & 255), lin((d.tint >> 8) & 255), lin(d.tint & 255)]])) as Record<Hazard["kind"], number[]>;
const DECALS = 24;
/** Write the hazards as ground quads: the puddle bubbles (its loop at 8 fps), the pollen settles, the ring runs out with the wave's own front. */
function writeDecals(a: Float32Array, b: Float32Array, c: Float32Array, d: Float32Array, hazards: Hazard[], ground: Ground, time: number): number {
  let n = 0;
  for (const h of hazards) {
    if (n >= DECALS) break;
    const look = DECAL[h.kind], k = h.age / h.life, q = n * 4, g = ground(h.x, h.z);
    const r = h.kind === "wave" ? h.r0 + (h.r - h.r0) * k : h.r;
    const frame = h.kind === "poison" ? Math.floor(time * 8 + h.id) % MOB_PACK_COLS : Math.min(MOB_PACK_COLS - 1, Math.floor(k * MOB_PACK_COLS));
    const fade = h.kind === "wave" ? 1 : Math.min(1, h.age / 0.15) * Math.min(1, (h.life - h.age) / 0.6);
    // The ring stands a little higher: it spans a wide patch of uneven ground.
    a[q] = h.x; a[q + 1] = g + (h.kind === "wave" ? 0.16 : 0.03) + n * 0.002; a[q + 2] = h.z; a[q + 3] = g;
    b[q] = b[q + 1] = (2 * r) / look.fill; b[q + 2] = h.id * 1.7; b[q + 3] = MOB_PACK[look.sprite].row * MOB_PACK_COLS + frame;
    const rgb = RGB[h.kind];
    c[q] = rgb[0]; c[q + 1] = rgb[1]; c[q + 2] = rgb[2]; c[q + 3] = look.alpha * fade;
    d[q] = 1; d[q + 1] = 0; d[q + 2] = 0; d[q + 3] = FACE.ground;
    n++;
  }
  return n;
}

const camPos = new THREE.Vector3(), camDir = new THREE.Vector3();
/** The mob effects of the ruins: two particle layers (painted, glowing) and the hazard decals. */
export default function MobFx({ ground }: { ground: Ground }) {
  const scene = useThree(s => s.scene);
  const dust = useMoveParticles(); // the slam's and the crack's dust is the movement pack's, as for every defeat
  const time = useRef(0);
  const fx = useMemo(() => {
    const paint = new ParticlePool(160, MOB_PACK), glow = new ParticlePool(200, MOB_PACK);
    const decals = [0, 1, 2, 3].map(() => new Float32Array(DECALS * 4));
    return { paint, glow, decals, layers: [layer(decals, false, 1.6, "MobDecals"), layer([paint.a, paint.b, paint.c, paint.d], false, 3.7, "MobFx"), layer([glow.a, glow.b, glow.c, glow.d], true, 3.8, "MobGlow")] };
  }, []);
  useEffect(() => {
    const meshes = fx.layers.map(l => l.mesh);
    scene.add(...meshes);
    return () => { scene.remove(...meshes); for (const l of fx.layers) { l.geometry.dispose(); (l.mesh.material as THREE.Material).dispose(); } };
  }, [scene, fx]);
  useFrame(({ camera }, delta) => {
    const rt = combat.rt, dt = combat.freeze ? 0 : Math.min(delta, 0.1); // effects keep the encounter's clock (held for a screenshot too)
    camera.getWorldPosition(camPos); camera.getWorldDirection(camDir);
    const toCam = -0.45 / (Math.hypot(camDir.x, camDir.z) || 1);
    for (const e of rt.fx) play(e.kind, e.x, e.z, e.rot, e.size, ground(e.x, e.z), fx.paint, fx.glow, dust.pool, camDir.x * toCam, camDir.z * toCam);
    rt.fx.length = 0;
    const wind = liveWind(), [decals, paint, glow] = fx.layers;
    for (const [pool, l] of [[fx.paint, paint], [fx.glow, glow]] as const) {
      pool.update(dt, wind.x, wind.z);
      show(l, pool.write(camPos.x, camPos.y, camPos.z, camDir.x, camDir.y, camDir.z));
    }
    const [a, b, c, d] = fx.decals;
    time.current += dt;
    show(decals, writeDecals(a, b, c, d, rt.hazards, ground, time.current));
  });
  return null;
}
