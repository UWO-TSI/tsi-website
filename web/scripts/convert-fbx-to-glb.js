#!/usr/bin/env node
/**
 * Batch convert FBX building assets to self-contained GLB files.
 * Uses Facebook's FBX2glTF tool via the fbx2gltf npm wrapper.
 *
 * Run: node scripts/convert-fbx-to-glb.js
 */
const fbx2gltf = require("fbx2gltf");
const path = require("path");
const fs = require("fs");

const BUILDINGS_DIR = path.resolve(__dirname, "../public/assets/buildings");

async function convert() {
  const files = fs.readdirSync(BUILDINGS_DIR).filter((f) => f.endsWith(".fbx"));

  if (files.length === 0) {
    console.log("No FBX files found in", BUILDINGS_DIR);
    return;
  }

  console.log(`Found ${files.length} FBX files to convert:\n`);

  for (const file of files) {
    const input = path.join(BUILDINGS_DIR, file);
    const outputName = file.replace(/\.fbx$/i, ".glb");
    const output = path.join(BUILDINGS_DIR, outputName);

    console.log(`  ${file} → ${outputName}`);
    try {
      const result = await fbx2gltf(input, output, [
        "--binary",
        "--embed",
      ]);
      console.log(`    ✓ Done (${path.basename(result)})`);
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message || err}`);
    }
  }

  console.log("\nConversion complete.");
}

convert();
