// Dump organizer (David ask, 2026-07-24): builds a navigable, categorized
// library over the 12GB ACNH rip WITHOUT copying it. Each item becomes a
// symlink at ~/Downloads/AssetsLibrary/<Category>/<Sub>/<Item> pointing at
// the original .Nin_NX_NVN dir (which holds the .dae + textures), plus a
// manifest.json index for tooling (lab item bench, converters).
//
// Run:  node scripts/organize-dump.mjs [--convert <Category/Sub>]
// The optional --convert pass runs `assimp export` on every .dae in one
// subcategory → .glb alongside the manifest (pilot conversion; scale and
// orientation calibration happen in the game-side import step).
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

// ⚠️ EXTRACTION DEFECT — the pipeline drops meshes silently (audit 2026-07-26)
//
// The exporter preserves source mesh indices in the mesh NAMES, so dropped
// geometry leaves a gap in the numbering. Auditing all 266 GLBs under
// public/assets/acnh/ found 12 files with gaps, and they are the most visible
// assets in the game:
//
//   buildings/house-chalet{,-red,-yellow}.glb  kept 0,4,8 / 0,3,4 / 0   (-2 each)
//   buildings/oracle-museum.glb                kept 0,1,2,3,4,7        (-2)
//   buildings/shop-market.glb                  kept 0,1,2,5,8 / 0,1    (-2)
//   plants/tree-blossom.glb                    kept 0,2,4             (-2)
//   plants/tree-hardwood-a.glb                 kept 0,2,5             (-3)
//   plants/tree-hardwood-b.glb                 kept 0,3,4             (-2)
//   river/bank-{straight,corner,dead,edge}.glb kept 1,2,3             (-1 each)
//
// Two consequences worth naming:
//
//  * The four river bank pieces all dropped index 0. Comparing against an
//    intact sibling (river/4-a.glb keeps 0,1,2,3), index 0 is the mesh at
//    y[-0.78, 0.00] = `Grass__mGrass`, THE GROUND SURFACE. Every bank piece in
//    the game is missing its own ground, which is why the terrain has to fill
//    in behind it and the seam never resolves.
//
//  * tree-blossom lost 2 of 5 source meshes. PltTreeOak4Sakura.dae contains
//    LB014__mShadow (659v) and PetalL010__mShadowShake (394v) — ACNH BAKES
//    CONTACT SHADOWS INTO EVERY ASSET AS GEOMETRY. That is why ACNH has no
//    dynamic shadow cost. This pipeline deletes them, and the game then runs a
//    1024² realtime PCF-soft shadow map to recreate the effect at ~7 FPS on
//    M1 (and misaligned, see lib/game/curvedWorld.ts).
//
// REQUIRED before any further extraction: fail loudly on a mesh-count
// mismatch between the source .dae and the exported .glb instead of writing a
// partial file, then re-export the 12 above WITH their mShadow meshes.
//
// ── ACNH kit constants (measured, canonical — see specs/acnh-system-reference.md) ──
//
//   tile pitch          10.0 raw = 1.0u   (every Cliff*/River* bboxes to 10x10)
//   elevation step      15.0 raw = 1.5u   (Cliff0A_0: top grass y=0, lower grass y=-15.00)
//   river water surface  0.78 raw below its ground level = 0.078u
//   grass top lip        0.39 raw         cliff grass drape 1.88 raw
//   ground unit          FldUnit/Base_0.dae = ONE 4-vertex 10x10 quad, mGrass
//
// Kits still to extract, with rotations:
//   FldUnitCliff  44 pieces   FldUnitRiver  45 pieces   FldUnitFall  47 pieces
// Naming is {Kit}{Class}{Variant}_{Rotation}: class 0-8 from the 8 neighbours,
// A/B/C for diagonals, 0-3 pre-baked rotations. Cliff, river and road share it.
//
// Material suffix vocabulary: _Alb albedo · _AlbGry GREYSCALE albedo tinted at
// runtime (this is how ACNH does seasons) · _Mix packed ORM · _Nrm normal ·
// _OP opacity mask · _Grd/_GrdEdge ground + tile-edge · Xlu translucent
// overlay · Snow explicit winter variant where the PATTERN changes.
//
// ── Game calibration (measured 2026-07-24 via scripts/glb-bbox.mjs) ──
// Repo koi (shipped, game-scale) long axis 0.895 vs dump FishKoi 9.004:
// the raw rip is exactly 10× game scale, long axis Z instead of Y.
//   → import transform: scale 0.1, rotate +90° about X (Z-forward → Y-up),
//     then verify per family in /lab/item (top-down + player-ref doctrine).
// assimp can't bake transforms, so this applies at IMPORT time — the step
// that copies a library GLB into web/public wraps it (scale/rotation on
// the placement or a one-off gltf-transform pass).
export const GAME_CALIBRATION = { scale: 0.1, rotateXDeg: 90 };

