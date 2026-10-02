import * as THREE from "three";

/**
 * Returns the camera's forward direction projected onto the XZ plane
 * (Y stripped, normalized). Used by PlayerAvatar to translate raw WASD
 * input into camera-relative world motion.
 *
 * "Forward" = away from camera, into the scene.
 */
const _dir = new THREE.Vector3(), _out = { fx: 0, fz: 1 };
/** The result is shared scratch (the avatar calls this every frame): read it before the next call. */
export function getCameraForwardXZ(camera: THREE.Camera): { fx: number; fz: number } {
  camera.getWorldDirection(_dir);
  _dir.y = 0;
  if (_dir.lengthSq() < 1e-6) { _out.fx = 0; _out.fz = 1; return _out; }
  _dir.normalize();
  _out.fx = _dir.x; _out.fz = _dir.z;
  return _out;
}

/**
 * Stick or keys (`ix` right, `iz` forward) to a world direction for a camera whose ground-plane forward is
 * (fx, fz): forward is away from the camera and right is the screen's right (forward × up), at any heading the
 * orbit camera turns to. The sim gets the same vector it always did; only the frame it is read in turns.
 */
export function cameraRelative(ix: number, iz: number, fx: number, fz: number): { x: number; z: number } {
  return { x: fx * iz - fz * ix, z: fz * iz + fx * ix };
}
