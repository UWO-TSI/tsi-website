import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

// The pack's texture loads through the DOM; a plain texture stands in for it here.
vi.mock("./movement/moveFx", async orig => ({ ...(await orig<typeof import("./movement/moveFx")>()), packMap: () => new THREE.Texture() }));
const { glowOf, joinGlow } = await import("./GlowFx");

describe("the scene's shared glow layer", () => {
  it("survives React's StrictMode effect replay (mount, clean up, mount again): the second mount finds it", () => {
    const scene = new THREE.Scene();
    const fx = glowOf(scene);
    joinGlow(scene)();
    let leave: () => void = () => {};
    expect(() => { leave = joinGlow(scene); }).not.toThrow();
    expect(scene.children).toContain(fx.mesh);
    leave();
    expect(scene.children).not.toContain(fx.mesh);
  });

  it("hands a room's first user the system its last one left (one commit: the old cleanups run before the new effects)", () => {
    const scene = new THREE.Scene();
    const outside = glowOf(scene), leaveOutside = joinGlow(scene);
    // The next room renders (and takes the system) before the island's users clean up.
    const inside = glowOf(scene);
    leaveOutside();
    expect(() => joinGlow(scene)).not.toThrow();
    expect(inside).toBe(outside);
    expect(scene.children).toContain(inside.mesh);
  });
});
