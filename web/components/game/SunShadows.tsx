"use client";

/**
 * Sun shadows on High (specs/look-development.md §9.2, row 240): the static
 * world's shadow map is cached, and everything that moves (characters,
 * enemies, swaying canopy casters) casts into a second map every frame.
 *
 * The key light keeps its own map but only re-renders it when the static
 * world changes. A companion light (`moving`, same direction and shadow box,
 * zero intensity) renders the dynamic casters every frame; the look's lights
 * chunk (LOOK_LIGHTS_CHUNK) gives the key light the darker of the two, so they
 * read as one shadow. Measured on the Mac mini: blitting a cached depth copy
 * back into one map every frame cost 3-4 ms (ANGLE on Metal); the second map
 * costs a clear and the moving casters' draws.
 *
 * The static map re-renders when anything it holds changes: a static caster
 * added, removed, hidden or moved (checked every frame against the capture),
 * or the key light itself (the sun path moves it every couple of minutes, and
 * its shadow box follows the sun). A static caster seen moving becomes dynamic.
 *
 * Casters: `userData.sunCaster` "dynamic" is set by Character, the enemies and
 * prepareModel's swaying canopy casters; every other mesh with castShadow is
 * static. castShadow is per object, not per light, so the first caster in the
 * scene (`base`) switches the two sets as each light's pass begins; between
 * passes ACNH's caster-only hulls stay hidden.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type Caster = THREE.Mesh & { userData: { sunCaster?: "static" | "dynamic"; casterOnly?: boolean } };

/** Light state that the cached map depends on: the light's and its target's matrices, the shadow camera's box and the map size. */
class LightKey {
  private readonly light = new THREE.Matrix4();
  private readonly target = new THREE.Matrix4();
  private box: number[] = [];
  matches(l: THREE.DirectionalLight): boolean {
    const c = l.shadow.camera, m = l.shadow.mapSize, b = this.box;
    return this.light.equals(l.matrixWorld) && this.target.equals(l.target.matrixWorld)
      && b[0] === c.left && b[1] === c.right && b[2] === c.top && b[3] === c.bottom && b[4] === c.near && b[5] === c.far && b[6] === m.x && b[7] === m.y;
  }
  save(l: THREE.DirectionalLight) {
    const c = l.shadow.camera, m = l.shadow.mapSize;
    this.light.copy(l.matrixWorld);
    this.target.copy(l.target.matrixWorld);
    this.box = [c.left, c.right, c.top, c.bottom, c.near, c.far, m.x, m.y];
  }
}

class SunShadowCache {
  readonly base: THREE.Mesh;
  readonly moving = new THREE.DirectionalLight(0xffffff, 0);
  private light: THREE.DirectionalLight | null = null;
  private readonly key = new LightKey();
  private pending = true;
  private active = false;
  private readonly statics = new Map<Caster, THREE.Matrix4>();
  private readonly seen: Caster[] = [];
  private readonly dynamics: Caster[] = [];

  constructor() {
    const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    geometry.setDrawRange(0, 0);
    this.base = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    this.base.castShadow = true;
    this.base.frustumCulled = false;
    this.base.onBeforeShadow = (_renderer, _object, _camera, shadowCamera) => {
      const light = this.light;
      if (light && shadowCamera === light.shadow.camera) this.captureStatics(light);
      else if (shadowCamera === this.moving.shadow.camera) this.cast(false);
    };
    this.moving.name = "sun-moving";
    this.moving.castShadow = true;
  }

  /** Which set casts in the pass that is starting: the static world (key light, on a capture) or the moving casters. */
  private cast(statics: boolean) {
    for (const mesh of this.seen) { mesh.castShadow = statics; if (mesh.userData.casterOnly) mesh.visible = statics; }
    for (const mesh of this.dynamics) { mesh.castShadow = !statics; if (mesh.userData.casterOnly) mesh.visible = !statics; }
  }

  /** The key light's pass has begun (it only runs when the static world changed): statics alone, and remember them. */
  private captureStatics(light: THREE.DirectionalLight) {
    this.cast(true);
    this.statics.clear();
    for (const mesh of this.seen) this.statics.set(mesh, mesh.matrixWorld.clone());
    this.key.save(light);
    this.pending = false;
  }

