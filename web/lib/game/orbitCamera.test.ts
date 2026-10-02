import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { cameraRelative, getCameraForwardXZ } from "./cameraBasis";
import { bendViewPoint } from "./worldProjection";
import {
  DEFAULT_PITCH, FOLLOW_IDLE, FOLLOW_TURN, ORBIT_DISTANCE, PITCH_MAX, PITCH_MIN, ZOOM_MAX, ZOOM_MIN, ZOOM_OUT,
  autoFollow, crosshairAim, lookOrbit, loadOrbit, nextCapture, orbitOffset, saveOrbit, snapBack, stepOrbit, toggleZoom, turnOffset, turnQuarter, wrapAngle, zoomOrbit,
  type CaptureEvent, type CaptureState, type OrbitAngles,
} from "./orbitCamera";

const fresh = (target: Partial<OrbitAngles> = {}) => ({
  target: { yaw: 0, pitch: DEFAULT_PITCH, zoom: 1, ...target }, view: { yaw: 0, pitch: DEFAULT_PITCH, zoom: 1, ...target },
  prefs: { sensitivity: 1, invertY: false, mouseLook: true, autoFollow: true }, idle: 0,
});
const YAWS = Array.from({ length: 24 }, (_, i) => (i * Math.PI) / 12 - Math.PI);

/** The rig's camera for a focus, as useFollowCamera poses it: 0.7 up and 1.5 ahead, then the orbit offset. */
function rig(yaw: number, pitch = DEFAULT_PITCH, focus = new THREE.Vector3(3, 0, -2)) {
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 120);
  const look = new THREE.Vector3(focus.x + Math.sin(yaw) * 1.5, focus.y + 0.7, focus.z + Math.cos(yaw) * 1.5);
  const [ox, oy, oz] = orbitOffset(yaw, pitch, ORBIT_DISTANCE);
  camera.position.set(look.x + ox, look.y + oy, look.z + oz);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  return { camera, focus, look };
}

describe("the rig", () => {
  it("is today's west-facing framing at yaw 0 and the default tilt: (0, 7.4, -10.8) from the look point", () => {
    const [x, y, z] = orbitOffset(0, DEFAULT_PITCH, ORBIT_DISTANCE);
    expect(x).toBeCloseTo(0, 12); expect(y).toBeCloseTo(7.4, 12); expect(z).toBeCloseTo(-10.8, 12);
  });
  it("keeps the distance and looks along the heading at every yaw", () => {
    for (const yaw of YAWS) {
      const [x, y, z] = orbitOffset(yaw, 0.5, 10);
      expect(Math.hypot(x, y, z)).toBeCloseTo(10, 10);
      // The camera sits behind the look point: its horizontal offset is minus the heading.
      expect(x * Math.cos(yaw) - z * Math.sin(yaw)).toBeCloseTo(0, 10);
      expect(x * Math.sin(yaw) + z * Math.cos(yaw)).toBeLessThan(0);
    }
  });
  it("turns the overview's eye about its focus with the yaw", () => {
    expect(turnOffset(6, -16, 0)).toEqual([6, -16]);
    const [x, z] = turnOffset(0, -10, Math.PI / 2);
    expect(x).toBeCloseTo(-10, 10); expect(z).toBeCloseTo(0, 10);
    expect(Math.hypot(...turnOffset(6, -16, 1.1))).toBeCloseTo(Math.hypot(6, -16), 10);
  });
});

describe("camera-relative input", () => {
  it("W is away from the camera and D is the screen's right at every yaw", () => {
    for (const yaw of YAWS) {
      const { camera } = rig(yaw);
      const { fx, fz } = getCameraForwardXZ(camera);
      expect(fx).toBeCloseTo(Math.sin(yaw), 6); expect(fz).toBeCloseTo(Math.cos(yaw), 6);
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const w = cameraRelative(0, 1, fx, fz), d = cameraRelative(1, 0, fx, fz), a = cameraRelative(-1, 0, fx, fz), s = cameraRelative(0, -1, fx, fz);
      expect(w.x).toBeCloseTo(fx, 10); expect(w.z).toBeCloseTo(fz, 10);
      expect(s.x).toBeCloseTo(-fx, 10); expect(s.z).toBeCloseTo(-fz, 10);
      expect(d.x).toBeCloseTo(right.x, 6); expect(d.z).toBeCloseTo(right.z, 6);
      expect(a.x).toBeCloseTo(-right.x, 6); expect(a.z).toBeCloseTo(-right.z, 6);
      // A diagonal stays a unit vector (the sim's speed is the input's length).
      const wd = cameraRelative(Math.SQRT1_2, Math.SQRT1_2, fx, fz);
      expect(Math.hypot(wd.x, wd.z)).toBeCloseTo(1, 10);
    }
  });
  it("is today's mapping at yaw 0 (+x is screen left)", () => {
    expect(cameraRelative(1, 0, 0, 1)).toEqual({ x: -1, z: 0 });
    expect(cameraRelative(0, 1, 0, 1)).toEqual({ x: 0, z: 1 });
  });
});

