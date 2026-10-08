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
import type { WeaponPaint } from "@/lib/game/combat/primitives";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BASE_URL, FACE_ATLAS_URLS, LOD_SKIN_URL, PALETTE, TSI_DECAL_URL, CLIP_BY_NAME, VERBS_URL, bodyKey, resolveParts, type CharacterLook, type ResolvedPart } from "@/lib/game/character/look";
import { characterLod, createLodState, drawnHeight, mixerStep } from "@/lib/game/character/lod";
import { quality } from "@/lib/game/perf/governor";
import { FaceAnimator, faceSlots, poseKey } from "@/lib/game/character/face";
import { createFaceMaterial, MATTE, prepareFaceAtlas, type FaceMaterial } from "@/lib/game/character/faceMaterial";
import { ATTACK_CLIP, WEAPON_HAND, contactCrossed, crossfade, holdLayer, isLoop, layerTrack, layerWeight, matchPhase, resolveClip, tempo, verbInfo, type CharacterMotion, type ClipName, type Layer } from "@/lib/game/character/clips";
import { adoptPrimitive, materialName, mergeLook, refCache, skinnedPrimitives } from "@/lib/game/character/rig";
import type { WeaponGrip, WeaponKind } from "@/lib/game/combat/contract";
import { tagLookClasses } from "@/lib/game/modelMaterials";
import { addContact } from "../ContactShadows";
import { frameStats } from "@/lib/game/perf/frameStats";
import FishingRig from "./FishingRig";

export type { CharacterMotion, ClipName } from "@/lib/game/character/clips";
/** v6 is 1.045 m tall; at 1.3 a character stands ~1.36 world units, a little over one tile (ACNH). */
export const CHARACTER_SCALE = 1.3;
export const CHARACTER_HEIGHT = 1.045 * CHARACTER_SCALE;
/** A character's contact shadow: about its shoulders' width, its height for the Light tier's sun shadow. */
const CONTACT = { cx: 0, cz: 0, rx: 0.4, rz: 0.34, height: CHARACTER_HEIGHT, strength: 1 };

