import { describe, expect, it } from "vitest";
import { WATER_SWELL, waterSwellAt } from "./waterShader";
import { TUNING_DEFAULTS } from "./tuning";

const SEA = TUNING_DEFAULTS.water;

/** WATER_SWELL in plain numbers, as the GPU runs it (float math aside): the oracle the CPU mirror must agree with. */
function glslSwell(x: number, z: number, t: number, p = SEA) {
  const k = 6.2831853 / Math.max(p.waveScale, 0.001);
  const n1 = Math.hypot(1, 0.35), n2 = Math.hypot(-0.42, 1);
  const d1 = [1 / n1, 0.35 / n1], d2 = [-0.42 / n2, 1 / n2];
  const phase = (v: number) => v - 6.2831853 * Math.floor(v / 6.2831853);
  const a1 = (x * d1[0] + z * d1[1]) * k + phase(t * p.waveSpeed);
  const a2 = (x * d2[0] + z * d2[1]) * k * 1.63 + phase(t * p.waveSpeed * 1.31);
  return (Math.sin(a1) * 0.62 + Math.sin(a2) * 0.38) * p.waveHeight;
}

describe("the shared swell on the CPU (what the boat and the buoys float on)", () => {
  it("prints the same waves into the shader that it computes", () => {
    for (const piece of ["vec2(1.00, 0.35)", "vec2(-0.42, 1.00)", "1.63", "1.31", "0.62", "0.38"]) expect(WATER_SWELL).toContain(piece);
  });

  it("matches the shader's swell everywhere on the island, at any hour", () => {
    for (const t of [0, 13.7, 4021.5, 86399])
      for (const [x, z] of [[8, -22], [2.3, -12.4], [-30, 31], [100, -80]])
        expect(waterSwellAt(x, z, t, SEA)).toBeCloseTo(glslSwell(x, z, t), 6);
  });

  it("never rises or falls past the wave height", () => {
    let most = 0;
    for (let i = 0; i < 2000; i++) most = Math.max(most, Math.abs(waterSwellAt(i * 0.37 - 300, i * 0.91 - 700, i * 1.3, SEA)));
    expect(most).toBeLessThanOrEqual(SEA.waveHeight + 1e-9);
    expect(most).toBeGreaterThan(SEA.waveHeight * 0.8);
  });

  it("gives the slope of the surface it describes", () => {
    const grad = { x: 0, z: 0 }, e = 1e-4;
    for (const [x, z, t] of [[8, -22, 5], [-3, 7.5, 900], [40, -40, 33]]) {
      waterSwellAt(x, z, t, SEA, grad);
      expect(grad.x).toBeCloseTo((waterSwellAt(x + e, z, t, SEA) - waterSwellAt(x - e, z, t, SEA)) / (2 * e), 6);
      expect(grad.z).toBeCloseTo((waterSwellAt(x, z + e, t, SEA) - waterSwellAt(x, z - e, t, SEA)) / (2 * e), 6);
    }
  });
});
