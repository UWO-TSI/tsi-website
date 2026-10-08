import { describe, expect, it } from "vitest";
import { Color, ShaderChunk, ShaderLib, Vector3 } from "three";
import { ISLAND_LIGHTING, islandLight, withSeason, withWeather, type IslandLight } from "./islandLighting";
import { BACKLIT_FILL, backlitShare, fillForHeading, CURRENT, LOOK_LIGHTS_CHUNK, LOOK_PRESETS, LOOK_REFLECT_EDITS, MATERIAL_CLASSES, MIN_SUN_ELEVATION, PHASE_LOOK, keyFill, shadowHalfHeight, kelvinHex, lookFx, lookRoughness, parseLook, sunAngles, sunFromAngles } from "./lookPreset";
import { solarPosition } from "./sunPath";
import { seasonLook } from "./seasonalLook";
import { parseSeasonOverride } from "./season";
import { ISLAND_PHASES, type IslandPhase } from "./islandTime";
import { ISLAND_WEATHERS } from "./islandWeather";

/** The sun's horizontal angle from the fixed follow camera (on −z looking +z): 0 = straight behind it, + = screen-left (+x). */
const sunFromCamera = ([x, , z]: readonly number[]) => Math.atan2(x, -z) * 180 / Math.PI;

const lin = (hex: string) => new Color(hex);
const lum = (hex: string) => { const c = lin(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
const sat = (hex: string) => { const hsl = { h: 0, s: 0, l: 0 }; lin(hex).getHSL(hsl); return hsl.s; };
/** Key vs fill on flat ground for a rendered profile (the IBL counted as π · sky · intensity). */
const ratio = (l: IslandLight) => {
  const [x, y, z] = l.sunPosition, key = l.sunIntensity * lum(l.sun) * y / Math.hypot(x, y, z);
  const fill = (l.ambient + l.hemisphere) * lum(l.fill) + Math.PI * l.environment.intensity * (lum(l.environment.skyTop) + lum(l.environment.skyBottom)) / 2;
  return key / fill;
};
const summer = seasonLook(parseSeasonOverride("?season=summer")!, {});

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
    expect(p.post.toneMapping).toBe(CURRENT.post.toneMapping);
    expect(p.grass).toEqual(CURRENT.grass);
    expect("extra" in p).toBe(false);
    expect(parseLook(null)).toEqual(CURRENT);
  });
  it("gives each preset a unique id", () => {
    expect(LOOK_PRESETS.map(p => p.id)).toEqual(["current", "toy", "open-air", "painterly"]);
  });
});

describe("the game look (row 236, §5)", () => {
  it("is Open-air sun: the picked preset's sun side and colour, blue fill, cool shadows, sky, AO and bloom", () => {
    const picked = LOOK_PRESETS.find(p => p.id === "open-air")!;
    expect(sunFromCamera(CURRENT.light.sunPosition)).toBeCloseTo(sunFromCamera(picked.light.sunPosition), 0);
    expect(CURRENT.light.sunColor).toBe(picked.light.sunColor);
    expect(CURRENT.light.fillSky).toBe(picked.light.fillSky);
    expect(CURRENT.shadows).toEqual(picked.shadows);
    expect(CURRENT.sky.top).toBe(picked.sky.top);
    expect(CURRENT.ao).toEqual(picked.ao);
    expect(CURRENT.post.bloom.enabled && !CURRENT.post.tiltShift.enabled).toBe(true);
    expect(CURRENT.sky.fogNear).toBeGreaterThan(picked.sky.fogNear);
  });
  it("holds key:fill near 4:1 and lit:shadow well above the shipped 2:1", () => {
    const r = keyFill(CURRENT);
    expect(r.keyFill).toBeGreaterThan(3.7);
    expect(r.keyFill).toBeLessThan(4.3);
    expect(r.litShadow).toBeGreaterThan(3);
    expect(ratio(islandLight(CURRENT, "day"))).toBeCloseTo(r.keyFill, 1);
  });
  it("restores grass texture contrast with a hue variation", () => {
    expect(CURRENT.grass.detail).toBeGreaterThan(0.38 * 1.5);
    expect(CURRENT.grass.hue).toBeGreaterThan(0);
  });
});

