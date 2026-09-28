"use client";

/**
 * Contact shadows (specs/look-development.md §9.2, row 240): the soft
 * darkening directly under every grounded object, on both tiers, in the
 * phase's shadow tint. Replaces the old blob lists (plants, Light-tier solids,
 * character blobs), which each scene kept by hand and pointed nowhere.
 *
 * Objects register themselves: every prepared model (GLBProp, ACNH buildings)
 * from its class and its own bounds (lib/game/shadows.ts), every character
 * from Character. One instanced draw per scene reads them each frame, so a
 * moved, hidden or removed object takes its contact with it.
 *
 * With the sun's shadow map (High) the contact is lighter and only darkens
 * ground the sun still reaches, so it never doubles up with the sun shadow.
 * Without it (Light) tall casters also get a cheap shadow stretched away from
 * the key light by their height, so both tiers agree on direction.
 */
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { contactSize, sunShadow, type ContactSize, type Ellipse, type ShadowClass } from "@/lib/game/shadows";

interface Contact extends ContactSize { object: THREE.Object3D }
const CONTACTS = new WeakMap<THREE.Object3D, Set<Contact>>();

/** Add `object`'s contact shadow (`size` in the object's own frame) to its scene; returns the removal. */
export function addContact(scene: THREE.Object3D, object: THREE.Object3D, size: ContactSize) {
  let set = CONTACTS.get(scene);
  if (!set) CONTACTS.set(scene, set = new Set());
  const contact = { object, ...size };
  set.add(contact);
  return () => { set.delete(contact); };
}

/** Keep `object`'s contact shadow in its scene while mounted. */
export function useContactShadow(object: THREE.Object3D, size: ContactSize | null) {
  const scene = useThree(s => s.scene);
  useEffect(() => (size ? addContact(scene, object, size) : undefined), [scene, object, size]);
}

/** A model's contact from its class and its bounds in its own frame. */
export function modelContact(model: THREE.Object3D, url: string, cls: ShadowClass): ContactSize | null {
  model.updateWorldMatrix(false, true);
  return contactSize(url, cls, new THREE.Box3().setFromObject(model).applyMatrix4(model.matrixWorld.clone().invert()));
}

/** A flat 2×2 disc on the ground: scale by the ellipse's half extents. */
const DISC = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
const FALLOFF = "(1.0 - smoothstep(0.4, 1.0, length(vDisc)))";
function discVertex(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = "varying vec2 vDisc;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vDisc = uv * 2.0 - 1.0;");
  shader.fragmentShader = "varying vec2 vDisc;\n" + shader.fragmentShader;
}

