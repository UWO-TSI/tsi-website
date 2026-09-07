# Wooden bench source repair

Rebuilt September 7, 2026 from the existing local asset library. No new asset purchase or generated texture.

- Geometry: `~/Downloads/Assets/Model/FtrWoodBench.Nin_NX_NVN/FtrWoodBench.dae`
- Original default wood variant: `~/Downloads/Assets/Model/FtrWoodBenchReBody0.Nin_NX_NVN/mReBody_Alb.png`
- Output: `web/public/assets/acnh/props/bench-wood.glb`
- Reproduce from `web/`: `node scripts/restore-bench-assets.mjs wood [source-model-directory]` (requires installed assimp).

The old GLB had one mesh with position/normal attributes but no UVs or textures. The repair exports the source with its matching variant images in a temporary directory, retains UVs/albedo, removes unused skinning/extra material extensions, and applies the existing 0.1 scale. It centers X/Z and grounds Y, matching the old 1.9453 × 0.5106 × 0.5280 bounds within 0.001 units. The script verifies mesh count, UV/albedo presence and dimensions before writing.

The original 768 × 384 PNG is embedded unchanged. Output is 285,988 bytes (old 22,256), an increase of 263,732 bytes. No extra texture request. This intentionally retains the existing source resolution for this one repaired asset; general importer texture cap remains unchanged. Geometry/material transformation only, no source-dump files modified.

Dia checked the default island in daylight, golden hour, moonlight and crisp overcast; wood grain/end grain render and grounding remains intact. The bench now appears in two clearing/HQ garden positions with shared collision footprints. Other scenes using the same asset were not separately visually retested. Park bench has the same missing-texture issue and is not used by this default island pass.
