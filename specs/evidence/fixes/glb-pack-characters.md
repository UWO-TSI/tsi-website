# Character GLBs packed (fixes lane, fix 4)

`web/scripts/sync-character-assets.mjs` now calls `packGlbBytes` (pack-glbs.mjs: lossless meshopt on the buffer views, PNG images as
lossless WebP, no quantizing, each only where smaller over the wire) on every GLB it wrote under public/assets/characters/v6.
The hairstyles and Roblox accessories were meshopt-compressed by the script already and are left alone. The sync is deterministic:
a re-run before the change left the tree clean. 41 of the 218 GLBs had something to pack.

Size (all 218 character GLBs, brotli q9, as the CDN serves them): raw 15.08 -> 14.96 MB, brotli 7.60 -> 7.52 MB.
The biggest: v8_clips.glb 1,706,688 -> 1,660,632 bytes, 428,461 -> 401,641 brotli; v7_clips.glb 427,600 -> 401,182. The rest save
0.2 to 3 KB each. On entry that is about 27 KB over the wire (v8_clips.glb) plus the outfit and accessory parts a look wears: far
less than the 2.5 MB the entry-perf note named, which was the characters' total size, not what packing can take off it.

## Identical

same-glb.mjs (entry-perf's), the 41 changed files loaded from the originals and from the packed copies by three's GLTFLoader
(meshopt decoder) in headless Chromium and compared as the game gets them (node transforms, attributes, indices, morphs,
materials, texture settings and texels, skins, animation tracks), then four renders each, byte for byte:

```
41 of 41 GLBs identical as the game loads them (data, texels and four renders each); 0 differ
the model's share of its renders: least 0.0%, median 19.9%; none drawn in 2
```

The two with no render (a part the bench's camera never frames) are covered by the data compare alone.

## Stills (before and after, headless dev server, stills.mjs)

chars/{before,after}-residents.png (the creator's camera and lights: /lab/avatar?sheet=residents&framing=body, every resident look: hair,
outfits, accessories), chars/{before,after}-spawn.png and -walk.png (the island at the campfire, the player standing and walking: the
clip base playing). The bench has no signed-out creator to open, so the creator is its own bench. A pixel diff is noisy because the
characters idle, blink and the world's clock runs; the same files shot twice differ as much as before against after:

| still | differing px, before vs after | differing px, same files twice |
|---|---|---|
| residents | 23,446 | 21,103 |
| styles | 907 | 967 |
| hats | 69 | 89 |
| spawn (400x500 crop) | 4,310 | 2,153 |
| walk | 4,432 | 3,999 |

(styles and hats stills not kept, the diffs are above.) look.test.ts: the LOD 1 copies that were byte-equal to art now go through
shipsPacked (the source itself, or the same triangles, primitives, materials and bones with meshopt or WebP required).