const SRC = path.join(os.homedir(), "Downloads/Assets/Model");
const OUT = path.join(os.homedir(), "Downloads/AssetsLibrary");

// ACNH naming taxonomy → navigable categories.
const RULES = [
  [/^DiveFish/, "Creatures/SeaCreatures"],
  [/^Fish/, "Creatures/Fish"],
  [/^Ins/, "Creatures/Insects"],
  [/^FtrFish/, "Furniture/FishModels"],
  [/^FtrIns/, "Furniture/InsectModels"],
  [/^Ftr/, "Furniture/General"],
  [/^Layout_MenuIcon_Fish/, "UI/FishIcons"],
  [/^Layout_MenuIcon_Ins/, "UI/InsectIcons"],
  [/^Layout_MenuIcon/, "UI/MenuIcons"],
  [/^Layout/, "UI/Layouts"],
  [/^Idr/, "Interiors/Rooms"],
  [/^Room/, "Interiors/RoomParts"],
  [/^House/, "Buildings/Houses"],
  [/^Npc/, "Characters/NPCs"],
  [/^Player/, "Characters/Player"],
  [/^(Tops|Bottoms|Cap|Shoes|Socks|Accessory|OnePiece|Helmet|Bag)/, "Clothing"],
  [/^Tool/, "Tools"],
  [/^Fld/, "Field"],
  [/^(Tre|Flw|Bush|Plant)/, "Nature"],
  [/^(Str|Unit|Terrain)/, "Terrain"],
];

function categorize(name) {
  for (const [re, cat] of RULES) if (re.test(name)) return cat;
  return "Misc";
}

const entries = fs.readdirSync(SRC).filter((n) => !n.startsWith("."));
const manifest = {};
let linked = 0;

for (const name of entries) {
  const cat = categorize(name);
  const clean = name.replace(/\.Nin_NX_NVN$/, "");
  const destDir = path.join(OUT, cat);
  fs.mkdirSync(destDir, { recursive: true });
  const link = path.join(destDir, clean);
  try {
    if (!fs.existsSync(link)) fs.symlinkSync(path.join(SRC, name), link);
    linked++;
  } catch {
    /* skip broken */
  }
  (manifest[cat] ??= []).push(clean);
}

for (const cat of Object.keys(manifest)) manifest[cat].sort();
fs.writeFileSync(
  path.join(OUT, "manifest.json"),
  JSON.stringify(
    { generated: new Date().toISOString(), source: SRC, counts: Object.fromEntries(Object.entries(manifest).map(([k, v]) => [k, v.length])), items: manifest },
    null,
    1
  )
);
console.log(`organized ${linked}/${entries.length} items into ${Object.keys(manifest).length} categories → ${OUT}`);
console.log(Object.entries(manifest).map(([k, v]) => `${k}: ${v.length}`).sort().join("\n"));

// Optional pilot conversion of one subcategory.
const ci = process.argv.indexOf("--convert");
if (ci !== -1 && process.argv[ci + 1]) {
  const cat = process.argv[ci + 1];
  const dir = path.join(OUT, cat);
  const glbDir = path.join(OUT, "_glb", cat);
  fs.mkdirSync(glbDir, { recursive: true });
  let ok = 0, fail = 0;
  for (const item of fs.readdirSync(dir)) {
    const src = path.join(dir, item);
    const dae = fs.readdirSync(src).find((f) => f.endsWith(".dae"));
    if (!dae) continue;
    try {
      execFileSync("assimp", ["export", dae, path.join(glbDir, `${item}.glb`), "-embtex"], { stdio: "pipe", timeout: 120000, cwd: fs.realpathSync(src) });
      ok++;
    } catch {
      fail++;
    }
  }
  console.log(`converted ${cat}: ${ok} ok, ${fail} failed → ${glbDir}`);
}
