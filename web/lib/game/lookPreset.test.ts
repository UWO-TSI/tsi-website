import { describe, expect, it } from "vitest";
import { DEFAULT_SHADOW, ISLAND_LIGHTING, withSeason, withWeather } from "./islandLighting";
import { CURRENT, LOOK_LIGHTS_CHUNK, LOOK_PRESETS, keyFill, kelvinHex, lookFx, lookRoughness, lookToLight, parseLook, sunAngles, sunFromAngles } from "./lookPreset";
import { seasonLook } from "./seasonalLook";
import { parseSeasonOverride } from "./season";

const day = ISLAND_LIGHTING.day;

describe("look presets: serialisation", () => {
  it("round-trips every preset through JSON unchanged", () => {
    for (const p of LOOK_PRESETS) expect(parseLook(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("fills missing or wrongly typed fields from Current and drops unknown ones", () => {
    const p = parseLook({ name: "Partial", light: { sunIntensity: 4, sunColor: "red", sunPosition: [1, 2] }, grade: { exposure: "x" }, post: { toneMapping: "filmic" }, extra: 1 });
    expect(p.name).toBe("Partial");
    expect(p.light.sunIntensity).toBe(4);
    expect(p.light.sunColor).toBe(CURRENT.light.sunColor);
    expect(p.light.sunPosition).toEqual(CURRENT.light.sunPosition);
    expect(p.grade.exposure).toBe(CURRENT.grade.exposure);
    expect(p.post.toneMapping).toBe("neutral");
    expect("extra" in p).toBe(false);
    expect(parseLook(null)).toEqual(CURRENT);
  });
  it("gives each preset a unique id and a distinct direction", () => {
    expect(new Set(LOOK_PRESETS.map(p => p.id)).size).toBe(LOOK_PRESETS.length);
    expect(LOOK_PRESETS.map(p => p.id)).toEqual(["current", "toy", "open-air", "painterly"]);
  });
});

describe("look presets: renderer mapping", () => {
  it("maps Current onto the shipped day profile exactly", () => {
    const light = lookToLight(CURRENT, day);
    expect(light).toMatchObject(day);
    expect(light.shadow).toEqual(DEFAULT_SHADOW);
    expect(light.fogColor).toBe(day.sky);
    expect(light.rim).toBeUndefined();
    expect(light.skyTop).toBeUndefined();
    expect(light.water).toBe(day.water);
    const fx = lookFx(CURRENT, true);
    expect(fx).toEqual({ toneMapping: "neutral", bloom: null, tiltShift: null, ao: null });
  });
  it("writes a preset's light, sky and grade into the renderer's fields", () => {
    const toy = LOOK_PRESETS[1], light = lookToLight(toy, day);
    expect(light.sunPosition).toEqual(toy.light.sunPosition);
    expect(light.sunIntensity).toBe(toy.light.sunIntensity);
    expect(light.environment).toMatchObject({ skyTop: toy.sky.top, skyBottom: toy.sky.horizon, intensity: toy.light.envIntensity, sunElev: day.environment.sunElev });
    expect(light.skyTop).toBe(toy.sky.top);
    expect(light.rim).toEqual({ color: toy.light.rimColor, intensity: toy.light.rimIntensity });
    expect(light.grade).toBe(toy.grade);
    expect(light.water.sunGlint).toBeCloseTo(day.water.sunGlint * 1.3);
    expect(light.water.deepColor).not.toBe(day.water.deepColor);
  });
  it("keeps season and weather layering on top of a preset", () => {
    const summer = seasonLook(parseSeasonOverride("?season=summer")!, {});
    const rainy = withWeather(withSeason(lookToLight(LOOK_PRESETS[2], day), summer), "rain");
    expect(rainy.sunIntensity).toBeLessThan(LOOK_PRESETS[2].light.sunIntensity);
    expect(rainy.skyTop).not.toBe(LOOK_PRESETS[2].sky.top);
    expect(rainy.fogColor).not.toBe(LOOK_PRESETS[2].sky.fog);
  });
  it("turns AO, tilt-shift and bloom off on the Light tier", () => {
    for (const p of LOOK_PRESETS.slice(1)) {
      expect(lookFx(p, false)).toEqual({ toneMapping: p.post.toneMapping, bloom: null, tiltShift: null, ao: null });
      expect(lookFx(p, true).ao).toEqual(p.ao);
    }
  });
  it("pulls roughness toward toy plastic with gloss and never raises it", () => {
    expect(lookRoughness(0.85, { saturation: 1, value: 1, roughness: 1, gloss: 0 })).toBe(0.85);
    expect(lookRoughness(0.85, { saturation: 1, value: 1, roughness: 1, gloss: 1 })).toBeCloseTo(0.3);
    expect(lookRoughness(0.1, { saturation: 1, value: 1, roughness: 1, gloss: 1 })).toBe(0.1);
    expect(lookRoughness(0.9, { saturation: 1, value: 1, roughness: 2, gloss: 0 })).toBe(1);
  });
  it("rewrites the key light's shadow term in three's chunk (fails if three changes it)", () => {
    expect(LOOK_LIGHTS_CHUNK).toContain("mix( uLookShadowTint, vec3( 1.0 ), ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap");
  });
});

describe("look presets: light budget", () => {
  it("measures the shipped day at about 1.4:1 key:fill and 2:1 lit:shadow (D3)", () => {
    const r = keyFill(CURRENT);
    expect(r.keyFill).toBeGreaterThan(1.3);
    expect(r.keyFill).toBeLessThan(1.55);
    expect(r.litShadow).toBeCloseTo(2, 0);
  });
  it("gives the open-air direction the ~4:1 key:fill the D3 note targets", () => {
    expect(keyFill(LOOK_PRESETS[2]).keyFill).toBeGreaterThan(3.5);
  });
  it("converts sun angles both ways and colour temperature to warm/cool hex", () => {
    const { elevation, azimuth } = sunAngles([-12, 24, -14]);
    const back = sunFromAngles(elevation, azimuth, Math.hypot(12, 24, 14));
    expect(back[0]).toBeCloseTo(-12, 1); expect(back[1]).toBeCloseTo(24, 1); expect(back[2]).toBeCloseTo(-14, 1);
    expect(kelvinHex(6600)).toBe("#ffffff");
    expect(parseInt(kelvinHex(3000).slice(5), 16)).toBeLessThan(parseInt(kelvinHex(3000).slice(1, 3), 16));
    expect(parseInt(kelvinHex(10000).slice(5), 16)).toBe(255);
  });
});
