import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { applyEnvironment, disposeEnvironment, ENV_PHASES } from "./envLight";

const baked = vi.hoisted(() => ({ targets: [] as { texture: object; dispose: ReturnType<typeof vi.fn> }[], generators: [] as { dispose: ReturnType<typeof vi.fn> }[] }));
vi.mock("three", async importOriginal => {
  const original = await importOriginal<typeof import("three")>();
  return { ...original, PMREMGenerator: class {
    dispose = vi.fn();
    constructor() { baked.generators.push(this); }
    fromEquirectangular() {
      const target = { texture: new original.Texture(), dispose: vi.fn() };
      baked.targets.push(target);
      return target;
    }
  } };
});

beforeEach(() => {
  baked.targets.length = 0; baked.generators.length = 0;
  const gradient = () => ({ addColorStop: vi.fn() });
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ createLinearGradient: gradient, createRadialGradient: gradient, fillRect: vi.fn() }) }) });
});
afterEach(() => vi.unstubAllGlobals());

describe("environment lighting lifecycle", () => {
  it("keeps two mounted canvases independent when one changes phase or unmounts", () => {
    const a = new THREE.Scene(), b = new THREE.Scene();
    const rendererA = {} as THREE.WebGLRenderer, rendererB = {} as THREE.WebGLRenderer;
    applyEnvironment(rendererA, a, "day");
    applyEnvironment(rendererB, b, "night");
    expect(a.environment).not.toBe(b.environment);
    applyEnvironment(rendererA, a, "dusk");
    expect(baked.targets[0].dispose).toHaveBeenCalledOnce();
    expect(baked.targets[1].dispose).not.toHaveBeenCalled();
    disposeEnvironment(a);
    expect(b.environment).toBe(baked.targets[1].texture);
    expect(baked.generators[0].dispose).toHaveBeenCalledOnce();
    expect(baked.generators[1].dispose).not.toHaveBeenCalled();
    disposeEnvironment(b);
  });

  it("reuses an unchanged phase and rebuilds after disposal with the new renderer", () => {
    const scene = new THREE.Scene(), renderer = {} as THREE.WebGLRenderer;
    applyEnvironment(renderer, scene, "day");
    applyEnvironment(renderer, scene, "day");
    expect(baked.targets).toHaveLength(1);
    disposeEnvironment(scene);
    expect(scene.environment).toBeNull();
    applyEnvironment({} as THREE.WebGLRenderer, scene, "day");
    expect(baked.generators).toHaveLength(2);
    expect(scene.environment).toBe(baked.targets[1].texture);
    disposeEnvironment(scene);
  });

  it("accepts an island palette without mutating the member-world default", () => {
    const scene = new THREE.Scene();
    const original = { ...ENV_PHASES.day };
    const palette = { ...original, intensity: 0.27, ground: "#b6c593" };
    applyEnvironment({} as THREE.WebGLRenderer, scene, "day", palette);
    expect(scene.environmentIntensity).toBe(0.27);
    expect(ENV_PHASES.day).toEqual(original);
    disposeEnvironment(scene);
  });
});