describe("preset → renderer mapping", () => {
  it("maps Current onto the day profile exactly", () => {
    const light = islandLight(CURRENT, "day");
    expect(light).toMatchObject({
      sun: CURRENT.light.sunColor, sunIntensity: CURRENT.light.sunIntensity, sunPosition: CURRENT.light.sunPosition,
      fill: CURRENT.light.fillSky, bounce: CURRENT.light.fillGround, ambient: CURRENT.light.ambient, hemisphere: CURRENT.light.hemisphere,
      sky: CURRENT.sky.horizon, skyTop: CURRENT.sky.top, fogColor: CURRENT.sky.fog, fogNear: CURRENT.sky.fogNear, fogFar: CURRENT.sky.fogFar,
      shadow: CURRENT.shadows, grade: CURRENT.grade,
    });
    expect(light.environment).toMatchObject({ skyTop: CURRENT.sky.top, skyBottom: CURRENT.sky.horizon, intensity: CURRENT.light.envIntensity });
    expect(light.rim).toBeUndefined();
    expect(lookFx(CURRENT, true)).toEqual({ toneMapping: CURRENT.post.toneMapping, bloom: CURRENT.post.bloom, tiltShift: null, ao: CURRENT.ao });
  });
  it("writes another preset's light, sky, rim, grade and water into the renderer's fields", () => {
    const toy = LOOK_PRESETS[1], light = islandLight(toy, "day");
    expect(light.sunPosition).toEqual(toy.light.sunPosition);
    expect(light.environment).toMatchObject({ skyTop: toy.sky.top, skyBottom: toy.sky.horizon, intensity: toy.light.envIntensity });
    expect(light.rim).toEqual({ color: toy.light.rimColor, intensity: toy.light.rimIntensity });
    expect(light.grade).toEqual(toy.grade);
    expect(light.water.sunGlint).toBeCloseTo(ISLAND_LIGHTING.day.water.sunGlint / 1.5 * 1.3);
  });
  it("keeps the same colours, ratio and sky on the Light tier and drops only AO, tilt-shift and bloom", () => {
    for (const p of LOOK_PRESETS) {
      expect(lookFx(p, false)).toEqual({ toneMapping: p.post.toneMapping, bloom: null, tiltShift: null, ao: null });
      if (p.ao.enabled) expect(lookFx(p, true).ao).toEqual(p.ao);
    }
  });
  it("pulls roughness toward toy plastic with gloss and never raises it", () => {
    expect(lookRoughness(0.85, { saturation: 1, value: 1, roughness: 1, gloss: 0 })).toBe(0.85);
    expect(lookRoughness(0.85, { saturation: 1, value: 1, roughness: 1, gloss: 1 })).toBeCloseTo(0.3);
    expect(lookRoughness(0.1, { saturation: 1, value: 1, roughness: 1, gloss: 1 })).toBe(0.1);
    expect(lookRoughness(0.9, { saturation: 1, value: 1, roughness: 2, gloss: 0 })).toBe(1);
    expect(lookRoughness(0.85, CURRENT.materials.props)).toBeLessThan(0.75);
  });
  it("rewrites the key light's shadow term in three's chunk (fails if three changes it)", () => {
    expect(LOOK_LIGHTS_CHUNK).toContain("mix( uLookShadowTint, vec3( 1.0 ), ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap");
  });
});

