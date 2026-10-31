# Entry PNGs to lossless WebP: pixel proof (round 2, step 3)

`cwebp -lossless -exact -z 9 -metadata none` (web/scripts/sync-character-assets.mjs for the character ones).

| file | PNG | WebP |
|---|---|---|
| branding/shop-sign-v1 | 1,735,326 | 1,348,190 |
| characters/v6/hair/hair_colour_world | 1,610,017 | 880,004 |
| characters/v6/base/v7_face_atlas_2_512 | 843,508 | 428,026 |
| characters/v6/base/v7_face_atlas_512 | 51,962 | 21,254 |
| characters/v6/outfits/designs | 368,361 | 101,186 |
| characters/v6/colour_atlas | 1,948,156 | 976,242 |
| all six | 6,557,330 | 3,754,902 |

Decoded with sharp to raw RGBA (samepixels.mjs), the shipped WebP (the sync script's output; the shop sign by hand)
against the PNG it replaces:

```
identical 1774x887 shop-sign-v1.png vs shop-sign-v1.webp
identical 1536x1792 hair_colour_world.png vs hair_colour_world.webp
identical 1632x1824 v7_face_atlas_2_512.png vs v7_face_atlas_2_512.webp
identical 1024x288 v7_face_atlas_512.png vs v7_face_atlas_512.webp
identical 2048x2048 designs.png vs designs.webp
identical 2048x1024 colour_atlas.png vs colour_atlas.webp
```

What WebGL receives in headless Chromium (gpupixels.mjs: an <img> uploaded as three does, flipY and premultiply off,
colour-space conversion browser-default and none, read back from a framebuffer), byte for byte:

```
identical on the GPU 1774x887 shop-sign-v1.png vs shop-sign-v1.webp (bytes differing, browser-default / none: 0 / 0)
identical on the GPU 1536x1792 hair_colour_world.png vs hair_colour_world.webp (bytes differing, browser-default / none: 0 / 0)
identical on the GPU 1632x1824 v7_face_atlas_2_512.png vs v7_face_atlas_2_512.webp (bytes differing, browser-default / none: 0 / 0)
identical on the GPU 1024x288 v7_face_atlas_512.png vs v7_face_atlas_512.webp (bytes differing, browser-default / none: 0 / 0)
identical on the GPU 2048x2048 designs.png vs designs.webp (bytes differing, browser-default / none: 0 / 0)
identical on the GPU 2048x1024 colour_atlas.png vs colour_atlas.webp (bytes differing, browser-default / none: 0 / 0)
```
