"use client";

/**
 * The one runtime character (character-in-engine deliverables 1-2): the v6
 * rig and body with the hand-modeled v7 head, the catalogue parts a look
 * wears, the animated painted face (avatar v7: blinks, a talking mouth and
 * expressions as shader uniforms), and the clip state machine. Player, residents, applicants, the creator and the
 * wardrobe all render through this. Visual only: callers own movement and
 * write speed/yaw/pose/one-shots into `motion`.
 */
import { Suspense, useDeferredValue, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BASE_URL, FACE_ATLAS_URLS, PALETTE, TSI_DECAL_URL, CLIP_BY_NAME, bodyKey, resolveParts, type CharacterLook, type ResolvedPart } from "@/lib/game/character/look";
import { FaceAnimator, faceSlots, poseKey } from "@/lib/game/character/face";
import { createFaceMaterial, patchHairSheen, prepareFaceAtlas, type FaceMaterial } from "@/lib/game/character/faceMaterial";
import { SNAPPY_CLIPS, WEAPON_HAND, isLoop, resolveClip, tempo, type CharacterMotion, type ClipName } from "@/lib/game/character/clips";
import { adoptPrimitive, materialName, mergeLook, refCache, skinnedPrimitives } from "@/lib/game/character/rig";
import type { WeaponGrip, WeaponKind } from "@/lib/game/combat/contract";
import { tagLookClasses } from "@/lib/game/modelMaterials";
import { addContact } from "../ContactShadows";

export type { CharacterMotion, ClipName } from "@/lib/game/character/clips";
/** v6 is 1.045 m tall; at 1.3 a character stands ~1.36 world units, a little over one tile (ACNH). */
export const CHARACTER_SCALE = 1.3;
export const CHARACTER_HEIGHT = 1.045 * CHARACTER_SCALE;
/** A character's contact shadow: about its shoulders' width, its height for the Light tier's sun shadow. */
const CONTACT = { cx: 0, cz: 0, rx: 0.4, rz: 0.34, height: CHARACTER_HEIGHT, strength: 1 };

type Gltf = { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
// Double-sided: clothes, hoods and capes are open shells whose insides show (hair and hats are closed solids, whose
// tucked undersides stay behind the head). The shadow pass keeps back faces only, as for a front-sided material.
// Sculpted-lock hair draws its sheen band here (hairSheen attribute, faceMaterial.ts).
const BODY_MATERIAL = patchHairSheen(new THREE.MeshStandardMaterial({ name: "CharacterBody", vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, shadowSide: THREE.BackSide }));
let decalMaterial: THREE.MeshStandardMaterial | null = null;
const bodies = refCache<THREE.BufferGeometry>();
const decals = new Map<string, THREE.BufferGeometry>();

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
  private look: CharacterLook | null = null;
  private faceMat: FaceMaterial | null = null;
  private readonly faceAnim = new FaceAnimator();
  private faceLookKey = "";
  private shownFace = "";
  private action: THREE.AnimationAction | null = null;
  private clip: ClipName | null = null;
  private oneShot: ClipName | null = null;

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
      // Characters are solids that move: they cast the sun shadow every frame (SunShadows).
      mesh.castShadow = true;
      mesh.userData.sunCaster = "dynamic";
      // Lying and rolling clips leave the rest pose; one generous sphere keeps culling cheap and never clips a pose.
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 1.2);
      return mesh;
    };
    this.body = make(new THREE.BufferGeometry(), BODY_MATERIAL);
    this.face = make(facePrim.geometry, BODY_MATERIAL);
    this.decal = make(new THREE.BufferGeometry(), BODY_MATERIAL);
    // A print on the shirt, inside the body's silhouette: not a caster.
    this.decal.castShadow = false;
    delete this.decal.userData.sunCaster;
    this.body.visible = this.face.visible = this.decal.visible = false; // until dress()
    this.sockets = { R: this.root.getObjectByName("Socket_R_Hand")!, L: this.root.getObjectByName("Socket_L_Hand")!, Back: this.root.getObjectByName("Socket_Back")! };
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = new Map(base.animations.map(c => [c.name, c]));
  }

  dress(look: CharacterLook, parts: ResolvedPart[], scenes: THREE.Object3D[], atlas: THREE.Texture, decalMap: THREE.Texture) {
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
    // The face is one material per character over the shared atlas; a new look or atlas only re-uploads uniforms.
    if (!this.faceMat) this.faceMat = createFaceMaterial(atlas);
    this.faceMat.setAtlas(atlas);
    this.face.material = this.faceMat.material;
    this.look = look;
    this.faceLookKey = JSON.stringify([look.skin, look.hair, look.brows, look.eyes, look.mouth, look.extras]);
    this.shownFace = "";
  }

  /** Blink, talk and expression for this frame: uniform writes only, and only when the frame changes. */
  private animateFace(delta: number, clip: ClipName, motion: CharacterMotion) {
    if (!this.look || !this.faceMat) return;
    const talking = (motion.talk ?? 0) > 0;
    if (talking) motion.talk = Math.max(0, motion.talk! - delta);
    const pose = this.faceAnim.update(delta, this.look, clip, talking, motion.face);
    const key = `${this.faceLookKey}|${poseKey(pose)}`;
    if (key === this.shownFace) return;
    this.shownFace = key;
    this.faceMat.set(PALETTE.skin[this.look.skin], faceSlots(this.look, pose));
  }

  get attacking() { return !!this.clip?.startsWith("Attack"); }

  private play(name: ClipName) {
    const clip = this.clips.get(name) ?? this.clips.get("Idle")!;
    const next = this.mixer.clipAction(clip);
    const loop = isLoop(name);
    next.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.setEffectiveWeight(1).play();
    if (this.action && this.action !== next) this.action.crossFadeTo(next, SNAPPY_CLIPS.has(name) ? 0.06 : 0.16, false);
    this.action = next;
    this.clip = name;
  }

  update(delta: number, motion: CharacterMotion, walkSpeed: number) {
    let restart = false;
    // A looping clip asked for as a one-shot (Dance) holds as a pose; moving ends any pose.
    if (motion.stop) { this.oneShot = null; motion.stop = false; }
    if (motion.play && isLoop(motion.play)) { motion.pose = motion.play; motion.play = null; }
    if (motion.play) { this.oneShot = motion.play; motion.play = null; restart = true; }
    if (motion.speed >= 0.08) motion.pose = null;
    if (this.oneShot && this.clip === this.oneShot && !restart && this.action && this.action.time >= this.action.getClip().duration - 1e-3) this.oneShot = null;
    const want = resolveClip({ speed: motion.speed, walkSpeed, pose: motion.pose ?? null, oneShot: this.oneShot, move: motion.move });
    if (want !== this.clip || restart) this.play(want);
    this.action!.setEffectiveTimeScale(tempo(want, motion.speed, walkSpeed));
    this.animateFace(delta, want, motion);
    this.mixer.update(delta);
  }

  /** Also a reset: Strict Mode re-runs effects after this, so the next dress()/update() starts clean. */
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.action = null; this.clip = null; this.oneShot = null;
    if (this.bodyKey) bodies.release(this.bodyKey);
    this.faceMat?.dispose();
    this.faceMat = null;
    this.bodyKey = ""; this.shownFace = "";
  }
}

