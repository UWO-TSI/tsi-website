# Fish style: fixed prompt block (fish and sea creatures)

The text every fish concept view and every legendary hero concept carries, word for word. David's call (2026-11-25): **stylised realistic**. Spec: `specs/fish-list.md` section 9, "Fish style". Adapted from the tools' block (`art/pipeline/style-anchor-prompt.md` on `game/fishing`) and its lessons: square 1:1 nodes, one view per image filling the frame, flat even light, no painted glow or effects in model views, the far side mirrored from the near side, the same upright orientation in every view.

House scale and finish: the remodel fish (`web/public/assets/game/remodel/fish/`, `art/remodel/build_fish.py`): smooth bodies, one painted texture, the soft wet sheen. A new fish sits beside the nearest house fish (pale chub, rainbow trout, pike, sturgeon...) and reads as the same family.

## Fixed block (paste as is)

```
STYLE: a stylised realistic fish model for a cozy 3D island game. The real species' true anatomy: its proportions, head shape, mouth, eye position, fin count, fin placement and markings are correct and easy to identify. Simplified into clean, readable forms: a smooth body with soft volume, crisp fin silhouettes, the scales shown as a clean painted pattern (neat rows, a light scale texture), never one by one and never a photo. Fins are thin membranes with a few clear rays, a little lighter at the edges. A natural-sized fish eye: a dark pupil and a coloured iris ring.
COLOUR AND SURFACE: the species' natural colours, clean and slightly saturated, a soft counter-shade from a darker back to a pale belly, markings (spots, bars, stripes, scale outlines) crisp and simple. Smooth hand-painted surface, a soft satin finish.
NOT: not cartoon-cute (no oversized eyes, no smile, no chunky toy proportions), not bevelled or faceted hard-surface, not photo-real (no wet glare, no photo noise, no slime).
FORBIDDEN: painted highlights, painted shadows or baked ambient occlusion in the colours; glow, sparkles, auras, particles; water, bubbles, splashes, ground, cast shadows; outlines or ink lines; text, labels, arrows.
```

## View blocks (one per image, after the fixed block and the fish block)

Every view: an `image-generation` node on gpt-image-2.6-sunburst with `aspect_ratio` set to `1:1` on the node (the model ignores "square" in the prompt), one take. The side view is made first from text; the top and front views are edits wired to the side view so the fish stays the same.

Side view (first, text only):
```
VIEW: an orthographic side view of the whole fish, exactly in profile, its left side toward the camera, nose pointing left, back up, the body level and straight (not bent, not mid-swim), fins spread naturally, mouth closed. The fish fills the square frame from left edge to right edge with a small margin, centred vertically. Flat, even, shadowless studio light. Plain flat light neutral grey background. One fish only.
```

Top view (edit, wired to the side view):
```
VIEW: the same fish as the reference image, same species, colours, markings, proportions and fins, now seen orthographically from directly above, looking straight down onto its back. Nose pointing left, the body straight along the horizontal centre line, the pectoral fins visible on both sides, the dorsal fin seen edge-on along the spine. The fish fills the square frame from left edge to right edge with a small margin. Flat, even, shadowless light. Plain flat light neutral grey background. One fish only.
```

Front view (edit, wired to the side view):
```
VIEW: the same fish as the reference image, same species, colours, markings and fins, now seen orthographically from directly in front, head-on, looking straight at its face: back up, belly down, body level, both eyes, the closed mouth, the pectoral fins out to the sides and the dorsal fin edge-on above. Centred, the fish as large as fits in the square frame with a small margin. Flat, even, shadowless light. Plain flat light neutral grey background. One fish only.
```

Far side: the side view mirrored (`magick side.png -flop far.png`); fish are symmetric, so it is not generated.

## Meshy input (raw model)

`python3 art/fish/register_views.py <dir> <fish>` cuts the grey to alpha, puts the views on one scale (side and top share the length, the front takes the side's height) and mirrors the far side. Then `meshy_multi_image_to_3d`, `file_paths` [side, front, far side], meshy-7.1 + meshy-7, standard geometry, 2K texture, `image_enhancement` false, GLB only: 30 credits. The fish is upright (back up) in every view, so the camera orbits the vertical axis as Meshy assumes.

The top view stays on the review sheet but is **not** fed to Meshy: on the pilot (2026-11-25) gpt-image-2.6-sunburst drew the dorsal and anal fins as extra side pairs from above on all four fish, which would give the model phantom fins. Front plus both sides were enough for the body width.

## Legendary and Divine hero concept (one image per creature, before any views)

```
HERO CONCEPT: concept art of one legendary creature for a cozy 3D island game, stylised realistic: believable anatomy, clean readable forms and a strong silhouette, painted surfaces with simple crisp markings, not cartoon-cute, not photo-real. Three-quarter view of the whole creature, large in the square frame, rising out of its water; a small wooden rowboat in the frame for scale. Soft, clear light; the setting (its water, time and weather) stays simple and muted so the creature reads first. No text, no labels, no people.
```
Then the creature block (its row in section 4, in plain words) and its aura line:
- Legendary: `AURA: a soft gold rim light along its silhouette and a few slow gold sparks drifting off it.`
- Divine: `AURA: a holographic shimmer over its surface, pale iridescent bands of pink, cyan and gold.`
- Megabyte: the gold rim plus `blue-white electric arcs crawling over its plates and jumping to the water.`

The aura is for the hero concept only. Views made later for Meshy use the fish blocks above: no aura, no water, no effects; auras are added in the game.
