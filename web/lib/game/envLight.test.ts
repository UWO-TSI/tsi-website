import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { applyEnvironment, disposeEnvironment, sunU, type EnvPhaseSpec } from "./envLight";

const spec = (intensity: number): EnvPhaseSpec => ({ skyTop: "#4FB6F5", skyBottom: "#A9DCF2", sun: "#FFFDF4", ground: "#84CB47", intensity, sunElev: 0.6 });
const DAY = spec(0.2), DUSK = spec(0.3), NIGHT = spec(0.22);

const mocks = vi.hoisted(() => ({ generators: [] as { renderer: unknown; dispose: ReturnType<typeof vi.fn> }[], targets: [] as import("three").WebGLRenderTarget[], fail: false }));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    PMREMGenerator: class {
      dispose = vi.fn();
      constructor(public renderer: unknown) { mocks.generators.push(this); }
      fromEquirectangular() {
        if (mocks.fail) throw new Error("GPU bake failed");
        const target = new actual.WebGLRenderTarget(1, 1);
        mocks.targets.push(target);
        return target;
      }
    },
  };
});

beforeEach(() => {
  mocks.generators.length = 0;
  mocks.targets.length = 0;
  mocks.fail = false;
  const gradient = () => ({ addColorStop: vi.fn() });
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({
    createLinearGradient: gradient, createRadialGradient: gradient, fillRect: vi.fn(),
  }) }) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("environment GPU resource ownership", () => {
  it("caches a phase per scene and disposes generator scratch memory after baking", () => {
    const scene = new THREE.Scene();
    const renderer = {} as THREE.WebGLRenderer;
    applyEnvironment(renderer, scene, DAY);
    const texture = scene.environment;
    applyEnvironment(renderer, scene, DAY);
    expect(scene.environment).toBe(texture);
    expect(mocks.generators).toHaveLength(1);
    expect(mocks.generators[0].dispose).toHaveBeenCalledOnce();
    expect(scene.environmentIntensity).toBe(DAY.intensity);
    disposeEnvironment(scene);
    expect(scene.environment).toBeNull();
  });

  it("keeps separate scenes independent and releases only the replaced texture", () => {
    const first = new THREE.Scene(), second = new THREE.Scene();
    const renderer = {} as THREE.WebGLRenderer;
    applyEnvironment(renderer, first, DAY);
    applyEnvironment(renderer, second, NIGHT);
    const firstDisposed = vi.fn(), secondDisposed = vi.fn();
    mocks.targets[0].addEventListener("dispose", firstDisposed);
    mocks.targets[1].addEventListener("dispose", secondDisposed);
    applyEnvironment(renderer, first, DUSK);
    expect(firstDisposed).toHaveBeenCalledOnce();
    expect(secondDisposed).not.toHaveBeenCalled();
    disposeEnvironment(first);
    expect(second.environment).not.toBeNull();
    disposeEnvironment(second);
    expect(secondDisposed).toHaveBeenCalledOnce();
  });

  it("uses the replacement renderer even when the phase has not changed", () => {
    const scene = new THREE.Scene();
    const oldRenderer = {} as THREE.WebGLRenderer, newRenderer = {} as THREE.WebGLRenderer;
    applyEnvironment(oldRenderer, scene, DAY);
    const old = scene.environment;
    applyEnvironment(newRenderer, scene, DAY);
    expect(scene.environment).not.toBe(old);
    expect(mocks.generators.map((entry) => entry.renderer)).toEqual([oldRenderer, newRenderer]);
    disposeEnvironment(scene);
  });

  it("preserves the previous environment and releases scratch memory after a failed bake", () => {
    const scene = new THREE.Scene();
    const renderer = {} as THREE.WebGLRenderer;
    applyEnvironment(renderer, scene, DAY);
    const previous = scene.environment;
    mocks.fail = true;
    expect(() => applyEnvironment(renderer, scene, NIGHT)).toThrow("GPU bake failed");
    expect(scene.environment).toBe(previous);
    expect(mocks.generators[1].dispose).toHaveBeenCalledOnce();
    disposeEnvironment(scene);
  });

  it("does not clear an environment installed by another owner; repeated cleanup is safe", () => {
    const scene = new THREE.Scene();
    applyEnvironment({} as THREE.WebGLRenderer, scene, DAY);
    const disposed = vi.fn();
    mocks.targets[0].addEventListener("dispose", disposed);
    const replacement = new THREE.Texture();
    scene.environment = replacement;
    disposeEnvironment(scene);
    disposeEnvironment(scene);
    expect(scene.environment).toBe(replacement);
    expect(disposed).toHaveBeenCalledOnce();
    replacement.dispose();
  });

  it("applies the island palette it is given", () => {
    const scene = new THREE.Scene();
    applyEnvironment({} as THREE.WebGLRenderer, scene, { ...DAY, intensity: 0.27, ground: "#b6c593" });
    expect(scene.environmentIntensity).toBe(0.27);
    disposeEnvironment(scene);
  });
});

it("maps a world azimuth onto three's equirect u (u = atan(z, x) / 2π + 0.5)", () => {
  expect(sunU(0)).toBeCloseTo(0.5);
  expect(sunU(90)).toBeCloseTo(0.75);
  expect(sunU(-90)).toBeCloseTo(0.25);
  expect(sunU(180)).toBeCloseTo(0);
  expect(sunU(-28.8)).toBeCloseTo(0.42, 2);
});