export interface WeaponView { kind: WeaponKind; model: string; modelScale: number; inHand: boolean; grip?: WeaponGrip }
/**
 * Weapon placement per kind in socket space (row 140): in hand in the ruins, across the back elsewhere.
 * Weapons are authored grip-at-origin, tip up +Y. `rest` is the in-hand pose outside attack clips: the
 * staff and bow stand upright (+Y world up, +Z forward, solved from the v6 Idle socket frames) instead
 * of pointing like a lance or lying flat; attack clips use `hand`.
 */
const GRIP: Record<WeaponKind, WeaponGrip> = {
  melee: { hand: [Math.PI / 2, 0, 0], back: [0, 0, 0.5] },
  bow: { hand: [0, Math.PI / 2, 0], back: [0, Math.PI / 2, 0.3], rest: [0.03, 0.24, 1.15] },
  staff: { hand: [Math.PI / 2, 0, 0], back: [0, 0, -0.5], rest: [0.03, -0.24, -1.15] },
  summon: { hand: [Math.PI / 2, 0, 0], back: [0, 0, -0.5] },
};
const gripQ = new THREE.Quaternion(), gripE = new THREE.Euler();

function HeldWeapon({ puppet, weapon: { kind, model: url, modelScale, inHand, grip } }: { puppet: Puppet; weapon: WeaponView }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => tagLookClasses(scene.clone(true), url), [scene, url]);
  useEffect(() => {
    placeWeapon(model, { kind, model: url, modelScale, inHand, grip }, inHand ? puppet.sockets[WEAPON_HAND[kind]] : puppet.sockets.Back);
    return () => { model.removeFromParent(); };
  }, [model, puppet, kind, url, modelScale, inHand, grip]);
  // Upright at rest, the attack grip while an attack clip plays (eased so the swap doesn't pop).
  useFrame((_, delta) => {
    const g = grip ?? GRIP[kind];
    if (!inHand || !g.rest) return;
    model.quaternion.slerp(gripQ.setFromEuler(gripE.set(...(puppet.attacking ? g.hand : g.rest))), 1 - Math.exp(-delta * 24));
  });
  return null;
}
function placeWeapon(model: THREE.Object3D, weapon: WeaponView, socket: THREE.Object3D) {
  const g = weapon.grip ?? GRIP[weapon.kind];
  model.scale.setScalar(weapon.modelScale / CHARACTER_SCALE);
  model.rotation.set(...(weapon.inHand ? g.hand : g.back));
  // Part of the character's silhouette: it casts with them.
  model.traverse(o => { o.castShadow = true; o.userData.sunCaster = "dynamic"; });
  socket.add(model);
}

