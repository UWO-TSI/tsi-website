# Cozy Game Lighting — Deep Research (2026-07-14)

> Four-agent research sweep: ACNH rendering internals, Minecraft shader
> pack source (BSL / Complementary / SEUS), cozy art theory (Valve,
> Firewatch, Genshin, Project Horseshoe), and the Three.js toolbox.
> This doc is the lighting bible for `water-harness/lighting.html` and
> every future lighting commit. Full source lists at the bottom.

## The one-line thesis

**Coziness is not a shader — it's warm-cool hue contrast, protected
darks, and a clock-scripted mood, applied over deliberately simple
geometry.** ACNH spends all its GPU on light response (per-fabric PBR,
anisotropic hair, AO, shadows on every acorn) while *simplifying* the
surfaces the light hits (symbolic triangle grass, flat albedos). The
Minecraft packs encode the same taste as literal RGB tables.

## The ten laws (cross-verified across all four reports)

1. **Warm key, cool fill — nothing neutral, ever.** BSL's actual
   constants: sun at golden hour `(255,160,80)×1.2`, noon
   `(196,220,255)×1.4`; ambient at noon is *sky blue* `(120,172,255)×0.6`,
   and even the ambient goes peach `(255,204,144)` at sunset. Gray never
   appears in a cozy rig. "Shadow" always means "blue."

2. **Shadows are colored and saturated — lerp toward a shadow color,
   never multiply toward black.** Painting theory (Gurney), pixel-art
   ramps (~20° hue shift per value step), and Genshin's shipped ramps
   (warm/red gradient *inside* the shadow edge) all agree. Saturation
   peaks in the mid-darks, never the highlights.

3. **Lift the shadow floor.** Valve's Half-Lambert `(0.5·N·L+0.5)²` —
   "completely non-physical… the perceptual benefit is enormous."
   Tutorial-standard ambient floor ≈ 0.4 of lit value (~2.5:1 lit:shadow).
   Complementary's tonemapper literally exempts darks ("dark lift") and
   desaturates near-black (scotopic vision). Night must never crush.

4. **Golden hour gets 80% of the tuning.** Complementary's sunset is a
   *power curve* (color saturates AND darkens as sun drops, intensity
   ×5); volumetric rays are 8× weaker at noon than at sunset. A Short
   Hike sampled its whole palette from autumn photos. Bias the day
   toward the flattering hours.

5. **The mood is a lookup table.** ACNH: 40 weather patterns × 24
   hourly sky states from a deterministic seed (dataminers built a
   40-year forecaster from it); a distinct grade per hour. Firewatch:
   "color and tone," not Mie-scattering sliders. Author time-of-day as
   color keys, blend between them. (Our TOD_KEYS + seeded weather.ts is
   the right architecture — just too few keys.)

6. **The sky is the biggest patch of color — author it directly.**
   Firewatch's sky is a 3-stop gradient + sun disc + two halos, and it
   *feeds the ambient* so the ground inherits sky mood. ACNH curves the
   world so the sky never leaves the frame — you always see the clock.

7. **Bloom is atmosphere, not sparkle.** BSL/Complementary have NO
   bloom threshold: an x⁴ brightness curve + a whole-frame 12-20% lerp
   of blurred mips. Every lamp gets a halo and the entire image gets a
   faint soft-focus diffusion. In three.js the free version: bloom
   `luminanceThreshold=1` + lamp materials `toneMapped=false,
   emissiveIntensity 2-4` = selective bloom with zero extra passes.

8. **Soft, slow, stable light.** Wide PCF penumbras, colored
   translucent shadows, terminator that melts into ambient
   (Complementary: grazing-angle light blends 50% toward ambient), slow
   or NO auto-exposure (Complementary has none — predictable brightness
   is part of "cozy"). No hard edges, no pumping.

9. **Tone mapping is a taste decision — protect stylized hues.** ACES
   (the R3F default!) hue-shifts and desaturates; AgX flattens saturated
   palettes; Genshin baked their tonemap INTO the grading LUT to protect
   their fire-orange. Khronos Neutral (three r166+) = authored colors
   untouched, only highlights compressed. BSL/Complementary both wrote
   custom operators whose main feature is *not touching the darks*.

10. **Selective vibrance, roll-to-white.** The BSL-lineage vibrance
    function boosts only dull midtones (`(1-(mx-mn))·(1-mx)·5`); bright
    warm sources roll to white instead of clipping orange. Saturated
    but never garish.

## What ACNH actually is (myths corrected)

- **Soft PBR, not cel/toon.** No ramp quantization — per-fabric
  roughness, anisotropic hair highlights, real AO and bloom. The
  "cartoon" read comes from simplified albedo under plausible light.
