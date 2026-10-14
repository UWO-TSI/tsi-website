/**
 * The reflection creator's two scene passes (components/game/arrival/ReflectionScene.tsx), pure three so a test can run
 * them without WebGL. The water is a planar mirror: the camera mirrored in the sea (y 0) draws the same scene (every
 * object but the water, clipped to what is above the sea) into the mirror's target, then the camera draws the scene
 * with the water sampling that target where each of its points sees the reflection. One scene, one character built
 * from one look: the you leaning over the side and the you in the water are the same meshes from two cameras.
 */
import * as THREE from "three";

const _fwd = new THREE.Vector3(), _at = new THREE.Vector3(), _up = new THREE.Vector3();
/** Clip space to the mirror target's uv (0..1). */
const TO_UV = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

/**
 * Put `mirror` where `cam` is mirrored in the sea, looking where it looks mirrored, its lens a little wider (it still
 * covers what the camera sees when its view is offset into the scene's part); `texMatrix` maps a world point on the
 * water to the mirror target's uv (projective) where that point sees the reflection.
 */
export function mirrorCamera(cam: THREE.PerspectiveCamera, mirror: THREE.PerspectiveCamera, texMatrix: THREE.Matrix4) {
  mirror.fov = Math.min(100, cam.fov * 1.5); mirror.near = cam.near; mirror.far = cam.far; mirror.aspect = cam.aspect;
  mirror.position.set(cam.position.x, -cam.position.y, cam.position.z);
  cam.getWorldDirection(_fwd);
  _at.copy(cam.position).add(_fwd);
  _at.y = -_at.y;
  _up.set(0, 1, 0).applyQuaternion(cam.quaternion);
  mirror.up.set(_up.x, -_up.y, _up.z);
  mirror.lookAt(_at);
  mirror.updateProjectionMatrix();
  mirror.updateMatrixWorld();
  texMatrix.copy(TO_UV).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
}

/** What the passes need of the renderer (WebGLRenderer, or a recorder in a test). */
export interface PassRenderer {
  clippingPlanes: THREE.Plane[];
  setRenderTarget(target: THREE.WebGLRenderTarget | null): void;
  render(scene: THREE.Object3D, camera: THREE.Camera): void;
}

/** The mirror pass then the frame pass, both of the one scene: only the water is left out of the mirror's. */
export function renderReflection(gl: PassRenderer, scene: THREE.Object3D, water: THREE.Object3D | null, cam: THREE.Camera, mirror: THREE.Camera,
  targets: { refl: THREE.WebGLRenderTarget; frame: THREE.WebGLRenderTarget }, clip: THREE.Plane) {
  if (water) water.visible = false;
  gl.setRenderTarget(targets.refl);
  gl.clippingPlanes = [clip];
  gl.render(scene, mirror);
  gl.clippingPlanes = [];
  if (water) water.visible = true;
  gl.setRenderTarget(targets.frame);
  gl.render(scene, cam);
}