/** The leaf glider (art/props-enemies/build_leaf_glider.py): authored grip-at-origin for the right hand in the Glide clip. */
export const LEAF_URL = "/assets/game/props/leaf-glider.glb";
const gripAt = new THREE.Vector3();
/**
 * The leaf on the right hand: at the hand socket's position but on the character's own axes (the stem stands up past
 * the head whatever the wrist does), sized by `motion.leaf` from the grip, so it grows out of the hand as it opens and
 * lifts a little as it pops past full size.
 */
function HeldLeaf({ puppet, motion, scale }: { puppet: Puppet; motion: RefObject<CharacterMotion>; scale: number }) {
  const { scene } = useGLTF(LEAF_URL);
  const model = useMemo(() => tagLookClasses(scene.clone(true), LEAF_URL), [scene]);
  useEffect(() => { model.traverse(o => { o.castShadow = true; o.userData.sunCaster = "dynamic"; }); }, [model]);
  useFrame(() => placeLeaf(model, puppet.sockets.R, motion.current?.leaf ?? 0, scale));
  return <primitive object={model} />;
}
function placeLeaf(model: THREE.Object3D, hand: THREE.Object3D, open: number, scale: number) {
  model.visible = open > 0.01 && !!model.parent;
  if (!model.visible) return;
  model.parent!.worldToLocal(hand.getWorldPosition(gripAt));
  model.position.copy(gripAt).setY(gripAt.y + Math.max(0, open - 1) * 0.6 * scale);
  model.scale.setScalar(scale * Math.min(open, 1.15));
}

export interface CharacterProps {
  look: CharacterLook;
  motion: RefObject<CharacterMotion>;
  /** Normal walking pace for this controller (Walk plays at 1x there). */
  walkSpeed?: number;
  weapon?: WeaponView | null;
  /** Owns the leaf glider: the leaf shows while `motion.leaf` is open. */
  leaf?: boolean;
  /** Face atlas density: 512 px per face canvas in the world (sharp at village distance), 1024 in the creator. */
  faceSize?: number;
  scale?: number;
}

export default function Character({ look, motion, walkSpeed = 7.4, weapon = null, leaf = false, faceSize = 512, scale = CHARACTER_SCALE }: CharacterProps) {
  // While a newly chosen part loads, keep showing the previous look instead of suspending.
  const shown = useDeferredValue(look);
  const parts = useMemo(() => resolveParts(shown), [shown]);
  const loaded = useGLTF([BASE_URL, ...parts.map(p => p.url)]) as unknown as Gltf[];
  const atlas = useLoader(THREE.TextureLoader, faceSize >= 1024 ? FACE_ATLAS_URLS.creator : FACE_ATLAS_URLS.world);
  const decalMap = useLoader(THREE.TextureLoader, TSI_DECAL_URL);
  const base = loaded[0];
  const puppet = useMemo(() => new Puppet(base), [base]);
  useEffect(() => () => puppet.dispose(), [puppet]);
  useEffect(() => {
    dressPuppet(puppet, shown, parts, loaded.slice(1).map(g => g.scene), atlas, decalMap);
  }, [puppet, shown, parts, loaded, atlas, decalMap]);
  const group = useRef<THREE.Group>(null);
  // The contact sits under the caller's anchor (ground level), not the group that lifts for seats and hops.
  const scene = useThree(s => s.scene);
  useEffect(() => {
    const anchor = group.current?.parent;
    return anchor ? addContact(scene, anchor, CONTACT) : undefined;
  }, [scene]);
  useFrame((_, delta) => {
    const m = motion.current, g = group.current;
    if (!m || !g) return;
    g.rotation.y = m.yaw;
    g.position.y = m.lift;
    puppet.update(Math.min(delta, 0.1) * (m.rate ?? 1), m, walkSpeed);
  });
  return <group ref={group}>
    <primitive object={puppet.root} scale={scale} dispose={null} />
    {weapon && <HeldWeapon puppet={puppet} weapon={weapon} />}
    {/* Its own boundary: crafting the glider mid-session must not suspend the scene while the leaf loads. */}
    {leaf && <Suspense fallback={null}><HeldLeaf puppet={puppet} motion={motion} scale={scale} /></Suspense>}
  </group>;
}
function dressPuppet(puppet: Puppet, look: CharacterLook, parts: ResolvedPart[], scenes: THREE.Object3D[], atlas: THREE.Texture, decalMap: THREE.Texture) {
  decalMap.flipY = false;
  decalMap.colorSpace = THREE.SRGBColorSpace;
  if (atlas.flipY) prepareFaceAtlas(atlas); // once per (shared) atlas texture
  puppet.dress(look, parts, scenes, atlas, decalMap);
}

/** Warm the loader for a set of looks (creator pages, residents) so switching never shows a gap. */
export function preloadLooks(looks: CharacterLook[]) {
  useGLTF.preload(BASE_URL);
  for (const look of looks) for (const p of resolveParts(look)) useGLTF.preload(p.url);
}
export const clipLength = (name: ClipName) => CLIP_BY_NAME.get(name)?.length ?? 1;
