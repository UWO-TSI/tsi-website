import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import MiniMap from "./MiniMap";
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
