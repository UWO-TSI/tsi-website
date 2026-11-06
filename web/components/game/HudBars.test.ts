import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { DEFAULT_PITCH, ORBIT_DISTANCE, PITCH_MAX, PITCH_MIN, ZOOM_MAX, ZOOM_MIN, orbitOffset } from "@/lib/game/orbitCamera";
import { CHARACTER_HEIGHT } from "./character/Character";
import { arcPlace } from "./HudBars";
import { projectCurved, type ScreenPoint } from "./net/projection";

/** The follow camera's framing (IslandAtmosphere useFollowCamera): 0.7 up and 1.5 ahead of the feet, ORBIT_DISTANCE x zoom back. */
function followCam(at: Vector3, yaw: number, pitch: number, zoom: number, aspect: number) {
  const camera = new PerspectiveCamera(48, aspect, 0.1, 200);
  const look = new Vector3(at.x + Math.sin(yaw) * 1.5, at.y + 0.7, at.z + Math.cos(yaw) * 1.5);
  const [ox, oy, oz] = orbitOffset(yaw, pitch, ORBIT_DISTANCE * zoom);
  camera.position.set(look.x + ox, look.y + oy, look.z + oz);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}
const pt = (): ScreenPoint => ({ x: 0, y: 0, depth: 0 });

describe("the stamina arc's place (r8: \"beside the character even when zoomed out ... always to the right ... adaptive to camera angels\")", () => {
  const at = new Vector3(30, 1.2, 46);

  it("is level with the body as it is drawn and just right of it, at every zoom, turn and tilt, desktop and phone", () => {
    const out = pt(), feet = pt(), head = pt(), p = pt(), R = CHARACTER_HEIGHT * 0.28;
    for (const aspect of [1440 / 860, 390 / 804]) for (const zoom of [ZOOM_MIN, 1, ZOOM_MAX])
      for (const yaw of [0, 1.3, Math.PI, -2.2]) for (const pitch of [PITCH_MIN, DEFAULT_PITCH, PITCH_MAX]) {
        const cam = followCam(at, yaw, pitch, zoom, aspect), where = JSON.stringify({ aspect, zoom, yaw, pitch });
        expect(arcPlace(at, cam, out), where).toBe(true);
        projectCurved(at.x, at.y, at.z, cam, 1, 1, feet);
        projectCurved(at.x, at.y + CHARACTER_HEIGHT, at.z, cam, 1, 1, head);
        const tall = feet.y - head.y;
        // Level with the body's middle third, never over its head (round 8, zoomed out) or under its feet.
        expect(out.y, where).toBeGreaterThan(head.y + tall / 3);
        expect(out.y, where).toBeLessThan(feet.y - tall / 3);
        // On its right: past the body and its hair (a column 0.28 of its height round, drawn through the bend), by
        // less than the body's own width.
        let lo = Infinity, hi = -Infinity;
        for (let h = 0; h <= 1; h += 0.25) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
          projectCurved(at.x + Math.cos(a) * R, at.y + h * CHARACTER_HEIGHT, at.z + Math.sin(a) * R, cam, 1, 1, p);
          lo = Math.min(lo, p.x); hi = Math.max(hi, p.x);
        }
        expect(out.x, where).toBeGreaterThan(hi);
        expect(out.x - hi, where).toBeLessThan(hi - lo);
      }
  });

  it("round 8's flat projection is what put it over the head when zoomed out", () => {
    const cam = followCam(at, 0, DEFAULT_PITCH, ZOOM_MAX, 1440 / 860), head = pt(), out = pt();
    const flat = new Vector3(at.x, at.y + CHARACTER_HEIGHT * 0.45, at.z).project(cam);
    projectCurved(at.x, at.y + CHARACTER_HEIGHT, at.z, cam, 1, 1, head);
    expect((1 - flat.y) / 2).toBeLessThan(head.y); // the flat middle is above the drawn crown
    arcPlace(at, cam, out);
    expect(out.y).toBeGreaterThan(head.y);
  });

  it("is nowhere while the body is behind the camera", () => {
    const cam = followCam(at, 0, DEFAULT_PITCH, 1, 16 / 9);
    cam.lookAt(at.x, at.y, at.z - 200); // looking the other way: the player is behind it
    cam.updateMatrixWorld();
    expect(arcPlace({ x: cam.position.x, y: cam.position.y, z: cam.position.z + 5 }, cam, pt())).toBe(false);
  });
});