- **Real shadow maps on everything**, unusually high resolution for
  Switch; footprints/ripples are normal-mapped decals so they receive
  light too.
- **Sky simulates Rayleigh + Mie scattering** per hour; clouds are
  recolored to match the hourly grade.
- **Grass is "symbolized"** (CEDEC 2020): photograph → extract → simplify
  to the triangle pattern; seasons are *pure recolors* of the same
  pattern. They cut polygonal weeds for readability. ("Don't let the
  screen talk too much.")
- **Lighting is data**: the romfs `Env` folder holds shading/lighting
  params — the mood system is content, not code.
- **Lamps tint their pools by lampshade color** and HHP exposes
  lighting sliders to players: light as authorable furniture.

## Mapped to our stack (actions, in lab-first order)

| # | Action | Source law | Where |
|---|--------|-----------|-------|
| L1 | A/B `NeutralToneMapping` vs current `NoToneMapping` (emissives clip at 1.0 under flat) | 9 | lighting.html → GameWorld gl |
| L2 | Densify TOD_KEYS toward hourly (esp. 16-20h), sunset as saturate+darken power ramp with intensity spike | 4, 5 | GameWorld TOD_KEYS |
| L3 | Adopt BSL-class constants: noon sun slightly BLUE-white (196,220,255), golden sun (255,160,80); noon ambient bluer than ours | 1 | TOD_KEYS + lab sliders |
| L4 | Wrap-lighting (half-Lambert) injection for foliage/props via onBeforeCompile — kills mud on tree undersides | 3 | new lib/game/wrapLighting.ts |
| L5 | Whole-frame soft bloom lerp (12-20%, no threshold) + lamp materials toneMapped=false — atmospheric diffusion + night halos | 7 | PostFX |
| L6 | Vibrance pass (BSL formula) in the merged EffectPass | 10 | PostFX |
| L7 | Terminator melt: blend grazing-angle sun toward ambient in the ground/foliage materials | 8 | onBeforeCompile chunk |
| L8 | Fog v2: gradient fog (horizon color ≠ zenith) + slight distance desaturation | 6 + theory P8 | Ocean/ground shaders or post |
| L9 | Night: keep the blue floor (verified in lab); add dark-desaturation later via grading | 3 | done / PostFX later |
| L10 | Seasonal palettes stay as recolors of the same patterns (validated: exactly ACNH's method) | ACNH | already shipped ✓ |
| L11 | Lamp pools: per-lamp color tinting (lampshade rule) + eventually player-facing room sliders (HHP) | ACNH | AmbientProps / Phase 2 |
| L12 | Colorspace audit: every sprite/albedo SRGBColorSpace, data textures linear (r152 rules) | toolbox | one-time sweep |

Validated as already-correct: PMREM gradient environment (= Lightformer
approach), 30Hz frozen shadow maps (= BakeShadows pattern), seeded
daily weather (= ACNH's seed), curved world keeping sky in frame,
NoToneMapping over ACES (right instinct; Neutral is the refinement),
warm lamp pools at night, quilt ground as symbolic pattern.

## Sources (abridged — full lists in the research transcripts)

- Valve, *Shading in Valve's Source Engine* (SIGGRAPH 2006) — Half-Lambert, ambient cube, LUT grading.
- Jane Ng, *The Art of Firewatch* (GDC 2015) + Campo Santo sky-shader blog (2015) — sky as dominant color, color-scripted mood.
- Project Horseshoe 2017, *Cozy Games* — the canonical cozy-design report (warm low ambient, soft dappled beams, obscured horizon).
- CEDEC 2020 ACNH art talks (4gamer / denfaminicogamer) — symbolization, grass workflow, seasonal recolors.
- Digital Foundry + GameXplain ACNH analyses (2019-2020) — soft PBR, shadows, Rayleigh/Mie sky, AO/bloom.
- Treeki/MeteoNook (Ninji, 2020) + Nookipedia — datamined 40×24 weather/sky tables.
- Complementary Reimagined source (GitHub, current) — sunset power curves, dark lift, no-threshold bloom, stochastic PCF, per-emitter light colors.
- BSL v8 source (mirror) — light/ambient RGB tables, custom tonemap, vibrance, auto-exposure.
- Sonic Ether Patreon (2019) — SEUS PTGI bounce/color-bleed architecture.
- Guilty Gear Xrd GDC 2015, Genshin GDC 2021 + console-pipeline writeups — hand-authored shadow control, tonemap-in-LUT.
- three.js releases r152/r160/r163/r166, Khronos PBR Neutral spec (May 2024), pmndrs postprocessing/drei docs — the implementation toolbox.