type Gltf = { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
// Double-sided: clothes, hoods and capes are open shells whose insides show (hair and hats are closed solids, whose
// tucked undersides stay behind the head). The shadow pass keeps back faces only, as for a front-sided material.
const BODY_MATERIAL = new THREE.MeshPhysicalMaterial({ name: "CharacterBody", vertexColors: true, ...MATTE, side: THREE.DoubleSide, shadowSide: THREE.BackSide });
let decalMaterial: THREE.MeshPhysicalMaterial | null = null;
const bodies = refCache<THREE.BufferGeometry>();
const decals = new Map<string, THREE.BufferGeometry>();

/** A dash's afterimage (specs/movement-feel.md): how long it lasts and how strong it starts. Faint, short, matte. */
const GHOST = { life: 0.2, opacity: 0.17, rise: 0.04 };
/**
 * A frozen copy of the pose: the body and face drawn again with the bone matrices of one frame. The skeleton never
 * updates (its matrices are copied in); attached binding cancels the mesh's own transform, so it stays where it was.
 *
 * It never films over the character, even dashing away from the camera with the afterimage between the two: it
 * blends in the opaque pass (custom blending, no depth written) after the world (render order 1) and before the
 * character that leaves it (`GHOST_ORDER` + 1), so the character draws over it wherever they overlap.
 */
const GHOST_ORDER = 1;
const ghostM = new THREE.Matrix4(), toLocal = new THREE.Matrix4();
class Ghost {
  readonly skeleton: THREE.Skeleton;
  readonly meshes: THREE.SkinnedMesh[];
  readonly material = new THREE.MeshLambertMaterial({ color: "#dfe8f1", emissive: "#8ea3b8", emissiveIntensity: 0.18, transparent: false, blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, opacity: 0, depthWrite: false });
  age = GHOST.life;
  /** Frames left to draw it unseen (opacity 0) so its shader compiles before the first dash. */
  private warm = 1;
  constructor(live: THREE.Skeleton, bindMatrix: THREE.Matrix4, parent: THREE.Object3D, geometries: THREE.BufferGeometry[]) {
    this.skeleton = new THREE.Skeleton(live.bones, live.boneInverses);
    this.skeleton.update = () => {};
    this.meshes = geometries.map(geometry => {
      const m = new THREE.SkinnedMesh(geometry, this.material);
      m.bind(this.skeleton, bindMatrix);
      m.frustumCulled = false;
      m.visible = false;
      m.renderOrder = GHOST_ORDER;
      parent.add(m);
      return m;
    });
  }
  /** `world`: the live body's world matrix (its bone matrices are relative to it, Puppet.uploadPose); the afterimage keeps them in the world. */
  snap(live: THREE.Skeleton, geometries: THREE.BufferGeometry[], world: THREE.Matrix4) {
    if (!live.boneMatrices || !this.skeleton.boneMatrices) return;
    for (let i = 0; i < live.bones.length; i++) ghostM.fromArray(live.boneMatrices, i * 16).premultiply(world).toArray(this.skeleton.boneMatrices, i * 16);
    if (this.skeleton.boneTexture) this.skeleton.boneTexture.needsUpdate = true;
    geometries.forEach((g, i) => { this.meshes[i].geometry = g; });
    this.age = 0;
  }
  update(delta: number) {
    this.age += delta;
    // Eases in while you leave it (so it never films over you), then fades.
    const k = Math.max(0, 1 - this.age / GHOST.life), inn = Math.min(1, this.age / GHOST.rise);
    this.material.opacity = GHOST.opacity * inn * k * k;
    for (const m of this.meshes) m.visible = k > 0 || this.warm > 0;
    if (this.warm > 0) this.warm--;
  }
  dispose() { this.material.dispose(); this.skeleton.boneTexture?.dispose(); for (const m of this.meshes) m.removeFromParent(); }
}

/** A vertex skinned for a raycast, in the mesh's own space (the bones' world pose, less where the mesh is now). */
function localBoneTransform(this: THREE.SkinnedMesh, index: number, target: THREE.Vector3) {
  THREE.SkinnedMesh.prototype.applyBoneTransform.call(this, index, target);
  return target.applyMatrix4(toLocal.copy(this.matrixWorld).invert());
}

/** What a look merges (rig.ts mergeLook): the base's skin in the look's skin colour, then each part but its print. */
function lookPieces(look: CharacterLook, parts: ResolvedPart[], base: THREE.Object3D, scenes: THREE.Object3D[]) {
  return [{ root: base, tints: { M_Skin: PALETTE.skin[look.skin] }, keep: (m: string) => m === "M_Skin" },
    ...parts.map((p, i) => ({ root: scenes[i], tints: p.tints, keep: (m: string) => m !== "M_Decal" }))];
}

/** One character instance: its own bones and mixer, shared geometry/materials. */
class Puppet {
  readonly root: THREE.Object3D;
  readonly sockets: Record<"R" | "L" | "Back", THREE.Object3D>;
  private readonly mixer: THREE.AnimationMixer;
  private readonly clips: Map<string, THREE.AnimationClip>;
  /** What a verb clip plays until the verb library has loaded (the legacy attack clip for the weapon in hand). */
  fallback: ClipName = "AttackMelee";
  private readonly bones: THREE.Bone[];
  private readonly body: THREE.SkinnedMesh;
  private readonly face: THREE.SkinnedMesh;
  private readonly decal: THREE.SkinnedMesh;
  private bodyKey = "";
  /** The look's full merged geometry, and its LOD 1 (lod.ts: drawn while the character is small) once its GLBs load. */
  private full: THREE.BufferGeometry | null = null;
  private lodGeometry: THREE.BufferGeometry | null = null;
  private lodKey = "";
  /** Detail by screen size this frame (lod.ts). */
  readonly lod = createLodState();
  private look: CharacterLook | null = null;
  private faceMat: FaceMaterial | null = null;
  private readonly faceAnim = new FaceAnimator();
  private faceLookKey = "";
  private shownFace = "";
  private action: THREE.AnimationAction | null = null;
  private clip: ClipName | null = null;
  private oneShot: ClipName | null = null;
  private oneShotRate = 1;
  /** The upper-body one-shot (`motion.upper`): its clip, clock and timing scale; laid over the spine up after the mixer. */
  private upperClip: ClipName | null = null;
  private upperT = 0;
  private upperRate = 1;
  private readonly skeleton: THREE.Skeleton;
  /** The GLB's bind matrix, folded into the bone matrices (the meshes bind detached at identity). */
  private readonly bind: THREE.Matrix4;
  /** The bones moved since the pose was last uploaded (Puppet.update ran). */
  private posed = true;
  private readonly ghostParent: THREE.Object3D;
  private readonly ghosts: Ghost[] = [];
  private ghostNext = 0;
  /** While faded (motion.fade < 1): the body's and print's own translucent copies of the shared materials, and the materials they replaced. */
  private faded: { body: THREE.MeshPhysicalMaterial; decal: THREE.MeshPhysicalMaterial | null; was: { body: THREE.Material; decal: THREE.Material } } | null = null;
  /** The arm hold laid over locomotion (specs/game-ui.md §2): its clip (kept while it eases out) and weight. */
  private holdClip: ClipName | null = null;
  private holdShown: ClipName | null = null;
  private holdW = 0;
  private holdT = 0;
  /** A clip's tracks on one overlay layer's bones, sampled live (the arm holds, the upper-body one-shot). */
  private readonly layerTracks = new Map<string, { bone: THREE.Bone; at: THREE.Interpolant }[]>();
  /** Held items put away: they shrink into the hand before they go (never a pop). */
  private readonly retiring: { model: THREE.Object3D; t: number; from: number }[] = [];

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
      // Bone matrices relative to the body (uploadPose), so a pose that hasn't changed is never uploaded again, however
      // the character moves: detached, with the bind folded into the bones. Raycasts (a resident's click) still meet
      // the mesh in its own space.
      mesh.bindMode = THREE.DetachedBindMode;
      mesh.bindMatrix.identity(); mesh.bindMatrixInverse.identity();
      mesh.applyBoneTransform = localBoneTransform;
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
    this.skeleton = skeleton;
    this.bind = first.bindMatrix.clone();
    skeleton.update = () => this.uploadPose();
    // Two afterimages, made when first asked for (only the player dashes).
    this.ghostParent = parent;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = new Map(base.animations.map(c => [c.name, c]));
  }

  dress(look: CharacterLook, parts: ResolvedPart[], scenes: THREE.Object3D[], atlas: THREE.Texture, decalMap: THREE.Texture) {
    const key = bodyKey(look);
    if (key !== this.bodyKey) {
      this.full = bodies.acquire(key, () => mergeLook(lookPieces(look, parts, this.base.scene, scenes), this.bones));
      this.body.geometry = this.full;
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
        decalMaterial ??= new THREE.MeshPhysicalMaterial({ name: "CharacterDecal", map: decalMap, alphaTest: 0.5, ...MATTE, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        this.decal.material = decalMaterial;
      }
    }
    // The face is one material per character over the shared atlas; a new look or atlas only re-uploads uniforms.
    if (!this.faceMat) this.faceMat = createFaceMaterial(atlas);
    this.faceMat.setAtlas(atlas);
    this.face.material = this.faceMat.material;
    this.look = look;
    this.faceLookKey = JSON.stringify([look.skin, look.hair, look.brows, look.eyes, look.mouth, look.extras, look.place ?? null]);
    this.shownFace = "";
  }

  /** The look's LOD 1 (Character's LodMesh, once its GLBs load): the LOD skin and each part's scene. Drawn only while it matches the look shown. */
  setLod(look: CharacterLook, parts: ResolvedPart[], skin: THREE.Object3D, scenes: THREE.Object3D[]) {
    const key = `${bodyKey(look)}|lod1`;
    if (key === this.lodKey) return;
    this.lodGeometry = bodies.acquire(key, () => mergeLook(lookPieces(look, parts, skin, scenes), this.bones));
    if (this.lodKey) bodies.release(this.lodKey);
    this.lodKey = key;
  }

  /**
   * Where the character is this frame (lod.ts: `d` from the camera, `px` drawn tall, in view or not): the LOD 1 mesh
   * when far and small (for this look only), and no sun shadow when tiny (SunShadows skips a caster marked
   * `shadowCulled`; its contact shadow stays).
   */
  view(d: number, px: number, visible: boolean) {
    const s = characterLod(this.lod, d, px, visible);
    const g = s.lod && this.lodGeometry && this.lodKey === `${this.bodyKey}|lod1` ? this.lodGeometry : this.full;
    if (g && this.body.geometry !== g) this.body.geometry = g;
    if (g === this.lodGeometry) frameStats.lodMeshes++;
    if (s.hz !== Infinity) frameStats.throttled++;
    this.body.userData.shadowCulled = this.face.userData.shadowCulled = !s.shadow;
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

  /** The weapon takes its attack grip while an attack clip or a verb plays, on the body or the upper body. */
  get attacking() { return !!this.clip?.startsWith("Attack") || !!(this.clip && verbInfo(this.clip)) || !!this.upperClip; }

  /** The verb library's clips (Character `verbs`), merged in when its GLB arrives. */
  addClips(list: THREE.AnimationClip[]) { for (const c of list) this.clips.set(c.name, c); }
  /** A clip, or for a verb not loaded yet the fallback attack clip. */
  private clipFor(name: ClipName) { return this.clips.get(name) ?? (verbInfo(name) && !name.startsWith("HoldIdle_") ? this.clips.get(this.fallback) : undefined); }
  /** The clip showing now (a held item picks its grip and whether it shows from it). */
  get current() { return this.clip; }

  /** A clip's tracks on a layer's bones (clips.ts LAYER_BONES), sampled live: a tool's hold the right arm, two-handed holds both, the upper body the spine up. */
  private tracks(clip: THREE.AnimationClip, layer: Layer) {
    const key = `${clip.name}|${layer}`;
    let list = this.layerTracks.get(key);
    if (list) return list;
    list = clip.tracks.filter(t => layerTrack(layer, t.name)).flatMap(t => {
      const bone = this.bones.find(b => b.name === t.name.slice(0, t.name.indexOf(".")));
      return bone ? [{ bone, at: new THREE.QuaternionLinearInterpolant(t.times, t.values, 4, new Float32Array(4)) }] : [];
    });
    this.layerTracks.set(key, list);
    return list;
  }

  /**
   * Lay the hold over the arms (after the mixer): on while walking, running, idling or in the air; off in an action, a
   * seat or a slide. A held tool's hold wins over the one asked for (`motion.hold`, a grip's HoldIdle in the ruins).
   */
  private hold(delta: number, want: ClipName, asked: ClipName | null) {
    const name = this.holdClip ?? asked;
    if (name && this.clips.has(name)) this.holdShown = name;
    const on = !!name && HOLD_OVER.has(want) && !this.oneShot && !this.upperClip;
    this.holdW += ((on ? 1 : 0) - this.holdW) * (1 - Math.exp(-14 * delta));
    if (this.holdW < 0.002 || !this.holdShown) return;
    const clip = this.clips.get(this.holdShown);
    if (!clip) return;
    this.holdT = (this.holdT + delta) % clip.duration;
    for (const { bone, at } of this.tracks(clip, holdLayer(this.holdShown))) bone.quaternion.slerp(holdQ.fromArray(at.evaluate(this.holdT)), this.holdW);
  }

  /** The upper-body one-shot (after the mixer and the hold): the spine up eases into it over 0.05 s and back out over its last 0.1 s. */
  private upper(delta: number) {
    if (!this.upperClip) return;
    const clip = this.clipFor(this.upperClip);
    this.upperT += delta * this.upperRate;
    if (!clip || this.upperT >= clip.duration) { this.upperClip = null; return; }
    const w = layerWeight(this.upperT, clip.duration);
    for (const { bone, at } of this.tracks(clip, "upper")) bone.quaternion.slerp(holdQ.fromArray(at.evaluate(this.upperT)), w);
  }

  /** Take out a held item: its grip's arm hold, until it is put away (`release` with the same clip). */
  takeOut(model: THREE.Object3D, grip: Grip) {
    const leaving = this.retiring.findIndex(r => r.model === model); // Strict Mode's second mount: the same model back
    if (leaving >= 0) this.retiring.splice(leaving, 1);
    model.position.set(...(grip.offset ?? [0, 0, 0]));
    model.rotation.set(...grip.rotation);
    model.scale.setScalar(0);
    this.sockets.R.add(model);
    this.holdClip = grip.clip;
  }
  putAway(model: THREE.Object3D, grip: Grip) {
    if (this.holdClip === grip.clip) this.holdClip = null;
    this.retire(model);
  }
  /** A held item put away: it shrinks into the hand over a moment, then leaves. */
  retire(model: THREE.Object3D) { this.retiring.push({ model, t: 0, from: model.scale.x }); }
  private retireStep(delta: number) {
    for (let i = this.retiring.length - 1; i >= 0; i--) {
      const r = this.retiring[i];
      r.t += delta;
      const k = Math.max(0, 1 - r.t / HELD_OUT);
      r.model.scale.setScalar(r.from * k * k);
      if (k === 0) { r.model.removeFromParent(); this.retiring.splice(i, 1); }
    }
  }

  private play(name: ClipName) {
    const clip = this.clipFor(name) ?? this.clips.get("Idle")!;
    const next = this.mixer.clipAction(clip);
    const loop = isLoop(name);
    // Walk, run and crouch-walk hand over in step: the next loop starts with the same foot where this one had it.
    const prev = this.action, phase = prev ? matchPhase(this.clip, prev.time / prev.getClip().duration, name) : null;
    next.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    if (phase !== null) next.time = phase * clip.duration;
    next.clampWhenFinished = !loop;
    next.setEffectiveWeight(1).play();
    if (this.action && this.action !== next) this.action.crossFadeTo(next, crossfade(this.clip, name), false);
    this.action = next;
    this.clip = name;
  }

  /** Leave an afterimage of the last drawn pose (the oldest of two is reused). */
  private ghost() {
    this.prepareGhosts();
    const g = this.ghosts[this.ghostNext];
    this.ghostNext = (this.ghostNext + 1) % 2;
    g.snap(this.skeleton, [this.body.geometry, this.face.geometry], this.body.matrixWorld);
  }

  private prepareGhosts() {
    if (this.ghosts.length) return;
    while (this.ghosts.length < 2) this.ghosts.push(new Ghost(this.skeleton, this.body.bindMatrix, this.ghostParent, [this.body.geometry, this.face.geometry]));
    // The character that leaves afterimages draws after them (Ghost): over them where they overlap.
    this.body.renderOrder = this.face.renderOrder = this.decal.renderOrder = GHOST_ORDER + 1;
  }

  /** Translucent while `f` < 1 (classes v2: Escape Rabbits): the body and print draw from their own copies, the face's own material fades with them. */
  private fade(f: number) {
    const face = this.face.material as THREE.Material;
    if (f >= 0.999) {
      if (!this.faded) return;
      this.body.material = this.faded.was.body; this.decal.material = this.faded.was.decal;
      this.faded.body.dispose(); this.faded.decal?.dispose(); this.faded = null;
      face.transparent = false; face.opacity = 1; face.depthWrite = true; face.needsUpdate = true;
      return;
    }
    if (!this.faded) {
      const glass = <M extends THREE.Material>(m: M) => Object.assign(m.clone(), { transparent: true, depthWrite: false }) as M;
      this.faded = { body: glass(this.body.material as THREE.MeshPhysicalMaterial), decal: this.decal.visible ? glass(this.decal.material as THREE.MeshPhysicalMaterial) : null,
        was: { body: this.body.material as THREE.Material, decal: this.decal.material as THREE.Material } };
      this.body.material = this.faded.body;
      if (this.faded.decal) this.decal.material = this.faded.decal;
      face.transparent = true; face.depthWrite = false; face.needsUpdate = true;
    }
    this.faded.body.opacity = f; if (this.faded.decal) this.faded.decal.opacity = f; face.opacity = f;
  }

  /**
   * The skeleton's upload (three calls it once a frame for each skinned character drawn): each bone's matrix relative to
   * the body, recomputed only when the pose has changed since the last upload. Moving, turning or lifting the character
   * moves the body with its bones, so it needs none; a character whose mixer steps at 15 Hz uploads 15 times a second.
   */
  private uploadPose() {
    const sk = this.skeleton;
    if (!this.posed || !sk.boneMatrices) return;
    this.posed = false;
    frameStats.skeletons++;
    toLocal.copy(this.body.matrixWorld).invert();
    for (let i = 0; i < sk.bones.length; i++) ghostM.multiplyMatrices(toLocal, sk.bones[i].matrixWorld).multiply(sk.boneInverses[i]).multiply(this.bind).toArray(sk.boneMatrices, i * 16);
    if (sk.boneTexture) sk.boneTexture.needsUpdate = true;
  }

  update(delta: number, motion: CharacterMotion, walkSpeed: number) {
    let restart = false;
    this.fade(motion.fade ?? 1);
    if (motion.afterimages && this.body.visible) this.prepareGhosts();
    if (motion.ghost) { motion.ghost = false; if (this.body.visible) this.ghost(); }
    for (const g of this.ghosts) g.update(delta);
    // A looping clip asked for as a one-shot (Dance) holds as a pose; moving ends any pose.
    if (motion.stop) { this.oneShot = null; motion.stop = false; }
    if (motion.play && isLoop(motion.play)) { motion.pose = motion.play; motion.play = null; }
    if (motion.play) { this.oneShot = motion.play; this.oneShotRate = motion.playRate ?? 1; motion.play = null; restart = true; }
    if (motion.upper) { this.upperClip = motion.upper; this.upperT = 0; this.upperRate = motion.playRate ?? 1; motion.upper = null; }
    motion.playRate = undefined;
    if (motion.speed >= 0.08) motion.pose = null;
    if (this.oneShot && this.clip === this.oneShot && !restart && this.action && this.action.time >= this.action.getClip().duration - 1e-3) this.oneShot = null;
    const want = resolveClip({ speed: motion.speed, walkSpeed, pose: motion.pose ?? null, oneShot: this.oneShot, move: motion.move, current: this.clip });
    const changed = want !== this.clip || restart;
    if (changed) this.play(want);
    const action = this.action!, length = action.getClip().duration;
    if (CLIP_BY_NAME.get(want)?.scrub) {
      // Posed by its phase (Air by vertical speed, CastWindup by the cast's power), not by the clock.
      action.setEffectiveTimeScale(0);
      action.time = Math.min(1, Math.max(0, (want === "Air" ? motion.air : motion.scrub) ?? 0)) * length * 0.999;
    } else action.setEffectiveTimeScale(want === this.oneShot ? this.oneShotRate : want === motion.pose && motion.poseRate ? motion.poseRate : tempo(want, motion.speed, walkSpeed));
    this.animateFace(delta, want, motion);
    // Walk and Run count each foot's contact as the playhead passes it (footsteps come from the feet, not a timer).
    const contacts = changed ? undefined : CLIP_BY_NAME.get(want)?.contacts, before = action.time / length;
    this.mixer.update(delta);
    this.posed = true;
    frameStats.mixers++;
    this.hold(delta, want, motion.hold ?? null);
    this.upper(delta);
    this.retireStep(delta);
    const foot = contactCrossed(contacts, before, action.time / length);
    if (foot >= 0) { motion.steps = (motion.steps ?? 0) + 1; motion.foot = foot; }
  }

  /** Also a reset: Strict Mode re-runs effects after this, so the next dress()/update() starts clean. */
  dispose() {
    for (const g of this.ghosts) g.dispose();
    this.ghosts.length = 0;
    for (const r of this.retiring) r.model.removeFromParent();
    this.retiring.length = 0;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.action = null; this.clip = null; this.oneShot = null; this.upperClip = null;
    if (this.bodyKey) bodies.release(this.bodyKey);
    if (this.lodKey) bodies.release(this.lodKey);
    this.full = this.lodGeometry = null; this.lodKey = "";
    this.faceMat?.dispose();
    this.faceMat = null;
    // Its bone texture (three makes one per skeleton on first draw): every character that left used to keep one on the GPU.
    this.skeleton.dispose();
    this.bodyKey = ""; this.shownFace = ""; this.posed = true;
  }
}

export interface WeaponView { kind: WeaponKind; model: string; modelScale: number; inHand: boolean; grip?: WeaponGrip;
  /** The hand that holds it, over the kind's (clips.ts GRIP_HAND: the verb library's Book grip holds the tome in the left). */
  hand?: "L" | "R";
  /** Its glow parts breathe (a tier-5 signature weapon). */
  pulse?: boolean;
  /** Classes v2: the weapon's named materials re-coloured each frame (a staff's crystal to your last element, a charm's
   * learned forms lit, a skin or the mastery trim); null leaves the model's own. */
  paint?: () => WeaponPaint | null }
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

function HeldWeapon({ puppet, motion, weapon: { kind, model: url, modelScale, inHand, grip, hand, pulse, paint } }: { puppet: Puppet; motion: RefObject<CharacterMotion>; weapon: WeaponView }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => tagLookClasses(scene.clone(true), url), [scene, url]);
  // Painted weapons get their own copies of their named materials (the cached model's stay as authored); a tier-5
  // signature weapon's glow parts breathe (its painted copies, when it has them).
  const { paints, glows } = useMemo(() => {
    const own = paint ? new Map<string, THREE.MeshStandardMaterial>() : null;
    if (own) model.traverse(o => {
      const mesh = o as THREE.Mesh, src = mesh.isMesh ? (mesh.material as THREE.MeshStandardMaterial) : null;
      if (!src || !/^M_/.test(src.name)) return;
      if (!own.has(src.name)) own.set(src.name, src.clone());
      mesh.material = own.get(src.name)!;
    });
    return { paints: own, glows: pulse ? glowMaterials(model) : [] };
  }, [model, paint, pulse]);
  useEffect(() => {
    const main = hand ?? WEAPON_HAND[kind];
    placeWeapon(model, { kind, model: url, modelScale, inHand, grip }, inHand ? puppet.sockets[main] : puppet.sockets.Back);
    const shown = showWeapon(motion.current, inHand ? model : null), off = inHand ? holdOffHand(model, puppet.sockets[main === "R" ? "L" : "R"], grip ?? GRIP[kind]) : null;
    return () => { off?.(); model.removeFromParent(); shown(); };
  }, [model, puppet, motion, kind, url, modelScale, inHand, grip, hand]);
  // Upright at rest, the attack grip while an attack clip plays (eased so the swap doesn't pop).
  useFrame(({ clock }, delta) => {
    const g = grip ?? GRIP[kind], p = paints && paint?.();
    if (p) for (const name in p) {
      const m = paints!.get(name), q = p[name];
      if (!m) continue;
      if (q.color) m.color.set(q.color);
      if (q.emissive) m.emissive.set(q.emissive);
      if (q.intensity !== undefined) m.emissiveIntensity = q.intensity;
    }
    breathe(glows, clock.elapsedTime, p);
    if (!inHand || !g.rest) return;
    model.quaternion.slerp(gripQ.setFromEuler(gripE.set(...(puppet.attacking ? g.hand : g.rest))), 1 - Math.exp(-delta * 24));
  });
  return null;
}
/** A weapon's emissive materials, each with its authored intensity kept (they're shared by every copy of the model). */
function glowMaterials(model: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out = new Set<THREE.MeshStandardMaterial>();
  model.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.emissive && m.emissive.getHex() !== 0) out.add(m); });
  for (const m of out) m.userData.glowBase ??= m.emissiveIntensity;
  return [...out];
}
/** Module scope (hook values are never written in a component): the glow parts breathe, 65–100% of their intensity (a painted one's). */
function breathe(glows: THREE.MeshStandardMaterial[], t: number, paint?: WeaponPaint | null) {
  const k = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3.2));
  for (const m of glows) m.emissiveIntensity = (paint?.[m.name]?.intensity ?? (m.userData.glowBase as number)) * k;
}
/** Ribbon trails sample the weapon in hand (CharacterMotion.weaponModel); returns the cleanup. Module scope: hook values are never written in a component. */
function showWeapon(m: CharacterMotion | null, model: THREE.Object3D | null) {
  if (m) m.weaponModel = model;
  return () => { if (m && model && m.weaponModel === model) m.weaponModel = null; };
}
/**
 * A weapon in two hands' worth of parts (classes v2: the Guardian's shield, the Assassin's second tanto, the Martial
 * Artist's left wrap): the model's `OffHand` node, authored grip-at-origin like the weapon, goes to the other hand while
 * it's in hand, and back to its place on the model (across the back with the rest) after. Returns the undo.
 */