describe("the real sun (row 239, §8)", () => {
  it("lifts the fill while the sun is ahead of the camera, never when it is behind (row 253)", () => {
    const at = (iso: string) => islandLight(CURRENT, "day", solarPosition(new Date(iso)));
    const morning = at("2026-09-27T10:00:00-04:00"), afternoon = at("2026-09-27T17:00:00-04:00");
    const base = islandLight(CURRENT, "day");
    expect(morning.hemisphere).toBeCloseTo(base.hemisphere, 6);
    expect(afternoon.hemisphere).toBeGreaterThan(base.hemisphere * 1.2);
    expect(afternoon.hemisphere).toBeLessThanOrEqual(base.hemisphere * (1 + BACKLIT_FILL) + 1e-9);
    expect(afternoon.ambient / base.ambient).toBeCloseTo(afternoon.hemisphere / base.hemisphere, 6);
  });
  const key = (iso: string, phase: IslandPhase = "day") => islandLight(CURRENT, phase, solarPosition(new Date(iso))).sunPosition;
  const angle = (a: readonly number[], b: readonly number[]) => {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return Math.acos(Math.min(1, dot / Math.hypot(...a) / Math.hypot(...b))) * 180 / Math.PI;
  };
  /** Degrees off straight ahead of the camera (+z), + = screen-left. */
  const ahead = ([x, , z]: readonly number[]) => Math.atan2(x, z) * 180 / Math.PI;

  it("maps the compass onto the world: the camera looks west (+z), screen-left is south (+x)", () => {
    const flat = (azimuth: number) => { const [x, , z] = islandLight(CURRENT, "day", { elevation: 30, azimuth }).sunPosition; return [Math.round(x) || 0, Math.round(z) || 0]; };
    expect(flat(270)).toEqual([0, 28]);
    expect(flat(180)).toEqual([28, 0]);
    expect(flat(90)).toEqual([0, -28]);
    expect(flat(0)).toEqual([-28, 0]);
  });
  it("puts the 11:45 sun of Sep 27 within 3.5° of the picked Open-air key light", () => {
    expect(angle(key("2026-09-27T11:45:00-04:00"), CURRENT.light.sunPosition)).toBeLessThan(3.5);
    expect(angle(ISLAND_LIGHTING.day.sunPosition, CURRENT.light.sunPosition)).toBeLessThan(3.5);
  });
  it("front-lights the morning, lights midday from the left and comes round ahead from 15:00 (Sep 27)", () => {
    expect(sunFromCamera(key("2026-09-27T09:00:00-04:00"))).toBeGreaterThan(10);
    expect(sunFromCamera(key("2026-09-27T09:00:00-04:00"))).toBeLessThan(70);
    expect(sunFromCamera(key("2026-09-27T13:00:00-04:00"))).toBeGreaterThan(70);
    expect(sunFromCamera(key("2026-09-27T13:00:00-04:00"))).toBeLessThan(110);
    expect(ahead(key("2026-09-27T15:00:00-04:00"))).toBeLessThan(60);
    expect(ahead(key("2026-09-27T18:30:00-04:00", "evening"))).toBeLessThan(15);
  });
  it("sets ahead of the camera: just left in late September, right in June, left in December", () => {
    expect(ahead(key("2026-09-27T19:14:00-04:00", "evening"))).toBeCloseTo(1.7, 0);
    expect(ahead(key("2026-06-21T21:08:00-04:00", "evening"))).toBeCloseTo(-33.9, 0);
    expect(ahead(key("2026-12-21T16:54:00-05:00", "evening"))).toBeCloseTo(31.9, 0);
  });
  it("never lights edge-on: the key stays at least MIN_SUN_ELEVATION up around sunrise and sunset", () => {
    expect(solarPosition(new Date("2026-09-27T06:47:00-04:00")).elevation).toBeLessThan(0);
    expect(sunAngles(ISLAND_LIGHTING.dawn.sunPosition).elevation).toBeCloseTo(MIN_SUN_ELEVATION, 1);
    expect(sunAngles(key("2026-09-27T19:40:00-04:00", "evening")).elevation).toBeCloseTo(MIN_SUN_ELEVATION, 1);
    expect(sunAngles(key("2026-06-21T13:30:00-04:00")).elevation).toBeGreaterThan(65);
  });
  it("keeps night's fixed moon wherever the sun is", () => {
    const moon = key("2026-09-27T23:00:00-04:00", "night");
    expect(key("2026-06-21T02:00:00-04:00", "night")).toEqual(moon);
    expect(sunAngles(moon).elevation).toBeCloseTo(PHASE_LOOK.night.elevation!, 0);
    expect(sunAngles(moon).azimuth).toBeCloseTo(sunAngles(CURRENT.light.sunPosition).azimuth, 0);
  });
  it("fits the shadow box to the sun: the whole island and its casters inside, a low sun's box tighter", () => {
    for (const elevation of [MIN_SUN_ELEVATION, 25, 44, 71]) for (const azimuth of [90, 180, 250, 300]) {
      const sun = islandLight(CURRENT, "day", { elevation, azimuth }).sunPosition, half = shadowHalfHeight(sun, 26);
      const d = new Vector3(...sun).normalize(), up = new Vector3(0, 1, 0).addScaledVector(d, -d.y).normalize();
      for (let a = 0; a < 360; a += 15) for (const h of [0, 4.8]) {
        const p = new Vector3(26 * Math.cos(a * Math.PI / 180), h, 26 * Math.sin(a * Math.PI / 180));
        expect(Math.abs(p.dot(up)), `${elevation}° ${azimuth}°`).toBeLessThanOrEqual(half);
        expect(32 - p.dot(d)).toBeGreaterThan(1); // inside the near and far planes (1, 75)
        expect(32 - p.dot(d)).toBeLessThan(75);
      }
    }
    expect(shadowHalfHeight(CURRENT.light.sunPosition, 26)).toBeCloseTo(22.4, 1);
    expect(shadowHalfHeight(ISLAND_LIGHTING.evening.sunPosition, 26)).toBeLessThan(12);
  });
  it("keeps the preset's own key without a sun (/lab/look's sliders)", () => {
    for (const phase of ["dawn", "day", "evening"] as const) expect(islandLight(LOOK_PRESETS[1], phase).sunPosition).toEqual(LOOK_PRESETS[1].light.sunPosition);
  });
});

