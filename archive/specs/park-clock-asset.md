# Park clock source repair

Rebuilt September 7, 2026 from the existing library.

- Geometry: `~/Downloads/Assets/Model/FtrParkclock.Nin_NX_NVN/FtrParkclock.dae`
- Finish: `~/Downloads/Assets/Model/FtrParkclockReBody0.Nin_NX_NVN/mReBody_Alb.png`
- Output: `web/public/assets/acnh/props/park-clock.glb`
- Reproduce from `web/`: `node scripts/restore-furniture-assets.mjs clock [source-model-directory]`. Requires assimp. `all` restores both benches and the clock; the prior bench command remains supported.

The old binary lacked UVs and textures. The source DAE references variant images that are absent from its `library_images`; the script repairs declarations in a temporary copy, never the source dump. Original albedo is embedded unchanged. Unused skinning and normal/mix maps are removed. Body and glass geometry remain at the existing 0.1 scale with centered X/Z and grounded Y. Bounds: 0.670924×2.678563×0.563093. Two meshes/materials. Output 66,928 bytes (old 26,556), +40,372.

The source expects a custom glass shader. glTF uses a simple BLEND material with white alpha 0.08 and roughness 0.2 so the glass does not hide the dial. This is an approximation, not a faithful source-shader conversion. Existing hands remain static; no time display logic added.

Dia item inspector verifies readable numbered face, dark painted frame, full upright model, player reference, and rotated framing/dimensions. Full-world day/night integration remains unverified. TypeScript and targeted lint pass; both bench outputs remain unchanged when restoring all three assets.