function holdOffHand(model: THREE.Object3D, socket: THREE.Object3D, g: WeaponGrip): (() => void) | null {
  const off = model.getObjectByName("OffHand");
  if (!off) return null;
  const home = off.parent!, at = off.matrix.clone();
  off.scale.setScalar(model.scale.x);
  off.position.set(0, 0, 0);
  off.rotation.set(...(g.off ?? g.hand));
  socket.add(off);
  return () => { off.removeFromParent(); home.add(off); at.decompose(off.position, off.quaternion, off.scale); };
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

/**
 * Held items (row 279, specs/game-ui.md §2): what the tool wheel put in the right hand. Each hold has a grip in the
 * hand socket and an arm pose laid over walking (build_clips.py HoldRod, HoldTool, HoldFront); rotations and offsets
 * are three.js Euler XYZ in socket space, solved from those poses by art/props-enemies/render_held.py. While the tool's
 * own clip plays (the cast, the swing, the dig) it eases to that clip's grip. It shows in its hold and its use, and
 * hides in a seat, a glide, a slide, a roll or a climb. A new item pops out of the hand; one put away shrinks back in.
 */
export type HoldKind = "rod" | "net" | "shovel" | "glider" | "front" | "hammer";
export interface HeldView { url: string; hold: HoldKind; /** Something held in front: fitted to this size (rig units) about its centre. */ fit?: number }
type Grip = { clip: ClipName; rotation: [number, number, number]; offset?: [number, number, number]; scale?: number };
const HELD_GRIPS: Record<HoldKind, Grip> = {
  rod: { clip: "HoldRod", rotation: [3.046, 1.018, -1.469] },
  net: { clip: "HoldTool", rotation: [0.134, -1.029, -0.635] },
  shovel: { clip: "HoldTool", rotation: [-0.461, 0.175, -1.611] },
  glider: { clip: "HoldTool", rotation: [-0.572, -0.643, -0.883], scale: 0.45 },
  front: { clip: "HoldFront", rotation: [-2.049, -1.105, -2.508], offset: [-0.0306, 0.0195, 0.0249] },
  // The workbench's hammer (art/props-enemies/build_forage.py), held like the net; its grips solved by render_forage_clips.py.
  hammer: { clip: "HoldTool", rotation: [-0.169, -1.074, -1.039] },
};
/**
 * The fist round the rod while fishing (art/props-enemies/render_fishing.py solves it from FishHold: 20 degrees up over
 * the water); the fishing clips' arms and wrists do the rest: back over the shoulder, whipped forward, snapped up.
 */
const ROD_FISHING: [number, number, number] = [2.335, -0.59, 2.157];
/** The grip while a tool's own clip plays (render_held.py: the cast forward, the net's swing out, the blade into the ground). */
const USE_GRIPS: Partial<Record<ClipName, Partial<Record<HoldKind, [number, number, number]>>>> = {
  Fish: { rod: ROD_FISHING }, FishHold: { rod: ROD_FISHING }, CastWindup: { rod: ROD_FISHING }, CastSwing: { rod: ROD_FISHING }, HookYank: { rod: ROD_FISHING },
  Reel: { rod: ROD_FISHING }, Cheer: { rod: ROD_FISHING }, Sad: { rod: ROD_FISHING },
  Net: { net: [2.472, -0.623, 2.401] }, Dig: { shovel: [-1.087, -0.652, -1.79] },
  // A rock struck: the blade swung forward and down onto the rock in front (render_forage_clips.py); the hammer's blows
  // face down onto the bench.
  Strike: { shovel: [-1.458, -0.293, -1.846] }, Craft: { hammer: [1.403, 0.0, 1.691] },
};
/** Clips a hold lays over (the arms carry the item); in any other the item's own clip poses them. */
const HOLD_OVER = new Set<ClipName>(["Idle", "Walk", "Run", "CrouchIdle", "CrouchWalk", "Jump", "Air", "Fall", "Land", "LandHeavy", "Skid", "Dash", "LookAround"]);
/** Clips the item is put away for: seats, the glide (the leaf takes the hand), slides, rolls and climbs, defeat. */
const HELD_HIDDEN = new Set<ClipName>(["Sit", "Study", "Stretch", "Sleep", "Glide", "Slide", "SlideIn", "SlideInDash", "SlideUp", "SlideJump", "SlideStand", "SlideBonk",
  "Mantle", "Roll", "DodgeRoll", "Defeat", "HoldUp"]);
/** Seconds to pop out (with a little overshoot) and to shrink back into the hand. */
const HELD_IN = 0.22, HELD_OUT = 0.12;
const holdQ = new THREE.Quaternion(), heldQ = new THREE.Quaternion(), heldE = new THREE.Euler();

/** Fit a model to `size` about its centre (something held in front: a fruit, a shell). */
function fitted(scene: THREE.Object3D, url: string, size: number) {
  const inner = tagLookClasses(scene.clone(true), url), box = new THREE.Box3().setFromObject(inner), dim = new THREE.Vector3(), mid = new THREE.Vector3();
  box.getSize(dim); box.getCenter(mid);
  const k = size / Math.max(dim.x, dim.y, dim.z, 1e-3);
  inner.position.copy(mid).multiplyScalar(-k);
  inner.scale.setScalar(k);
  const outer = new THREE.Group();
  outer.add(inner);
  return outer;
}

function HeldItem({ puppet, motion, view: { url, hold, fit } }: { puppet: Puppet; motion: RefObject<CharacterMotion>; view: HeldView }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const m = hold === "front" ? fitted(scene, url, fit ?? 0.1) : tagLookClasses(scene.clone(true), url);
    m.traverse(o => { o.castShadow = true; o.userData.sunCaster = "dynamic"; });
    return m;
  }, [scene, url, hold, fit]);
  const grip = HELD_GRIPS[hold];
  const age = useRef(0);
  useEffect(() => {
    age.current = 0;
    puppet.takeOut(model, grip);
    return () => puppet.putAway(model, grip);
  }, [model, puppet, grip]);
  useFrame((_, delta) => { age.current += delta; poseHeld(model, puppet.current, grip, hold, age.current, delta); });
  // The rod carries its fishing: the bobber, the line and the catch of this avatar's own cast.
  return hold === "rod" ? <FishingRig motion={motion} rod={model} hands={puppet.sockets} /> : null;
}
/** Module scope (the react compiler forbids writing through hook values): pop out, hide where put away, ease to the use grip. */
function poseHeld(model: THREE.Object3D, clip: ClipName | null, grip: Grip, hold: HoldKind, age: number, delta: number) {
  const u = Math.min(1, age / HELD_IN), pop = u < 1 ? Math.sin(u * Math.PI * 0.5) * (1 + 0.14 * Math.sin(u * Math.PI)) : 1;
  const target = (grip.scale ?? 1) * pop * (clip && HELD_HIDDEN.has(clip) ? 0 : 1);
  model.scale.setScalar(u < 1 ? target : THREE.MathUtils.damp(model.scale.x, target, 18, delta));
  model.visible = model.scale.x > 1e-3;
  const use = clip ? USE_GRIPS[clip]?.[hold] : undefined;
  model.quaternion.slerp(heldQ.setFromEuler(heldE.set(...(use ?? grip.rotation))), 1 - Math.exp(-delta * 20));
}

