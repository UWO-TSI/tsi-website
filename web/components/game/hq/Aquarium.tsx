"use client";

/**
 * HQ's aquarium (specs/interiors/hq.md): the tank filling the hall's back wall, straight ahead of the door, the full
 * height of the room's two storeys. Colour from David's first
 * aquarium reference (bright cyan-blue water, schools of silver fish, coral low down), size from his second (a whole
 * wall of reef rock, orange fish, a warm strip along its base; the strip is the room's model).
 *
 * The tank's own shaders, all cheap:
 * - the water behind everything (the inside of the tank, art/interiors/build_hq.py hq_tank_inner): a gradient from
 *   deep blue at the sand to bright cyan at the top, slow shafts of light, and caustics wavering over the back wall;
 * - the reef and the fish: lit by the tank's own light from above (they glow with it at night as by day), caustics
 *   playing over whatever faces up, and the water's blue laid over them deeper in;
 * - the surface, seen from the walking camera above: ripples and caustic glints;
 * - the fish: one instanced mesh, every fish swimming its path in the vertex shader (lib/game/hqAquarium.ts has the
 *   same sums), so the tank is one draw and a uniform a frame.
 * Every shader goes through three's shared project_vertex, so the curved world bends the tank with the room.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HQ } from "@/lib/game/hqLayout";
import { tankFish } from "@/lib/game/hqAquarium";

const TANK_URL = "/assets/game/interiors/hq/tank.glb";
export const preloadAquarium = () => useGLTF.preload(TANK_URL);

/** Caustics: two warped sine lattices, bright only where their sum crosses zero (a thin moving net of light). */
const CAUSTIC = /* glsl */ `
float hqCaustic(vec2 p, float t) {
  vec2 a = p * 2.4 + vec2(t * 0.31, t * 0.19);
  vec2 b = p * 3.1 - vec2(t * 0.23, -t * 0.27);
  float v = sin(a.x + sin(a.y + t * 0.6) * 1.5) * sin(a.y + sin(a.x - t * 0.45) * 1.5);
  float u = sin(b.x + sin(b.y - t * 0.5) * 1.4) * sin(b.y + sin(b.x + t * 0.35) * 1.4);
  return pow(clamp(1.0 - abs(v + u) * 0.6, 0.0, 1.0), 7.0);
}`;

/** The tank's clock and colours, shared by every part of it. */
const tank = {
  uTime: { value: 0 },
  uTankLight: { value: new THREE.Color("#a9e4f6") },
  uWater: { value: new THREE.Color("#1f8fc4") },
  uGlassZ: { value: HQ.aquarium.z0 },
};

const BENT_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec3 transformed = position;
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  #include <project_vertex>
}`;

function waterMaterial() {
  return new THREE.ShaderMaterial({
    name: "HqTankWater",
    uniforms: { uTime: tank.uTime, uTop: { value: new THREE.Color("#63d6f2") }, uDeep: { value: new THREE.Color("#0c5a88") }, uRay: { value: new THREE.Color("#d4f6ff") } },
    vertexShader: BENT_VERTEX,
    side: THREE.DoubleSide,
    fragmentShader: /* glsl */ `
uniform float uTime; uniform vec3 uTop; uniform vec3 uDeep; uniform vec3 uRay;
varying vec2 vUv; varying vec3 vW;
${CAUSTIC}
void main() {
  float h = clamp(vUv.y, 0.0, 1.0);
  vec3 col = mix(uDeep, uTop, smoothstep(0.0, 1.0, h));
  float s = vW.x * 1.2 + vW.y * 0.32;
  float rays = pow(0.5 + 0.5 * sin(s * 1.6 + uTime * 0.22), 6.0) * 0.45 + pow(0.5 + 0.5 * sin(s * 2.9 - uTime * 0.17 + 1.3), 9.0) * 0.3;
  col += uRay * rays * smoothstep(0.15, 1.0, h) * 0.55;
  col += vec3(0.55, 0.85, 1.0) * hqCaustic(vec2(vW.x, vW.y * 0.8 + vW.z) * 1.7, uTime) * (0.05 + 0.17 * h);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
}