describe("time of day as multipliers on the day preset (§5.5)", () => {
  it("derives every phase from the one preset: editing the day look moves all of them", () => {
    const edited = parseLook({ ...CURRENT, light: { ...CURRENT.light, sunIntensity: 2 * CURRENT.light.sunIntensity }, sky: { ...CURRENT.sky, top: "#2060c0" } });
    for (const phase of ISLAND_PHASES) {
      expect(islandLight(edited, phase).sunIntensity).toBeCloseTo(2 * ISLAND_LIGHTING[phase].sunIntensity);
      expect(islandLight(edited, phase).skyTop).not.toBe(ISLAND_LIGHTING[phase].skyTop);
    }
  });
  it("makes dawn cool-pink with soft shadows, golden hour warm with a rim, night a blue moonlight key", () => {
    const { dawn, day, evening, night } = ISLAND_LIGHTING, rb = (hex: string) => lin(hex).r / lin(hex).b;
    expect(rb(dawn.sky)).toBeGreaterThan(1); // pink horizon
    expect(rb(dawn.skyTop!)).toBeLessThan(1); // blue-lilac top
    expect(dawn.shadow.radius).toBeGreaterThan(day.shadow.radius * 2);
    expect(rb(evening.sun)).toBeGreaterThan(rb(day.sun) * 2);
    expect(evening.rim!.intensity).toBeGreaterThan(0);
    expect(rb(evening.rim!.color)).toBeGreaterThan(1.5);
    expect(rb(night.sun)).toBeLessThan(1);
    expect(lum(night.skyTop!)).toBeLessThan(lum(day.skyTop!) * 0.1);
    expect(night.lampsOn && night.windowGlow > day.windowGlow).toBe(true);
    expect(ratio(night)).toBeLessThan(ratio(day));
  });
});

describe("weather and season on top of the look (§5.5)", () => {
  it("lowers the ratio and softens shadows in rain, snow and fog; fog keeps its colour, rain and snow go overcast", () => {
    const day = ISLAND_LIGHTING.day;
    for (const weather of ["rain", "snow", "fog"] as const) {
      const w = withWeather(day, weather);
      expect(ratio(w), weather).toBeLessThan(ratio(day) * 0.5);
      expect(w.shadow.radius, weather).toBeGreaterThan(day.shadow.radius * 2);
      expect(w.shadow.intensity, weather).toBeLessThan(day.shadow.intensity);
    }
    const [rain, snow, fog] = (["rain", "snow", "fog"] as const).map(weather => withWeather(day, weather));
    expect(ratio(fog)).toBeGreaterThan(1);
    expect(sat(fog.skyTop!)).toBeGreaterThan(sat(day.skyTop!) * 0.5);
    // Overcast (audit 2026-10 world item 10): the fill carries rain; snow is lighter, the sun still ahead of the fill.
    expect(ratio(rain)).toBeLessThan(1);
    expect(ratio(snow)).toBeGreaterThan(1);
    expect(sat(rain.skyTop!)).toBeLessThan(sat(snow.skyTop!));
    expect(sat(snow.skyTop!)).toBeLessThan(sat(fog.skyTop!));
  });
  it("layers season and weather on every phase without touching the preset", () => {
    for (const phase of ISLAND_PHASES) for (const weather of ISLAND_WEATHERS) {
      const light = withWeather(withSeason(ISLAND_LIGHTING[phase], summer), weather);
      expect(light.fogFar).toBeGreaterThan(light.fogNear);
      expect(light.sunIntensity).toBeLessThanOrEqual(ISLAND_LIGHTING[phase].sunIntensity);
    }
    const autumn = seasonLook(parseSeasonOverride("?season=autumn")!, {});
    expect(withSeason(ISLAND_LIGHTING.day, autumn).skyTop).toBe(CURRENT.sky.top);
    expect(CURRENT.sky.top).toBe("#4a9de0");
  });
});