export interface CharacterProps {
  look: CharacterLook;
  motion: RefObject<CharacterMotion>;
  /** Normal walking pace for this controller (Walk plays at 1x there). */
  walkSpeed?: number;
  weapon?: WeaponView | null;
  /** What the tool wheel put in the hand (a tool, the furled leaf, a snack); weapons in hand are `weapon`. */
  held?: HeldView | null;
  /** Owns the leaf glider: the leaf shows while `motion.leaf` is open. */
  leaf?: boolean;
  /** Loads the verb library (the ruins' player): its clips join this character's, never suspending the scene. */
  verbs?: boolean;
  /** Face atlas density: 512 px per face canvas in the world (sharp at village distance), 1024 in the creator. */
  faceSize?: number;
  scale?: number;
  /** Detail by drawn size (lod.ts); off in the creator, which shows one character up close. */
  lod?: boolean;
}

export default function Character({ look, motion, walkSpeed = 7.4, weapon = null, held = null, leaf = false, verbs = false, faceSize = 512, scale = CHARACTER_SCALE, lod = true }: CharacterProps) {
  // While a newly chosen part loads, keep showing the previous look instead of suspending.
  const shown = useDeferredValue(look);
  const parts = useMemo(() => resolveParts(shown), [shown]);
  const loaded = useGLTF([BASE_URL, ...parts.map(p => p.url)]) as unknown as Gltf[];
  const atlas = useLoader(THREE.TextureLoader, faceSize >= 1024 ? FACE_ATLAS_URLS.creator : FACE_ATLAS_URLS.world);
  const decalMap = useLoader(THREE.TextureLoader, TSI_DECAL_URL);
  const base = loaded[0];
  const puppet = useMemo(() => new Puppet(base), [base]);
  useEffect(() => () => puppet.dispose(), [puppet]);
  // A verb asked for before the library loads plays the weapon's own attack clip.
  useEffect(() => setFallback(puppet, weapon?.kind), [puppet, weapon?.kind]);
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
  // Before the default frame work (-1): what reads this frame's pose (the held rod's tip, step dust) sees it. Detail by
  // drawn size (lod.ts): small characters draw LOD 1 and step their mixer less often; the creator's never change.
  useFrame(({ camera, size, gl, clock }, delta) => {
    const m = motion.current, g = group.current;
    if (!m || !g) return;
    g.rotation.y = m.yaw;
    g.position.y = m.lift;
    if (lod) viewCharacter(puppet, g, camera, size.height * gl.getPixelRatio(), scale, clock.elapsedTime);
    const step = mixerStep(puppet.lod, Math.min(delta, 0.1) * (m.rate ?? 1));
    if (step > 0) puppet.update(step, m, walkSpeed);
  }, -1);
  return <group ref={group}>
    <primitive object={puppet.root} scale={scale} dispose={null} />
    {weapon && <HeldWeapon puppet={puppet} motion={motion} weapon={weapon} />}
    {/* Its own boundary: the LOD 1 GLBs load after the character shows, never suspending it. */}
    {lod && <Suspense fallback={null}><LodMesh puppet={puppet} look={shown} parts={parts} /></Suspense>}
    {/* Its own boundary: the ruins never wait for the verb library; a verb asked for meanwhile plays the attack clip. */}
    {verbs && <Suspense fallback={null}><VerbClips puppet={puppet} /></Suspense>}
    {/* Its own boundary: taking out a tool never suspends the scene while its model loads. */}
    {held && <Suspense fallback={null}><HeldItem key={`${held.hold}:${held.url}`} puppet={puppet} motion={motion} view={held} /></Suspense>}
    {/* Its own boundary: crafting the glider mid-session must not suspend the scene while the leaf loads. */}
    {leaf && <Suspense fallback={null}><HeldLeaf puppet={puppet} motion={motion} scale={scale} /></Suspense>}
  </group>;
}
/** The verb library's actions (build_clips.py `-- verbs`): the same rig's tracks, merged into the puppet's clips. */
/** The look's LOD 1 parts (art/characters/build_lod.py), merged once per look and shared like the full one. */
function LodMesh({ puppet, look, parts }: { puppet: Puppet; look: CharacterLook; parts: ResolvedPart[] }) {
  const loaded = useGLTF([LOD_SKIN_URL, ...parts.map(p => p.lod)]) as unknown as Gltf[];
  useEffect(() => puppet.setLod(look, parts, loaded[0].scene, loaded.slice(1).map(g => g.scene)), [puppet, look, parts, loaded]);
  return null;
}
/** Development (evidence): `?charlod=1` draws every character's LOD 1 mesh, so it can be looked at up close. */
const SHOW_LOD = process.env.NODE_ENV !== "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("charlod") === "1";
const seen = new THREE.Vector3(), view = new THREE.Frustum(), viewProj = new THREE.Matrix4(), body = new THREE.Sphere(new THREE.Vector3(), 1);
let viewAt = -1, viewCam: THREE.Camera | null = null;
/**
 * Where `g`'s character is this frame for its detail tier (lod.ts): its distance from the camera, its drawn height in
 * canvas pixels, and whether it is in view (hidden: not, at Infinity). The view's frustum is made once a frame (keyed by
 * the frame clock) and shared by every character. Module scope: hook values are never written in a component.
 */
