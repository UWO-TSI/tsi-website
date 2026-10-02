import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import MiniMap, { minimapTurn } from "./MiniMap";
import { actionForKey, mergeSettings, DEFAULT_SETTINGS } from "@/lib/identity/settings";

const plot = { viewBox: "0 0 10 10", content: null, north: [0, 0] as [number, number] };
const map = (toggleKey?: string) => renderToStaticMarkup(createElement(MiniMap, { playerPosRef: { current: new THREE.Vector3() }, onClose: () => {}, plot, toggleKey }));

describe("HUD key labels follow remaps", () => {
  it("names the account's map key on the minimap", () => {
    expect(map()).toContain("M to hide");
    const remapped = mergeSettings(DEFAULT_SETTINGS, { key_bindings: { openMap: "n" } });
    expect(remapped.ok).toBe(true);
    const keys = remapped.ok ? remapped.settings.key_bindings : DEFAULT_SETTINGS.key_bindings;
    expect(actionForKey(remapped.ok ? remapped.settings : DEFAULT_SETTINGS, "n")).toBe("openMap");
    expect(map(keys.openMap)).toContain("N to hide");
    expect(map(keys.openMap)).not.toContain("M to hide");
  });
});

describe("the minimap turns with the camera", () => {
  /** A world direction (x, z) drawn on a plot (z negated, x mirrored or not) and turned by the map's rotation (SVG: clockwise, y down). */
  const onMap = (x: number, z: number, yaw: number, mirror: boolean) => {
    const px = mirror ? -x : x, py = -z, a = (minimapTurn(yaw, mirror) * Math.PI) / 180;
    return [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)];
  };
  it("puts the camera's forward up and its right to the right at every heading", () => {
    for (let i = 0; i < 24; i++) {
      const yaw = (i * Math.PI) / 12 - Math.PI;
      const [fx, fy] = onMap(Math.sin(yaw), Math.cos(yaw), yaw, true);
      expect(fx).toBeCloseTo(0, 10); expect(fy).toBeCloseTo(-1, 10);
      // The screen's right is forward × up = (−cos, sin).
      const [rx, ry] = onMap(-Math.cos(yaw), Math.sin(yaw), yaw, true);
      expect(rx).toBeCloseTo(1, 10); expect(ry).toBeCloseTo(0, 10);
      // An unmirrored plot keeps the forward up (it was never the screen's left-right).
      const [ux, uy] = onMap(Math.sin(yaw), Math.cos(yaw), yaw, false);
      expect(ux).toBeCloseTo(0, 10); expect(uy).toBeCloseTo(-1, 10);
    }
  });
  it("does not turn in today's view", () => {
    expect(minimapTurn(0, true)).toBeCloseTo(0, 12);
    expect(minimapTurn(Math.PI / 2, true)).toBeCloseTo(90, 10);
  });
});
