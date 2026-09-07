# Shop sign texture, September 7, 2026

- Runtime asset: `web/public/assets/branding/shop-sign-v1.png`.
- Built-in image_gen edit, not CLI. Output copied unchanged from `/Users/DavidLiu/.codex/generated_images/01a07833-2c27-7871-b1fb-66a98f5426c7/exec-51326ed7-d5be-440d-be0d-f59e86833510.png`.
- Edit target: `/Users/DavidLiu/Downloads/Assets/Model/StrcMarketA02_USen.Nin_NX_NVN/mSign_Alb.png`. The original export looked only in the base asset folder, leaving mSign untextured. Language-specific source contains the sign atlas. Existing source/library distribution status is unchanged by this edit.
- Applied only to the owned `mSign` material of `shop-market.glb`, sRGB, flipY=false. No GLB binary changed. No original sign emission map applied because its lettering would disagree with the edited text.
- Dia: text and atlas alignment verified in a temporary shop reference fixture, pixelated daylight and unfiltered evening. Full-world Noon/Night also checked. Fixture removed; default island remains HQ. Full-world distant sign readability remains limited by its older lighting/camera.

## Exact prompt

Use case: text-localization. Edit target: the attached 512x256 texture atlas used on a 3D game shop. Change ONLY the text inside the large cream sign from 'Nook’s Cranny' to exactly 'Tethos Shop', and replace the small leaf emblem above it with a small simple four-point star in the same reddish brown ink. Keep the painterly lettering weight and warm reddish brown color. Preserve every UV island's location, dimensions, borders, overall 2:1 aspect ratio, cream sign silhouette, red wood panels, striped awning, roof slats, black region, tiny texture details, and pixel alignment as closely as possible. This is a flat albedo texture atlas, not a picture of a building: no perspective, no lighting change, no added objects, no padding, no margins, no scene mockup. Output the complete edited atlas, same composition. Preserve original everywhere outside the lettering and small emblem.
