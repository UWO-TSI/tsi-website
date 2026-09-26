"use client";

/**
 * The one runtime character (character-in-engine deliverables 1-2): the v6
 * rig with the catalogue parts a look wears, a composed face texture, and
 * the clip state machine. Player, residents, applicants, the creator and the
 * wardrobe all render through this. Visual only: callers own movement and
 * write speed/yaw/pose/one-shots into `motion`.
 */
import { useDeferredValue, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BASE_URL, FACE_ATLAS_URL, PALETTE, TSI_DECAL_URL, CLIP_BY_NAME, bodyKey, faceKey, resolveParts, type CharacterLook, type ResolvedPart } from "@/lib/game/character/look";
import { CLIP_EXPRESSION, composeFace, type Ctx2D, type Expression } from "@/lib/game/character/face";
import { WEAPON_HAND, isLoop, resolveClip, tempo, type CharacterMotion, type ClipName } from "@/lib/game/character/clips";
import { adoptPrimitive, materialName, mergeLook, refCache, skinnedPrimitives } from "@/lib/game/character/rig";
import type { WeaponKind } from "@/lib/game/combat/contract";

export type { CharacterMotion, ClipName } from "@/lib/game/character/clips";
/** v6 is 1.045 m tall; at 1.3 a character stands ~1.36 world units, a little over one tile (ACNH). */
export const CHARACTER_SCALE = 1.3;
export const CHARACTER_HEIGHT = 1.045 * CHARACTER_SCALE;

type Gltf = { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
const BODY_MATERIAL = new THREE.MeshStandardMaterial({ name: "CharacterBody", vertexColors: true, roughness: 0.85, metalness: 0 });
let decalMaterial: THREE.MeshStandardMaterial | null = null;
const bodies = refCache<THREE.BufferGeometry>();
const faces = refCache<{ material: THREE.MeshStandardMaterial; dispose(): void }>();
const decals = new Map<string, THREE.BufferGeometry>();

function faceMaterial(atlas: HTMLImageElement, look: CharacterLook, expression: Expression, size: number) {
  const canvas = document.createElement("canvas"), scratch = document.createElement("canvas");
  canvas.width = canvas.height = scratch.width = scratch.height = size;
  composeFace(canvas.getContext("2d") as Ctx2D, { ctx: scratch.getContext("2d") as Ctx2D, image: scratch }, atlas, look, expression, size);
  const map = new THREE.CanvasTexture(canvas);
  map.flipY = false; // glTF UV convention, like the texture the GLB embeds
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ name: "CharacterFace", map, roughness: 0.85, metalness: 0 });
  return { material, dispose() { map.dispose(); material.dispose(); } };
}

/** One character instance: its own bones and mixer, shared geometry/materials. */
class Puppet {
  readonly root: THREE.Object3D;
  readonly sockets: Record<"R" | "L" | "Back", THREE.Object3D>;
  private readonly mixer: THREE.AnimationMixer;
  private readonly clips: Map<string, THREE.AnimationClip>;
  private readonly bones: THREE.Bone[];
  private readonly body: THREE.SkinnedMesh;
  private readonly face: THREE.SkinnedMesh;
  private readonly decal: THREE.SkinnedMesh;
  private bodyKey = "";
  private faceKey = "";
  private held = new Map<Expression, { key: string; material: THREE.MeshStandardMaterial }>();
  private look: CharacterLook | null = null;
  private atlas: HTMLImageElement | null = null;
  private faceSize = 256;
  private action: THREE.AnimationAction | null = null;
  private clip: ClipName | null = null;
  private oneShot: ClipName | null = null;
  private expression: Expression = "neutral";
  private blinkAt = 1 + Math.random() * 3;
  private clock = 0;