describe("turning, tilting and zooming", () => {
  it("mouse right turns the view right, down tilts it down, inside the tilt band", () => {
    const o = fresh();
    lookOrbit(100, 0, o);
    expect(o.target.yaw).toBeLessThan(0); // the heading swings toward screen right (−x at yaw 0)
    lookOrbit(0, 50, o);
    expect(o.target.pitch).toBeGreaterThan(DEFAULT_PITCH);
    lookOrbit(0, 1e6, o);
    expect(o.target.pitch).toBe(PITCH_MAX);
    lookOrbit(0, -1e6, o);
    expect(o.target.pitch).toBe(PITCH_MIN);
    o.prefs.invertY = true;
    lookOrbit(0, -50, o);
    expect(o.target.pitch).toBeGreaterThan(PITCH_MIN);
  });
  it("the band is a little steeper than today down to a lower view", () => {
    expect(PITCH_MAX).toBeGreaterThan(DEFAULT_PITCH);
    expect(PITCH_MIN).toBeLessThan(DEFAULT_PITCH);
    expect(PITCH_MAX * 180 / Math.PI).toBeLessThan(50);
  });
  it("arrows turn (← left) and tilt (↑ up) at the key rate, and the view eases there without overshoot", () => {
    const o = fresh();
    for (let i = 0; i < 30; i++) stepOrbit(1 / 60, { arrowleft: true, arrowup: true }, o);
    expect(o.target.yaw).toBeGreaterThan(0);
    expect(o.target.pitch).toBeLessThan(DEFAULT_PITCH);
    let last = o.view.yaw;
    for (let i = 0; i < 60; i++) { stepOrbit(1 / 60, {}, o); expect(o.view.yaw).toBeGreaterThanOrEqual(last); expect(o.view.yaw).toBeLessThanOrEqual(o.target.yaw); last = o.view.yaw; }
    expect(o.view.yaw).toBeCloseTo(o.target.yaw, 6); // a second later it is there: a short ease
  });
  it("zooms in its band; Z flips out and back", () => {
    const o = fresh();
    zoomOrbit(1e5, o); expect(o.target.zoom).toBe(ZOOM_MAX);
    zoomOrbit(-1e5, o); expect(o.target.zoom).toBe(ZOOM_MIN);
    o.target.zoom = 1; toggleZoom(o); expect(o.target.zoom).toBe(ZOOM_OUT); toggleZoom(o); expect(o.target.zoom).toBe(1);
  });
  it("snaps back to today's view the short way round", () => {
    for (const [from, to] of [[5.9, 2 * Math.PI], [-3.5, -2 * Math.PI], [0.3, 0], [-0.3, 0], [7, 2 * Math.PI]]) {
      const o = fresh({ yaw: from, pitch: PITCH_MIN, zoom: 1.5 });
      snapBack(o);
      expect(o.target.yaw).toBeCloseTo(to, 10);
      expect(Math.abs(o.target.yaw - from)).toBeLessThanOrEqual(Math.PI);
      expect(o.target.pitch).toBe(DEFAULT_PITCH); expect(o.target.zoom).toBe(1);
      expect(wrapAngle(o.target.yaw)).toBeCloseTo(0, 10);
    }
  });
  it("steps a quarter turn from the nearest quarter (the painter's draft walk)", () => {
    const o = fresh({ yaw: 0.2 });
    turnQuarter(1, o); expect(o.target.yaw).toBeCloseTo(Math.PI / 2, 12);
    turnQuarter(1, o); turnQuarter(1, o); expect(o.target.yaw).toBeCloseTo(1.5 * Math.PI, 12);
    turnQuarter(-1, o); expect(o.target.yaw).toBeCloseTo(Math.PI, 12);
    snapBack(o); expect(wrapAngle(o.target.yaw)).toBeCloseTo(0, 12); // half a turn away either way: a whole turn
  });
  it("wraps angles into (−π, π]", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(wrapAngle(0.5 - 4 * Math.PI)).toBeCloseTo(0.5, 10);
  });
});