describe("light budget helpers", () => {
  it("measures the pre-236 day at about 1.4:1 key:fill (D3) and the picked preset at about 3.5:1", () => {
    const shipped = parseLook({ ...CURRENT, light: { sunColor: "#fff5df", sunIntensity: 2.8, sunPosition: [-12, 24, -14], fillSky: "#c4deef", fillGround: "#a7b68a", hemisphere: 0.72, ambient: 0.22, envIntensity: 0.38, rimColor: "#ffffff", rimIntensity: 0 }, shadows: { radius: 3, intensity: 0.85, tint: "#000000" }, sky: { ...CURRENT.sky, top: "#a3d3e7", horizon: "#c7e0df" } });
    expect(keyFill(shipped).keyFill).toBeGreaterThan(1.3);
    expect(keyFill(shipped).keyFill).toBeLessThan(1.55);
    expect(keyFill(LOOK_PRESETS[2]).keyFill).toBeCloseTo(3.45, 1);
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

describe("glints and reflections (row 237, §6)", () => {
  it("makes glass and metal reflective in the game look and leaves characters, terrain and foliage as they were", () => {
    expect(CURRENT.materials.glass.gloss).toBeGreaterThan(0.1);
    expect(CURRENT.materials.metal.gloss).toBeGreaterThan(0.5);
    expect(CURRENT.materials.characters).toEqual({ saturation: 1.05, value: 1, roughness: 1, gloss: 0.25 });
    expect(CURRENT.materials.terrain.gloss).toBe(0);
    expect(CURRENT.materials.foliage.gloss).toBe(0);
    expect(CURRENT.post.toneMapping).toBe("neutral");
    for (const p of LOOK_PRESETS.slice(1)) expect([p.materials.glass.gloss, p.materials.metal.gloss], p.id).toEqual([0, 0]);
    expect(MATERIAL_CLASSES).toContain("glass");
  });
  it("keeps glass and metal roughness where the look sets it, without the toy-gloss pull", () => {
    expect(lookRoughness(0.9, CURRENT.materials.glass, "glass")).toBeLessThan(0.12);
    expect(lookRoughness(1, CURRENT.materials.metal, "metal")).toBeCloseTo(CURRENT.materials.metal.roughness);
    expect(lookRoughness(0.2, { saturation: 1, value: 1, roughness: 1, gloss: 1 }, "metal")).toBe(0.2);
  });
  it("patches chunks three still has (fails if three changes them)", () => {
    const frag = ShaderLib.physical.fragmentShader;
    for (const [chunk] of [...LOOK_REFLECT_EDITS.glass, ...LOOK_REFLECT_EDITS.metal]) expect(frag, chunk).toContain(chunk);
    expect(LOOK_REFLECT_EDITS.glass[0][1]).toContain("reflectVec.y = abs( reflectVec.y )");
    for (const field of ["material.diffuseContribution", "material.specularColorBlended"]) expect(ShaderChunk.lights_physical_fragment).toContain(field);
  });
  it("tells the environment where the sun is, per phase", () => {
    for (const phase of ISLAND_PHASES) expect(ISLAND_LIGHTING[phase].environment.sunAzimuth).toBeCloseTo(sunAngles(ISLAND_LIGHTING[phase].sunPosition).azimuth);
  });
});

describe("the backlit fill follows the orbit camera (specs/camera-orbit.md)", () => {
  const sun = [20, 22, -11]; // the picked key light: south-east of today's view, behind it
  it("is today's fill at heading 0 and without the lift", () => {
    expect(fillForHeading({ sunPosition: sun, fillLift: true }, 0)).toBeCloseTo(1, 12);
    expect(fillForHeading({ sunPosition: sun }, 2)).toBe(1);
  });
  it("rises looking toward the sun and settles looking away", () => {
    const toward = Math.atan2(sun[0], sun[2]); // the heading straight at the sun
    expect(backlitShare(sun, toward)).toBeCloseTo(1, 12);
    expect(fillForHeading({ sunPosition: sun, fillLift: true }, toward)).toBeCloseTo(1 + BACKLIT_FILL, 12);
    expect(fillForHeading({ sunPosition: sun, fillLift: true }, toward + Math.PI)).toBeCloseTo(1, 12);
    // A sun ahead of today's view: turning away drops the lift lookToLight baked in.
    const west = [0, 10, 24];
    expect(fillForHeading({ sunPosition: west, fillLift: true }, Math.PI)).toBeCloseTo(1 / (1 + BACKLIT_FILL), 12);
  });
});
