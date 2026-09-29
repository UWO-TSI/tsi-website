# Round streetlamp source repair

Rebuilt September 7, 2026 from the existing library.

- Geometry: `~/Downloads/Assets/Model/FtrStreetlampRound.Nin_NX_NVN/FtrStreetlampRound.dae`
- Body finish/emission: `~/Downloads/Assets/Model/FtrStreetlampRoundReBody0.Nin_NX_NVN/mReBody_{Alb,Emi}.png`
- Glass: original `mGlassF_Alb.png`, `mGlassF_OP.png`, `mGlassR_AlbGry.png` in the geometry directory.
- Output: `web/public/assets/acnh/props/streetlamp.glb`
- Reproduce from `web/`: `node scripts/restore-furniture-assets.mjs lamp [source-model-directory]`. Requires assimp. `all` restores lamp, clock and both benches.

The prior asset lost the post UVs, body albedo and emission. The source image-library declarations are repaired in a temporary DAE copy, including the emission texture. Original body/emission PNGs are embedded unchanged; constant glass textures are folded into material factors by glTF prune. Unused skinning/normal/mix textures removed. Three source meshes preserved, uniformly scaled 0.1, centered X/Z and grounded Y. Dimensions 0.534121×2.670614×0.534121, with sub-millimeter grounding correction. Output 65,208 bytes (old 31,268), +33,940.

Glass is an explicit glTF approximation of custom source shading. Both glass surfaces use BLEND; the outer surface has 0.4 opacity from its constant opacity texture, the inner surface retains its source alpha. Shared model preparation uses front faces, no depth writing or opaque shadow casting for repaired lamp/clock glass. Ordinary and instanced paths agree. Body mapped emission is 0 during day and 2.2 during dusk/night/dawn; the same existing phase gates existing point-light pools in GameWorld and AmbientProps. Other models retain their original emission behavior when no override is supplied.

Dia fixture checks both rendering paths, day/night reversal, clock alongside them, shadows and hide/remount. No fresh console warnings/errors. Fixture: `/tmp/uwotsi-lamp-qa-20260907-0850`. Full 407 tests, TypeScript, targeted lint and webpack build pass. Authenticated full-world integration and physical-device performance remain unverified.