/** Soft disc, darkening only where the sun still reaches (getShadowMask is 1 without a shadow map); the instance colour's red is its strength. */
function contactMaterial() {
  const material = new THREE.ShadowMaterial({ depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  material.onBeforeCompile = shader => {
    discVertex(shader);
    shader.vertexShader = "varying float vStrength;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
  #ifdef USE_INSTANCING_COLOR
    vStrength = instanceColor.r;
  #else
    vStrength = 1.0;
  #endif`);
    shader.fragmentShader = "varying float vStrength;\n" + shader.fragmentShader.replace("opacity * ( 1.0 - getShadowMask() )", `opacity * vStrength * ${FALLOFF} * getShadowMask()`);
  };
  material.customProgramCacheKey = () => "contact-shadow-v1";
  return material;
}

/** Contact opacity per unit of the phase's shadow intensity: lighter under a sun shadow map. */
const CONTACT = { sunMap: 0.3, none: 0.42 };
/** The Light tier's sun-directed shadow, per unit of shadow intensity. */
const DIRECTED = 0.36;
const CAPACITY = 1024;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _sun = new THREE.Vector3(), _target = new THREE.Vector3(), _strength = new THREE.Color();

function place(mesh: THREE.InstancedMesh, i: number, e: Ellipse, y: number) {
  mesh.setMatrixAt(i, _m.compose(_p.set(e.x, y, e.z), _q.setFromAxisAngle(_up, e.yaw), _s.set(e.rx, 1, e.rz)));
}

/** Drawn and in this scene: every ancestor visible up to the root. */
function shown(object: THREE.Object3D, scene: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (!o.visible) return false;
    if (o === scene) return true;
  }
  return false;
}

/** The scene's contact layer: every registered contact as one instanced draw, the Light tier's directed shadows as a second. */
class ContactLayer {
  readonly contacts = new THREE.InstancedMesh(DISC, contactMaterial(), CAPACITY);
  readonly directed = new THREE.InstancedMesh(DISC, contactMaterial(), CAPACITY);
  private sun: THREE.DirectionalLight | null = null;
  private sunMap = false;

  constructor() {
    for (const mesh of [this.contacts, this.directed]) { mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.renderOrder = 1; mesh.count = 0; }
  }

  look(tint: string, intensity: number, sunMap: boolean) {
    const [a, b] = [this.contacts.material, this.directed.material] as THREE.ShadowMaterial[];
    a.color.set(tint); b.color.set(tint);
    a.opacity = intensity * (sunMap ? CONTACT.sunMap : CONTACT.none);
    b.opacity = intensity * DIRECTED;
    this.sunMap = sunMap;
  }

  /** After the frame's movement and matrix update, before the draw list is built: contacts never trail their objects. */
  hook(scene: THREE.Scene) {
    const before = scene.onBeforeRender;
    scene.onBeforeRender = (...args) => { before.apply(scene, args); this.update(scene); };
    return () => {
      scene.onBeforeRender = before;
      (this.contacts.material as THREE.Material).dispose();
      (this.directed.material as THREE.Material).dispose();
    };
  }

  private update(scene: THREE.Scene) {
    const a = this.contacts, b = this.directed;
    if (!this.sunMap && (!this.sun || !shown(this.sun, scene))) this.sun = (scene.getObjectByName("sun") as THREE.DirectionalLight | undefined) ?? null;
    const light = this.sunMap ? null : this.sun;
    if (light) _sun.setFromMatrixPosition(light.matrixWorld).sub(_target.setFromMatrixPosition(light.target.matrixWorld));
    let n = 0, d = 0;
    for (const c of CONTACTS.get(scene) ?? []) {
      if (n >= CAPACITY || !shown(c.object, scene)) continue;
      const e = c.object.matrixWorld.elements;
      const sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]), sz = Math.hypot(e[8], e[9], e[10]);
      const foot: Ellipse = { x: e[0] * c.cx + e[8] * c.cz + e[12], z: e[2] * c.cx + e[10] * c.cz + e[14], rx: c.rx * sx, rz: c.rz * sz, yaw: Math.atan2(e[8], e[10]) };
      a.setColorAt(n, _strength.setScalar(c.strength));
      place(a, n++, foot, e[13] + 0.03);
      const cast = light ? sunShadow(foot, c.height * sy, [_sun.x, _sun.y, _sun.z]) : null;
      if (cast) place(b, d++, cast, e[13] + 0.025);
    }
    a.count = n; b.count = d;
    a.instanceMatrix.needsUpdate = b.instanceMatrix.needsUpdate = true;
    if (a.instanceColor) a.instanceColor.needsUpdate = true;
  }
}

export default function ContactShadows({ tint, intensity, sunMap }: {
  /** The phase's shadow tint and intensity (lookPreset via islandLight). */
  tint: string; intensity: number;
  /** The key light casts a shadow map (High): contacts only ground things; no directed shadows. */
  sunMap: boolean;
}) {
  const scene = useThree(s => s.scene);
  const layer = useMemo(() => new ContactLayer(), []);
  useEffect(() => layer.look(tint, intensity, sunMap), [layer, tint, intensity, sunMap]);
  useEffect(() => layer.hook(scene), [layer, scene]);
  return <><primitive object={layer.contacts} /><primitive object={layer.directed} /></>;
}

/** Soft tinted discs at fixed spots (rain puddles), the contact disc's shape without the shadow logic. */
function softDiscs(count: number) {
  const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  material.onBeforeCompile = shader => {
    discVertex(shader);
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `diffuseColor.a *= ${FALLOFF};\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => "soft-disc-v1";
  const mesh = new THREE.InstancedMesh(DISC, material, Math.max(count, 1));
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}
function layDiscs(mesh: THREE.InstancedMesh, spots: readonly (Ellipse & { y: number })[], color: string, opacity: number) {
  const material = mesh.material as THREE.MeshBasicMaterial;
  material.color.set(color);
  material.opacity = opacity;
  spots.forEach((s, i) => place(mesh, i, s, s.y + 0.03));
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
}

export function SoftDiscs({ spots, color, opacity }: { spots: readonly (Ellipse & { y: number })[]; color: string; opacity: number }) {
  const mesh = useMemo(() => softDiscs(spots.length), [spots.length]);
  useEffect(() => layDiscs(mesh, spots, color, opacity), [mesh, spots, color, opacity]);
  useEffect(() => () => (mesh.material as THREE.Material).dispose(), [mesh]);
  return <primitive object={mesh} />;
}