describe("gentle auto-follow", () => {
  /** Run `seconds` at 60 fps with the velocity (vx, vz), the camera input left alone (stepOrbit counts the idle time). */
  const run = (o: ReturnType<typeof fresh>, seconds: number, vx: number, vz: number, allowed = true) => {
    for (let i = 0; i < seconds * 60; i++) { autoFollow(1 / 60, vx, vz, allowed, o); stepOrbit(1 / 60, {}, o); }
  };
  it("swings in behind a running player once the camera has been left alone a moment", () => {
    const o = fresh();
    run(o, FOLLOW_IDLE * 0.9, 9, 0); // running +x (heading π/2): not yet
    expect(o.target.yaw).toBe(0);
    run(o, 3, 9, 0);
    expect(o.target.yaw).toBeGreaterThan(0.8); // well on its way round
    expect(o.target.yaw).toBeLessThan(3 * FOLLOW_TURN); // gently: never faster than its turn rate
    run(o, 10, 9, 0);
    expect(o.target.yaw).toBeCloseTo(Math.PI / 2, 2); // behind the way they run
  });
  it("eases in, never jumps", () => {
    const o = fresh({}); o.idle = FOLLOW_IDLE;
    let last = 0;
    for (let i = 0; i < 240; i++) { autoFollow(1 / 60, 0.2 * 9, -9, true, o); stepOrbit(1 / 60, {}, o); expect(Math.abs(o.target.yaw - last)).toBeLessThan(0.03); last = o.target.yaw; }
  });
  it("yields to any camera input at once, and waits again before swinging", () => {
    const o = fresh(); o.idle = 5;
    autoFollow(1 / 60, 9, 0, true, o);
    lookOrbit(-30, 0, o); // the mouse turns the other way
    const held = o.target.yaw;
    run(o, FOLLOW_IDLE * 0.9, 9, 0);
    expect(o.target.yaw).toBe(held);
    stepOrbit(1 / 60, { arrowleft: true }, o);
    expect(o.idle).toBe(0);
  });
  it("leaves the camera be while standing, running at it, when not allowed or switched off", () => {
    const o = fresh(); o.idle = 5;
    run(o, 3, 0.5, 0); // a shuffle, not a run
    expect(o.target.yaw).toBe(0);
    run(o, 3, 0, -9); // straight at the camera: no swing round to face them
    expect(o.target.yaw).toBe(0);
    run(o, 3, 9, 0, false); // the cursor hold, a sheet, the crosshair
    expect(o.target.yaw).toBe(0);
    o.prefs.autoFollow = false;
    run(o, 3, 9, 0);
    expect(o.target.yaw).toBe(0);
  });
});

