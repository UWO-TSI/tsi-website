# Anime concept-art style sheet (David, 2026-11-19)

The 2D look every concept painting follows before anything is modelled. David: "should be anime genshin impact style". After round 4: "the art only really has fine line on the actual subject, while effects are just glows that fade". The references are in the vault at `References/Rod references/north-star-r2/` (ref-112 to ref-117). They are third-party, so they stay out of git.

## What the references do

1. **Two layers that never mix:**
   - **The subject** is drawn: crisp, thin, even line art on its outline and on every edge between parts, in a dark tone of the local colour (deep brown on gold, deep violet on purple), never pure black.
   - **The effects** are never drawn: no outline, no hard edge, no shapes inside them. They are soft additive light that fades to nothing.
2. **Cel shading on the subject:** a flat base, one shadow tone with a hard edge, a second deeper occlusion tone in the crevices only, and a few crisp highlight strokes on metal and crystal. Metal reads through a sharp, bright, narrow specular band, not a gradient.
3. **Effects are light, not objects:**
   - **Glow:** a soft radial falloff around the bright parts.
   - **Glints:** thin four-point stars, long and hair-thin, bright white at the centre, fading along the arms.
   - **Arcs:** thin rings and arcs of light that fade at both ends.
   - **Trails:** a wide soft gradient that thins and fades.
   No painted snowflakes, candies or icons floating as effects.
4. **Restraint.** The subject owns the image. A few glints, not dozens. Most of the frame is empty, quiet background.
5. **Background:** one flat or very softly graded colour (slate blue-grey, deep indigo, or near black for bright effects), with no texture and no starfield noise.
6. **Palette:** a limited set per subject: one main colour, one accent, and white light. The glow takes the accent's hue.

## For the image model (paste verbatim as the STYLE block)

Anime game concept art in the style of Genshin Impact's official item and weapon illustrations. Two separate layers. THE SUBJECT is crisply drawn: clean, thin, even line art on its outline and on the edges between its parts, in a dark tone of the local colour (never pure black); cel shading with a flat base, one hard-edged shadow tone and a deeper tone only in crevices; crisp narrow specular highlight strokes on metal and crystal. THE EFFECTS are pure light with no line art and no hard edges: soft radial glows that fade to nothing, a few hair-thin four-point star glints, thin arcs of light fading at both ends, soft gradient trails. Restraint: the subject dominates, effects are few and subtle, and most of the frame is quiet empty background. Background: a single flat or very softly graded colour, no texture, no starfield noise, no floating icons, no snowflake or candy decorations. Limited palette: one main colour, one accent colour, and white light.

## Checks before a painting goes to David

1. Line art is on the subject only. Zoom in: no outlines inside the glow.
2. The effects fade out: no hard-edged blobs, no painted particle icons.
3. Count the glints: five or fewer.
4. The background is flat or a soft gradient, with no noise.
5. Squint: the subject reads first.