  /** `base` must be the first caster any pass meets. */
  private first(scene: THREE.Scene) {
    if (scene.children[0] === this.base) return;
    const at = scene.children.indexOf(this.base);
    if (at > 0) scene.children.splice(at, 1);
    scene.children.unshift(this.base);
    this.base.parent = scene;
  }

  private visit(object: THREE.Object3D): boolean {
    const mesh = object as Caster;
    if (!object.visible && !mesh.userData.casterOnly) return false;
    let dirty = false;
    if ((object as THREE.DirectionalLight).isDirectionalLight && object.castShadow && object !== this.moving && !this.light) this.light = object as THREE.DirectionalLight;
    if (mesh.isMesh && object !== this.base) {
      const kind = mesh.userData.sunCaster ?? (mesh.castShadow ? (mesh.userData.sunCaster = "static") : undefined);
      if (kind === "dynamic") this.dynamics.push(mesh);
      else if (kind === "static") {
        const captured = this.statics.get(mesh);
        if (!captured) dirty = true;
        else if (!captured.equals(mesh.matrixWorld)) {
          // It moves: cast it every frame instead, and re-capture without it.
          mesh.userData.sunCaster = "dynamic";
          this.dynamics.push(mesh);
          dirty = true;
        }
        if (mesh.userData.sunCaster === "static") this.seen.push(mesh);
      }
    }
    for (const child of object.children) dirty = this.visit(child) || dirty;
    return dirty;
  }

  /** The moving-caster light shares the key light's direction and shadow box. */
  private follow(light: THREE.DirectionalLight) {
    const { moving } = this, from = light.shadow, to = moving.shadow;
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();
    moving.position.setFromMatrixPosition(light.matrixWorld);
    moving.target.position.setFromMatrixPosition(light.target.matrixWorld);
    moving.target.updateMatrixWorld();
    const cam = from.camera, own = to.camera;
    if (own.left !== cam.left || own.right !== cam.right || own.top !== cam.top || own.bottom !== cam.bottom || own.near !== cam.near || own.far !== cam.far) {
      Object.assign(own, { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom, near: cam.near, far: cam.far });
      own.updateProjectionMatrix();
    }
    if (!to.mapSize.equals(from.mapSize)) { to.mapSize.copy(from.mapSize); to.map?.dispose(); to.map = null; }
    Object.assign(to, { bias: from.bias, normalBias: from.normalBias, radius: from.radius, intensity: from.intensity });
  }

  /** Before the render: find the key light and the casters, and whether the static map is still true. */
  frame(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.first(scene);
    this.light = null;
    this.seen.length = 0;
    this.dynamics.length = 0;
    const dirty = this.visit(scene);
    const light = this.light as THREE.DirectionalLight | null;
    if (!light || !gl.shadowMap.enabled) {
      if (this.active) this.deactivate();
      return;
    }
    this.active = true;
    gl.shadowMap.autoUpdate = true;
    if (this.moving.parent !== scene) scene.add(this.moving);
    this.follow(light);
    this.cast(false);
    light.shadow.autoUpdate = false;
    if (dirty || this.seen.length !== this.statics.size || !this.key.matches(light)) this.pending = true;
    if (this.pending) light.shadow.needsUpdate = true;
  }

  private deactivate() {
    this.active = false;
    this.pending = true;
    this.moving.removeFromParent();
    for (const mesh of this.dynamics) if (mesh.userData.casterOnly) mesh.visible = false;
    for (const mesh of this.seen) mesh.castShadow = true;
  }

  attach(scene: THREE.Scene) {
    this.first(scene);
    return () => {
      scene.remove(this.base);
      this.base.geometry.dispose();
      (this.base.material as THREE.Material).dispose();
      this.moving.removeFromParent();
      this.moving.shadow.map?.dispose();
      this.moving.shadow.map = null;
      if (this.light) this.light.shadow.autoUpdate = true;
      for (const mesh of [...this.statics.keys(), ...this.dynamics]) {
        mesh.castShadow = true;
        if (mesh.userData.casterOnly) mesh.visible = false;
      }
      this.statics.clear();
      this.pending = true;
    };
  }
}

export default function SunShadows() {
  const scene = useThree(s => s.scene);
  const cache = useMemo(() => new SunShadowCache(), []);
  useEffect(() => cache.attach(scene), [cache, scene]);
  useFrame(({ gl, scene }) => cache.frame(gl, scene));
  return null;
}