describe("mouse capture", () => {
  const run = (from: CaptureState, events: CaptureEvent[]) => events.reduce<{ state: CaptureState; requests: number; exits: number }>((acc, e) => {
    const step = nextCapture(acc.state, e);
    return { state: step.state, requests: acc.requests + (step.request ? 1 : 0), exits: acc.exits + (step.exit ? 1 : 0) };
  }, { state: from, requests: 0, exits: 0 });

  it("a click asks for the lock; the lock captures; Esc (the browser's unlock) frees it", () => {
    expect(run("off", ["enable"]).state).toBe("free");
    expect(run("free", ["click"])).toEqual({ state: "free", requests: 1, exits: 0 });
    expect(run("free", ["click", "locked"]).state).toBe("captured");
    expect(run("captured", ["unlocked"]).state).toBe("free");
    expect(run("captured", ["click"]).state).toBe("captured"); // a left click in mouse-look does nothing here
  });
  it("holding right click is the cursor; letting go asks again and captures", () => {
    expect(run("captured", ["rightDown"])).toEqual({ state: "cursor", requests: 0, exits: 1 });
    expect(run("captured", ["rightDown", "unlocked"]).state).toBe("cursor"); // our own release, not Esc
    expect(run("captured", ["rightDown", "unlocked", "rightUp"])).toEqual({ state: "free", requests: 1, exits: 1 });
    expect(run("captured", ["rightDown", "unlocked", "rightUp", "locked"]).state).toBe("captured");
    // A refused request (Chrome's cooldown, a gesture that ran out) leaves the hint; the next click asks again.
    expect(run("captured", ["rightDown", "unlocked", "rightUp", "failed", "click"])).toEqual({ state: "free", requests: 2, exits: 1 });
    expect(run("free", ["rightDown", "rightUp"]).state).toBe("free"); // a right click that began free is just a click
  });
  it("sheets, dialogs and text fields release it; closing them does not re-capture", () => {
    expect(run("captured", ["menuOpen"])).toEqual({ state: "menu", requests: 0, exits: 1 });
    expect(run("captured", ["menuOpen", "unlocked", "click"]).state).toBe("menu");
    expect(run("captured", ["menuOpen", "unlocked", "menuClose"])).toEqual({ state: "free", requests: 0, exits: 1 });
    expect(run("cursor", ["menuOpen", "rightUp"])).toEqual({ state: "menu", requests: 0, exits: 0 });
    expect(run("menu", ["locked"])).toEqual({ state: "menu", requests: 0, exits: 1 });
  });
  it("the setting (or a touch screen) turns it off, letting go of a held lock", () => {
    expect(run("captured", ["disable"])).toEqual({ state: "off", requests: 0, exits: 1 });
    expect(run("off", ["click", "locked", "rightDown", "menuOpen"]).state).toBe("off");
    expect(run("off", ["disable", "enable"]).state).toBe("free");
  });
});

describe("the crosshair", () => {
  it("aims at the ground drawn under the screen centre, straight ahead along the heading, at every yaw and tilt", () => {
    const hit = new THREE.Vector3(), view = new THREE.Vector3();
    for (const yaw of YAWS) for (const pitch of [PITCH_MIN, DEFAULT_PITCH, PITCH_MAX]) {
      const { camera, focus } = rig(yaw, pitch);
      expect(crosshairAim(camera, () => 0, 0, hit)).not.toBeNull();
      const dx = hit.x - focus.x, dz = hit.z - focus.z;
      expect(dx * Math.cos(yaw) - dz * Math.sin(yaw)).toBeCloseTo(0, 3); // on the heading's line
      expect(dx * Math.sin(yaw) + dz * Math.cos(yaw)).toBeGreaterThan(1.5); // past the look point
      // Where the curved world draws that ground point is the screen centre.
      view.copy(hit).applyMatrix4(camera.matrixWorldInverse);
      bendViewPoint(view).applyMatrix4(camera.projectionMatrix);
      expect(Math.abs(view.x)).toBeLessThan(0.01); expect(Math.abs(view.y)).toBeLessThan(0.01);
    }
  });
  it("reaches further as the camera tilts up", () => {
    const hit = new THREE.Vector3(), reach = (pitch: number) => { const { camera, focus } = rig(0.7, pitch); crosshairAim(camera, () => 0, 0, hit); return hit.distanceTo(focus); };
    expect(reach(PITCH_MIN)).toBeGreaterThan(reach(DEFAULT_PITCH));
    expect(reach(DEFAULT_PITCH)).toBeGreaterThan(reach(PITCH_MAX));
  });
});

describe("this device", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it("remembers the angle, zoom and preferences; a broken value falls back", () => {
    const saved = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v); } });
    saveOrbit(fresh({ yaw: 7, pitch: 0.5, zoom: 1.2 }));
    const stored = JSON.parse(saved.get("tsi.camera.v1")!);
    expect(stored.yaw).toBeCloseTo(7 - 2 * Math.PI, 10);
    saved.set("tsi.camera.v1", JSON.stringify({ ...stored, pitch: 9, sensitivity: 2, invertY: true }));
    const o = fresh();
    loadOrbit(o);
    expect(o.target.yaw).toBeCloseTo(7 - 2 * Math.PI, 10);
    expect(o.view.yaw).toBe(o.target.yaw); // no swing on load
    expect(o.target.pitch).toBe(PITCH_MAX);
    expect(o.target.zoom).toBe(1.2);
    expect(o.prefs).toEqual({ sensitivity: 2, invertY: true, mouseLook: true, autoFollow: true });
  });
});
