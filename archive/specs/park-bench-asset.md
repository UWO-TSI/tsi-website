# Park bench source repair

Rebuilt September 7, 2026 from the existing local asset library.

- Geometry: `~/Downloads/Assets/Model/FtrParkbenche.Nin_NX_NVN/FtrParkbenche.dae`
- Default finish: `~/Downloads/Assets/Model/FtrParkbencheReBody0.Nin_NX_NVN/mReBody_Alb.png`
- Output: `web/public/assets/acnh/props/bench-park.glb`
- Reproduce from `web/`: `node scripts/restore-bench-assets.mjs park [source-model-directory]`. Use `wood` for the log bench or `all` for both. Requires assimp.

The old asset had no UVs/textures and was baked sideways. Dia's item inspector confirmed this with its +90°X comparison. The repair uses the upright source geometry at the existing 0.1 scale, centers X/Z and grounds Y. Bounds change from 1.7538 × 0.9508 × 1.0048 to 1.7538 × 1.0048 × 0.9508 because the old Y/Z orientation was wrong. The two existing world placements rotate 180° about Y so the seat front faces the south-facing player. Sitting anchor X/Z coordinates remain unchanged.

The original 768 × 768 colour PNG is embedded unchanged; unused normal/mix maps and source skinning are removed. The script verifies one mesh/primitive, UV/albedo presence and expected size before writing. Output 348,500 bytes (old 40,504), +307,996. Rebuilding both benches leaves the previously repaired wooden bench byte-for-byte unchanged. The shared script replaces `restore-wood-bench.mjs`; its previous wood-only command is documented in historical checkpoints.

Dia verified the upright textured model with inspector rotation fix OFF, plus both park/log benches with the real PlayerAvatar in a source-only local fixture. Sitting pose no longer sinks through the seat: the existing standing sprite is shortened and moved slightly toward the camera, not replaced with a bespoke seated drawing. Standing restores normal scale/depth. Seat snap now reports its new world position once; quick movement key presses exit the pose immediately. Source fixture: `/tmp/uwotsi-bench-seat-qa-20260907-0821`. No presence/backend transport mounted. Authenticated full-world sitting and physical held-key/touch movement remain unverified.
