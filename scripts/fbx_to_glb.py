#!/usr/bin/env python3
"""
Batch-convert FBX files to self-contained GLB with embedded textures.

Usage (Blender CLI):
    blender --background --python scripts/fbx_to_glb.py

Or specify input/output directories:
    blender --background --python scripts/fbx_to_glb.py -- --input web/public/assets/buildings --output web/public/assets/buildings
    blender --background --python scripts/fbx_to_glb.py -- --input web/public/assets/props --output web/public/assets/props

Requirements:
    - Blender 3.x+ (tested on 3.6 / 4.x)
    - FBX files in the input directory

The script will:
    1. Find all .fbx files in the input directory
    2. Import each one into a clean Blender scene
    3. Pack all textures into the blend file (embeds them)
    4. Export as .glb (binary glTF with embedded textures)
    5. Log results
"""

import bpy
import os
import sys
import glob

# --- Parse CLI args passed after "--" ---
argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1:]
else:
    argv = []

# Default paths (relative to project root)
INPUT_DIR = "web/public/assets/buildings"
OUTPUT_DIR = None  # same as input by default

i = 0
while i < len(argv):
    if argv[i] == "--input" and i + 1 < len(argv):
        INPUT_DIR = argv[i + 1]
        i += 2
    elif argv[i] == "--output" and i + 1 < len(argv):
        OUTPUT_DIR = argv[i + 1]
        i += 2
    else:
        i += 1

if OUTPUT_DIR is None:
    OUTPUT_DIR = INPUT_DIR


def clear_scene():
    """Remove all objects, meshes, materials, etc. from the scene."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    # Clean orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)
    for block in bpy.data.textures:
        if block.users == 0:
            bpy.data.textures.remove(block)
    for block in bpy.data.images:
        if block.users == 0:
            bpy.data.images.remove(block)


def convert_fbx_to_glb(fbx_path, glb_path):
    """Import an FBX file and export it as a self-contained GLB."""
    clear_scene()

    # Import FBX
    print(f"  Importing: {fbx_path}")
    bpy.ops.import_scene.fbx(
        filepath=fbx_path,
        use_image_search=True,
        force_connect_children=False,
        automatic_bone_orientation=True,
    )

    # Pack all external textures into the blend file
    bpy.ops.file.pack_all()

    # Ensure all images are packed
    for img in bpy.data.images:
        if img.packed_file is None and img.filepath:
            try:
                img.pack()
                print(f"    Packed texture: {img.name}")
            except Exception as e:
                print(f"    Warning: could not pack {img.name}: {e}")

    # Select all objects for export
    bpy.ops.object.select_all(action="SELECT")

    # Export as GLB (binary glTF)
    print(f"  Exporting: {glb_path}")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_colors=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_draco_mesh_compression_enable=False,
        export_animations=True,
    )

    print(f"  Done: {os.path.basename(glb_path)}")


def main():
    input_dir = os.path.abspath(INPUT_DIR)
    output_dir = os.path.abspath(OUTPUT_DIR)

    if not os.path.isdir(input_dir):
        print(f"Error: input directory does not exist: {input_dir}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    fbx_files = sorted(glob.glob(os.path.join(input_dir, "*.fbx")))

    if not fbx_files:
        print(f"No .fbx files found in {input_dir}")
        sys.exit(0)

    print(f"\n{'='*60}")
    print(f"FBX → GLB Batch Converter")
    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")
    print(f"Files:  {len(fbx_files)}")
    print(f"{'='*60}\n")

    success = 0
    failed = 0

    for fbx_path in fbx_files:
        name = os.path.splitext(os.path.basename(fbx_path))[0]
        glb_path = os.path.join(output_dir, f"{name}.glb")

        print(f"[{success + failed + 1}/{len(fbx_files)}] {name}.fbx → {name}.glb")

        try:
            convert_fbx_to_glb(fbx_path, glb_path)
            success += 1
        except Exception as e:
            print(f"  FAILED: {e}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"Results: {success} succeeded, {failed} failed out of {len(fbx_files)}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
