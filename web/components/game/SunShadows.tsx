"use client";

/**
 * Sun shadows on High (specs/look-development.md §9.2, row 240): one shadow
 * map for the key light, the static world cached, and everything that moves
 * (characters, enemies, swaying canopy casters) drawn into it every frame.
 *
 * The static casters are rendered once into a depth copy. Every frame three
 * clears the light's map as usual, the first caster in the scene (`base`)
 * blits that copy back in, and the dynamic casters draw on top of it with the
 * depth test, so the map holds both without re-rendering the static world.
 * A re-capture happens at the same point of that frame's shadow pass (three
 * only renders shadows inside a render): `base` renders the statics alone,
 * keeps the depth, and the pass goes on to draw the dynamic casters.
 *
 * The copy is re-rendered when anything it holds changes: a static caster
 * added, removed, hidden or moved (checked every frame against the capture),
 * or the light itself (the sun path moves it every couple of minutes, and its
 * shadow box follows the sun). A static caster seen moving becomes dynamic.
 *
 * Casters: `userData.sunCaster` "dynamic" is set by Character, the enemies and
 * prepareModel's swaying canopy casters; every other mesh with castShadow is
 * static. Between captures the static ones have castShadow off (they are in
 * the copy) and ACNH's caster-only hulls are hidden.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type Caster = THREE.Mesh & { userData: { sunCaster?: "static" | "dynamic"; casterOnly?: boolean } };

/** Light state that the cached copy depends on. */
function lightKey(light: THREE.DirectionalLight): string {
  const { camera, mapSize, map } = light.shadow;
  return [...light.matrixWorld.elements, ...light.target.matrixWorld.elements, camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far, mapSize.x, mapSize.y, map?.texture.id ?? -1].join();
}

class SunShadowCache {
  readonly base: THREE.Mesh;
  private scene: THREE.Scene | null = null;
  private light: THREE.DirectionalLight | null = null;
  private key = "";
  private copy: THREE.WebGLRenderTarget | null = null;
  private pending = true;
  private capturing = false;
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
    this.base.onBeforeShadow = (renderer, _object, camera, shadowCamera) => {
      const light = this.light, map = light?.shadow.map;
      if (this.capturing || !light || !map?.depthTexture || shadowCamera !== light.shadow.camera) return;
      if (this.pending || !this.copy) this.capture(renderer, camera, light, map);
      else {
        renderer.copyTextureToTexture(this.copy.depthTexture!, map.depthTexture);
        renderer.setRenderTarget(map);
      }
    };
  }

  /** Inside the shadow pass: render the static casters alone into the map, keep a copy, then let the pass draw the dynamic ones. */
  private capture(renderer: THREE.WebGLRenderer, camera: THREE.Camera, light: THREE.DirectionalLight, map: THREE.WebGLRenderTarget) {
    for (const mesh of this.seen) { mesh.castShadow = true; if (mesh.userData.casterOnly) mesh.visible = true; }
    for (const mesh of this.dynamics) mesh.castShadow = false;
    this.capturing = true;
    renderer.shadowMap.render([light], this.scene!, camera);
    this.capturing = false;
    if (!this.copy || this.copy.width !== map.width || this.copy.height !== map.height) {
      this.copy?.dispose();
      this.copy = new THREE.WebGLRenderTarget(map.width, map.height, { format: THREE.RedFormat, depthTexture: new THREE.DepthTexture(map.width, map.height, THREE.UnsignedIntType) });
      renderer.initRenderTarget(this.copy);
    }
    renderer.copyTextureToTexture(map.depthTexture!, this.copy.depthTexture!);
    renderer.setRenderTarget(map);
    this.statics.clear();
    for (const mesh of this.seen) {
      this.statics.set(mesh, mesh.matrixWorld.clone());
      mesh.castShadow = false;
      if (mesh.userData.casterOnly) mesh.visible = false;
    }
    for (const mesh of this.dynamics) mesh.castShadow = true;
    this.key = lightKey(light);
    this.pending = false;
  }

  /** The blit must run before any caster draws: keep `base` first in traversal order. */
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
    if ((object as THREE.DirectionalLight).isDirectionalLight && object.castShadow && !this.light) this.light = object as THREE.DirectionalLight;
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

  /** Before the render: find the key light and the casters, and whether the static copy is still true. */
  frame(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.scene = scene;
    this.first(scene);
    this.light = null;
    this.seen.length = 0;
    this.dynamics.length = 0;
    const dirty = this.visit(scene);
    const light = this.light as THREE.DirectionalLight | null;
    if (!light || !gl.shadowMap.enabled) {
      if (this.active) for (const mesh of this.dynamics) if (mesh.userData.casterOnly) mesh.visible = false;
      this.active = false;
      return;
    }
    this.active = true;
    gl.shadowMap.autoUpdate = true;
    for (const mesh of this.dynamics) { mesh.castShadow = true; if (mesh.userData.casterOnly) mesh.visible = true; }
    if (dirty || this.seen.length !== this.statics.size || lightKey(light) !== this.key) this.pending = true;
  }

  attach(scene: THREE.Scene) {
    this.first(scene);
    return () => {
      scene.remove(this.base);
      this.base.geometry.dispose();
      (this.base.material as THREE.Material).dispose();
      this.copy?.dispose();
      this.copy = null;
      this.pending = true;
      for (const mesh of [...this.statics.keys(), ...this.dynamics]) {
        mesh.castShadow = true;
        if (mesh.userData.casterOnly) mesh.visible = false;
      }
      this.statics.clear();
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
