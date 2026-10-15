import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { mirrorCamera, renderReflection, type PassRenderer } from "./reflectionPasses";
import { DEFAULT_LOOK, parseLook } from "@/lib/game/character/look";

/** A renderer that records each pass: its target, its camera, the scene, and every mesh visible in it. */
function recorder() {
  const passes: { target: THREE.WebGLRenderTarget | null; camera: THREE.Camera; scene: THREE.Object3D; visible: THREE.Object3D[]; clipped: boolean }[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const gl: PassRenderer = {
    clippingPlanes: [],
    setRenderTarget(t) { target = t; },
    render(scene, camera) {
      const visible: THREE.Object3D[] = [];
      scene.traverseVisible(o => { if ((o as THREE.Mesh).isMesh) visible.push(o); });
      passes.push({ target, camera, scene, visible, clipped: gl.clippingPlanes.length > 0 });
    },
  };
  return { gl, passes };
}

/**
 * The creator's set as the scene holds it: you (one character, built from the look the creator shows: a stand-in mesh
 * carrying that look object, as Character's meshes are built from its `look` prop), leaning out over the sea, and the water.
 */
function set(look = parseLook({ ...DEFAULT_LOOK, hair: 7, back: "hair_wispy_ponytail" })) {
  const scene = new THREE.Scene();
  const you = new THREE.Group();
  you.name = "you";
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 0.3));
  body.userData.look = look;
  you.add(body);
  you.position.set(-0.6, 0.18, 0.15);
  you.rotation.z = 1.0;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 160));
  water.rotation.x = -Math.PI / 2;
  scene.add(you, water);
  scene.updateMatrixWorld(true);
  return { scene, you, body, water, look };
}

function camera() {
  const cam = new THREE.PerspectiveCamera(24, 1.05, 0.05, 200);
  cam.position.set(-2.9, 3.7, -3.6);
  cam.up.set(-0.84, -0.54, 0);
  cam.lookAt(-1.4, -0.7, 0.15);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

describe("the reflection creator's passes", () => {
  it("draw the you over the side and the you in the water from one character, built from one look", () => {
    const { scene, body, water, look } = set();
    const cam = camera(), mirror = new THREE.PerspectiveCamera();
    const refl = new THREE.WebGLRenderTarget(4, 4), frame = new THREE.WebGLRenderTarget(4, 4);
    const { gl, passes } = recorder();
    mirrorCamera(cam, mirror, new THREE.Matrix4());
    renderReflection(gl, scene, water, cam, mirror, { refl, frame }, new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.002));
    expect(passes.map(p => [p.target, p.camera])).toEqual([[refl, mirror], [frame, cam]]);
    // The same scene both times, and the same mesh (the same look object) in each: the mirror pass only leaves out the water.
    expect(passes[0].scene).toBe(passes[1].scene);
    expect(passes[0].visible).toEqual([body]);
    expect(passes[1].visible).toEqual([body, water]);
    for (const p of passes) expect(p.visible[0].userData.look).toBe(look);
    expect(passes.map(p => p.clipped)).toEqual([true, false]);
    expect(water.visible).toBe(true);
    expect(gl.clippingPlanes).toEqual([]);
  });

  it("put each point's reflection where the water sees it: the mirror image of you, not anything else", () => {
    const { you } = set();
    const cam = camera(), mirror = new THREE.PerspectiveCamera(), tex = new THREE.Matrix4();
    mirrorCamera(cam, mirror, tex);
    // Points on you (the top of your head, your face, your chest): where the camera sees each one's mirror image (x, -y, z)
    // cross the water, the water looks up the mirror target at that point's own place in the mirror camera's view.
    for (const local of [[0, 1.35, 0], [0, 1.07, 0.2], [0, 0.62, 0.15]] as const) {
      const p = new THREE.Vector3(...local).applyMatrix4(you.matrixWorld);
      const image = p.clone().setY(-p.y);
      const k = cam.position.y / (cam.position.y - image.y);
      const onWater = cam.position.clone().lerp(image, k);
      expect(onWater.y).toBeCloseTo(0, 6);
      const uvWater = new THREE.Vector4(onWater.x, 0, onWater.z, 1).applyMatrix4(tex);
      const seen = p.clone().project(mirror);
      expect(uvWater.x / uvWater.w).toBeCloseTo(seen.x * 0.5 + 0.5, 6);
      expect(uvWater.y / uvWater.w).toBeCloseTo(seen.y * 0.5 + 0.5, 6);
    }
  });
});