  constructor(private readonly base: Gltf) {
    this.root = cloneSkinned(base.scene);
    const prims = skinnedPrimitives(this.root);
    const first = prims[0], skeleton = first.skeleton, parent = first.parent!;
    const facePrim = prims.find(m => materialName(m) === "M_Face")!;
    prims.forEach(m => m.removeFromParent());
    this.bones = skeleton.bones;
    const make = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
      const mesh = new THREE.SkinnedMesh(geometry, material);
      parent.add(mesh);
      mesh.bind(skeleton, first.bindMatrix);
      mesh.receiveShadow = true;
      // Lying and rolling clips leave the rest pose; one generous sphere keeps culling cheap and never clips a pose.
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 1.2);
      return mesh;
    };
    this.body = make(new THREE.BufferGeometry(), BODY_MATERIAL);
    this.face = make(facePrim.geometry, BODY_MATERIAL);
    this.decal = make(new THREE.BufferGeometry(), BODY_MATERIAL);
    this.body.visible = this.face.visible = this.decal.visible = false; // until dress()
    this.sockets = { R: this.root.getObjectByName("Socket_R_Hand")!, L: this.root.getObjectByName("Socket_L_Hand")!, Back: this.root.getObjectByName("Socket_Back")! };
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = new Map(base.animations.map(c => [c.name, c]));
  }

  dress(look: CharacterLook, parts: ResolvedPart[], scenes: THREE.Object3D[], atlas: HTMLImageElement, decalMap: THREE.Texture, faceSize: number) {
    const key = bodyKey(look);
    if (key !== this.bodyKey) {
      const pieces = [{ root: this.base.scene, tints: { M_Skin: PALETTE.skin[look.skin] }, keep: (m: string) => m === "M_Skin" },
        ...parts.map((p, i) => ({ root: scenes[i], tints: p.tints, keep: (m: string) => m !== "M_Decal" }))];
      this.body.geometry = bodies.acquire(key, () => mergeLook(pieces, this.bones));
      if (this.bodyKey) bodies.release(this.bodyKey);
      this.bodyKey = key;
      this.body.visible = this.face.visible = true;
      const decalPart = parts.findIndex(p => p.decal);
      this.decal.visible = decalPart >= 0;
      if (decalPart >= 0) {
        const id = parts[decalPart].id;
        const prim = skinnedPrimitives(scenes[decalPart]).find(m => materialName(m) === "M_Decal");
        if (prim && !decals.has(id)) decals.set(id, adoptPrimitive(prim, new Map(this.bones.map((b, i) => [b.name, i])), null));
        this.decal.geometry = decals.get(id) ?? this.decal.geometry;
        decalMaterial ??= new THREE.MeshStandardMaterial({ name: "CharacterDecal", map: decalMap, alphaTest: 0.5, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        this.decal.material = decalMaterial;
      }
    }
    const fk = `${faceKey(look)}|${faceSize}`;
    if (fk !== this.faceKey) {
      this.releaseFaces();
      this.faceKey = fk; this.look = look; this.atlas = atlas; this.faceSize = faceSize;
      this.showExpression(this.expression, true);
    }
  }

  /** Face textures are composed on first use and kept while this character wears the face (blinks reuse them). */
  private showExpression(expression: Expression, force = false) {
    if (!this.look || (!force && expression === this.expression)) return;
    let held = this.held.get(expression);
    if (!held) {
      const key = `${this.faceKey}|${expression}`, { look, atlas, faceSize } = this;
      held = { key, material: faces.acquire(key, () => faceMaterial(atlas!, look, expression, faceSize)).material };
      this.held.set(expression, held);
    }
    this.face.material = held.material;
    this.expression = expression;
  }
  private releaseFaces() { for (const { key } of this.held.values()) faces.release(key); this.held.clear(); }

  private play(name: ClipName) {
    const clip = this.clips.get(name) ?? this.clips.get("Idle")!;
    const next = this.mixer.clipAction(clip);
    const loop = isLoop(name);
    next.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.setEffectiveWeight(1).play();
    if (this.action && this.action !== next) this.action.crossFadeTo(next, name === "DodgeRoll" || name === "Hit" ? 0.06 : 0.16, false);
    this.action = next;
    this.clip = name;
  }

  update(delta: number, motion: CharacterMotion, walkSpeed: number) {
    this.clock += delta;
    let restart = false;
    // A looping clip asked for as a one-shot (Dance) holds as a pose; moving ends any pose.
    if (motion.play && isLoop(motion.play)) { motion.pose = motion.play; motion.play = null; }
    if (motion.play) { this.oneShot = motion.play; motion.play = null; restart = true; }
    if (motion.speed >= 0.08) motion.pose = null;
    if (this.oneShot && this.clip === this.oneShot && !restart && this.action && this.action.time >= this.action.getClip().duration - 1e-3) this.oneShot = null;
    const want = resolveClip({ speed: motion.speed, walkSpeed, pose: motion.pose ?? null, oneShot: this.oneShot });
    if (want !== this.clip || restart) this.play(want);
    this.action!.setEffectiveTimeScale(tempo(want, motion.speed, walkSpeed));
    let expression = CLIP_EXPRESSION[want] ?? "neutral";
    if (expression === "neutral" && this.clock > this.blinkAt) {
      expression = "blink";
      if (this.clock > this.blinkAt + 0.13) { this.blinkAt = this.clock + 2.5 + Math.random() * 3.5; expression = "neutral"; }
    }
    this.showExpression(expression);
    this.mixer.update(delta);
  }

  /** Also a reset: Strict Mode re-runs effects after this, so the next dress()/update() starts clean. */
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.action = null; this.clip = null; this.oneShot = null;
    if (this.bodyKey) bodies.release(this.bodyKey);
    this.releaseFaces();
    this.bodyKey = ""; this.faceKey = "";
  }
}