function viewCharacter(puppet: Puppet, g: THREE.Object3D, camera: THREE.Camera, viewportPx: number, scale: number, now: number) {
  for (let o: THREE.Object3D | null = g; o; o = o.parent) if (!o.visible) return puppet.view(Infinity, 0, false);
  if (SHOW_LOD) return puppet.view(30, 50, true); // past `near`, under the mesh line, above the rest: LOD 1 alone
  if (now !== viewAt || camera !== viewCam) {
    viewAt = now; viewCam = camera;
    view.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  }
  g.getWorldPosition(seen);
  const height = 1.045 * scale, d = seen.distanceTo(camera.position);
  body.center.copy(seen).setY(seen.y + height / 2);
  body.radius = height * 0.75;
  const fov = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? (camera as THREE.PerspectiveCamera).getEffectiveFOV() : 30;
  // Adaptive quality (governor.ts) can have small characters reach their lighter tiers sooner (never nearer than `near`).
  puppet.view(d, drawnHeight(height, d, fov, viewportPx) / quality.knobs.lodBias, view.intersectsSphere(body));
}
function VerbClips({ puppet }: { puppet: Puppet }) {
  const { animations } = useGLTF(VERBS_URL) as unknown as Gltf;
  useEffect(() => puppet.addClips(animations), [puppet, animations]);
  return null;
}
function setFallback(puppet: Puppet, kind: WeaponKind | undefined) { puppet.fallback = ATTACK_CLIP[kind ?? "melee"]; }
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