function surfaceMaterial() {
  return new THREE.ShaderMaterial({
    name: "HqTankSurface",
    uniforms: { uTime: tank.uTime, uTop: { value: new THREE.Color("#7fe0f5") }, uDeep: { value: new THREE.Color("#1688bb") } },
    vertexShader: BENT_VERTEX,
    side: THREE.DoubleSide,
    fragmentShader: /* glsl */ `
uniform float uTime; uniform vec3 uTop; uniform vec3 uDeep;
varying vec2 vUv; varying vec3 vW;
${CAUSTIC}
void main() {
  float rip = 0.5 + 0.5 * sin(vW.x * 7.0 + uTime * 1.4 + sin(vW.z * 5.0 + uTime) * 1.2);
  vec3 col = mix(uDeep, uTop, 0.45 + 0.3 * rip) + vec3(0.8, 0.97, 1.0) * hqCaustic(vW.xz * 1.6, uTime * 1.3) * 0.7;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
}

/**
 * The tank's light on a lit material (the reef, the fish): from above, with caustics on what faces up, and the water's
 * blue over it deeper in from the glass. `swim` adds the fish's paths (the vertex shader moves each instance).
 */
function tankLit(material: THREE.MeshStandardMaterial, swim: boolean) {
  // How much of the water's blue lies over it: the reef at the back more, the fish mid-water less.
  const [haze, deep] = swim ? ["0.04", "0.12"] : ["0.08", "0.24"];
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, tank);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
uniform float uTime;
varying vec3 vTankWorld;
varying vec3 vTankN;
${swim ? "attribute vec4 aSwim;\nattribute vec4 aBob;\nattribute vec2 aLook;" : ""}`)
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
vTankWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTankN = normalize(mat3(modelMatrix) * objectNormal);`);
    if (swim) shader.vertexShader = shader.vertexShader
      .replace("#include <beginnormal_vertex>", `
float fa = aSwim.z * uTime + aSwim.w;
float fb = 1.3 * aSwim.z * uTime + 0.6 * aSwim.w;
vec3 fishPos = vec3(aSwim.x + aSwim.y * sin(fa), aBob.x + aBob.y * sin(2.0 * aSwim.z * uTime + 1.7 * aSwim.w), aBob.z + aBob.w * sin(fb));
float fishYaw = atan(aSwim.y * aSwim.z * cos(fa), aBob.w * 1.3 * aSwim.z * cos(fb));
float fc = cos(fishYaw), fs = sin(fishYaw);
vec3 objectNormal = vec3(fc * normal.x + fs * normal.z, normal.y, -fs * normal.x + fc * normal.z);`)
      .replace("#include <begin_vertex>", `
vec3 transformed = position * aLook.x;
float tail = clamp(-position.z * 1.6, 0.0, 1.0);
transformed.x += sin(uTime * 8.0 + aLook.y) * 0.1 * tail * tail * aLook.x;
transformed = vec3(fc * transformed.x + fs * transformed.z, transformed.y, -fs * transformed.x + fc * transformed.z) + fishPos;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uTime; uniform vec3 uTankLight; uniform vec3 uWater; uniform float uGlassZ;
varying vec3 vTankWorld;
varying vec3 vTankN;
${CAUSTIC}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
float tankUp = clamp(vTankN.y * 0.5 + 0.5, 0.0, 1.0);
float tankC = hqCaustic(vTankWorld.xz * 1.1 + vTankWorld.y * 0.2, uTime);
totalEmissiveRadiance += diffuseColor.rgb * uTankLight * (0.22 + 0.4 * tankUp + tankC * (0.35 + 0.9 * tankUp));`)
      .replace("#include <opaque_fragment>", `#include <opaque_fragment>
gl_FragColor.rgb = mix(gl_FragColor.rgb, uWater, ${haze} + ${deep} * clamp((vTankWorld.z - uGlassZ) / 1.4, 0.0, 1.0));`);
  };
  material.customProgramCacheKey = () => (swim ? "hq-tank-fish" : "hq-tank-reef");
  return material;
}

/** A fish a unit long, nose toward +z: a body thin side to side and tapering to the tail, and a forked fin. */
function fishGeometry(): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(0.5, 10, 7).toNonIndexed();
  body.scale(0.17, 0.44, 1.0);
  const p = body.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z < 0) { const k = Math.max(0.28, 1 + z * 1.25); p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k); }
  }
  body.computeVertexNormals();
  const fin = new THREE.BufferGeometry();
  fin.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.4, 0, 0.24, -0.7, 0, 0.03, -0.56, 0, 0, -0.4, 0, -0.03, -0.56, 0, -0.24, -0.7], 3));
  fin.setAttribute("normal", new THREE.Float32BufferAttribute(Array.from({ length: 6 }, () => [1, 0, 0]).flat(), 3));
  fin.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
  return mergeGeometries([body, fin])!;
}

function Fish() {
  const mesh = useMemo(() => {
    const fish = tankFish();
    const geometry = fishGeometry();
    const swim = new Float32Array(fish.length * 4), bob = new Float32Array(fish.length * 4), look = new Float32Array(fish.length * 2);
    fish.forEach((f, i) => { swim.set([f.ac, f.aa, f.w, f.ph], i * 4); bob.set([f.y0, f.ya, f.d0, f.da], i * 4); look.set([f.size, f.beat], i * 2); });
    geometry.setAttribute("aSwim", new THREE.InstancedBufferAttribute(swim, 4));
    geometry.setAttribute("aBob", new THREE.InstancedBufferAttribute(bob, 4));
    geometry.setAttribute("aLook", new THREE.InstancedBufferAttribute(look, 2));
    const material = tankLit(new THREE.MeshStandardMaterial({ name: "HqTankFish", roughness: 0.35, metalness: 0.25, side: THREE.DoubleSide }), true);
    const m = new THREE.InstancedMesh(geometry, material, fish.length);
    const c = new THREE.Color();
    fish.forEach((f, i) => m.setColorAt(i, c.set(f.color)));
    m.frustumCulled = false;
    m.castShadow = m.receiveShadow = false;
    return m;
  }, []);
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); }, [mesh]);
  return <primitive object={mesh} />;
}

export default function Aquarium() {
  const { scene } = useGLTF(TANK_URL);
  const model = useMemo(() => {
    const root = scene.clone(true);
    const mats: THREE.Material[] = [];
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name || mesh.parent?.name || "";
      mesh.frustumCulled = false;
      mesh.castShadow = mesh.receiveShadow = false;
      const material = /hq_tank_inner/.test(name) ? waterMaterial()
        : /hq_tank_surface/.test(name) ? surfaceMaterial()
        // Unlit: a lit pane catches the blue light in front of it and washes the water out from above.
        : /hq_tank_glass/.test(name) ? new THREE.MeshBasicMaterial({ name: "HqTankGlass", color: "#d6f3fb", transparent: true, opacity: 0.07, depthWrite: false })
        : tankLit(new THREE.MeshStandardMaterial({ name: "HqTankReef", vertexColors: true, roughness: 0.9 }), false);
      mesh.material = material;
      mats.push(material);
      if (/hq_tank_glass/.test(name)) mesh.renderOrder = 1;
    });
    return { root, mats };
  }, [scene]);
  useEffect(() => () => model.mats.forEach(m => m.dispose()), [model]);
  useFrame(state => { tank.uTime.value = state.clock.elapsedTime % 3600; });
  return <group>
    <primitive object={model.root} />
    <Fish />
  </group>;
}