export interface WeaponView { kind: WeaponKind; model: string; modelScale: number; inHand: boolean }
/** Weapon placement per kind in socket space (row 140): in hand in the ruins, across the back elsewhere. */
const GRIP: Record<WeaponKind, { hand: [number, number, number]; back: [number, number, number] }> = {
  melee: { hand: [Math.PI / 2, 0, 0], back: [0, 0, 0.5] },
  bow: { hand: [0, Math.PI / 2, 0], back: [0, Math.PI / 2, 0.3] },
  staff: { hand: [Math.PI / 2, 0, 0], back: [0, 0, 2.6] },
  summon: { hand: [Math.PI / 2, 0, 0], back: [0, 0, 2.6] },
};

function HeldWeapon({ puppet, weapon: { kind, model: url, modelScale, inHand } }: { puppet: Puppet; weapon: WeaponView }) {
  const { scene } = useGLTF(url);
  useEffect(() => {
    const model = scene.clone(true);
    placeWeapon(model, { kind, model: url, modelScale, inHand }, inHand ? puppet.sockets[WEAPON_HAND[kind]] : puppet.sockets.Back);
    return () => { model.removeFromParent(); };
  }, [scene, puppet, kind, url, modelScale, inHand]);
  return null;
}
function placeWeapon(model: THREE.Object3D, weapon: WeaponView, socket: THREE.Object3D) {
  model.scale.setScalar(weapon.modelScale / CHARACTER_SCALE);
  model.rotation.set(...(weapon.inHand ? GRIP[weapon.kind].hand : GRIP[weapon.kind].back));
  model.traverse(o => { o.castShadow = false; });
  socket.add(model);
}

export interface CharacterProps {
  look: CharacterLook;
  motion: RefObject<CharacterMotion>;
  /** Normal walking pace for this controller (Walk plays at 1x there). */
  walkSpeed?: number;
  weapon?: WeaponView | null;
  /** Face texture resolution: 256 in the world, 512 in close-up views. */
  faceSize?: number;
  scale?: number;
}

export default function Character({ look, motion, walkSpeed = 7.4, weapon = null, faceSize = 256, scale = CHARACTER_SCALE }: CharacterProps) {
  // While a newly chosen part loads, keep showing the previous look instead of suspending.
  const shown = useDeferredValue(look);
  const parts = useMemo(() => resolveParts(shown), [shown]);
  const loaded = useGLTF([BASE_URL, ...parts.map(p => p.url)]) as unknown as Gltf[];
  const atlas = useLoader(THREE.ImageLoader, FACE_ATLAS_URL);
  const decalMap = useLoader(THREE.TextureLoader, TSI_DECAL_URL);
  const base = loaded[0];
  const puppet = useMemo(() => new Puppet(base), [base]);
  useEffect(() => () => puppet.dispose(), [puppet]);
  useEffect(() => {
    dressPuppet(puppet, shown, parts, loaded.slice(1).map(g => g.scene), atlas, decalMap, faceSize);
  }, [puppet, shown, parts, loaded, atlas, decalMap, faceSize]);
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const m = motion.current, g = group.current;
    if (!m || !g) return;
    g.rotation.y = m.yaw;
    g.position.y = m.lift;
    puppet.update(Math.min(delta, 0.1), m, walkSpeed);
  });
  return <group ref={group}>
    <primitive object={puppet.root} scale={scale} dispose={null} />
    {weapon && <HeldWeapon puppet={puppet} weapon={weapon} />}
  </group>;
}
function dressPuppet(puppet: Puppet, look: CharacterLook, parts: ResolvedPart[], scenes: THREE.Object3D[], atlas: HTMLImageElement, decalMap: THREE.Texture, faceSize: number) {
  decalMap.flipY = false;
  decalMap.colorSpace = THREE.SRGBColorSpace;
  puppet.dress(look, parts, scenes, atlas, decalMap, faceSize);
}

/** Warm the loader for a set of looks (creator pages, residents) so switching never shows a gap. */
export function preloadLooks(looks: CharacterLook[]) {
  useGLTF.preload(BASE_URL);
  for (const look of looks) for (const p of resolveParts(look)) useGLTF.preload(p.url);
}
export const clipLength = (name: ClipName) => CLIP_BY_NAME.get(name)?.length ?? 1;
