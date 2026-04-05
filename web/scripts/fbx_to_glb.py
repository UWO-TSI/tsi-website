"""
Blender Python script — Batch convert FBX to self-contained texture-embedded GLB.

Usage:
  blender --background --python fbx_to_glb.py -- [input_dir] [output_dir]

Defaults:
  input_dir  = ../public/assets/buildings/
  output_dir = ../public/assets/buildings/

Example:
  blender --background --python web/scripts/fbx_to_glb.py
  blender --background --python web/scripts/fbx_to_glb.py -- ./my_fbx/ ./my_glb/

Requirements:
  - Blender 3.6+ (tested on 4.x)
  - FBX files may reference external textures — this script packs them into the GLB

What it does:
  1. Finds all .fbx files in input_dir
  2. For each file:
     a. Clears the scene
     b. Imports the FBX
     c. Packs all external textures into the blend file
     d. Converts image textures to PNG (GLB-compatible)
     e. Exports as .glb with textures embedded
  3. Prints a summary
"""

import bpy
import sys
import os
from pathlib import Path


def get_args():
    """Parse arguments after '--' separator."""
    argv = sys.argv
    if "--" in argv:
        args = argv[argv.index("--") + 1:]
    else:
        args = []

    script_dir = Path(os.path.abspath(__file__)).parent
    default_dir = script_dir / ".." / "public" / "assets" / "buildings"

    input_dir = Path(args[0]) if len(args) > 0 else default_dir
    output_dir = Path(args[1]) if len(args) > 1 else input_dir

    return input_dir.resolve(), output_dir.resolve()


def clear_scene():
    """Remove all objects, meshes, materials, images from the scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def pack_and_convert_textures():
    """Pack all external textures and ensure they're PNG (GLB-compatible)."""
    for image in bpy.data.images:
        if image.name in ("Render Result", "Viewer Node"):
            continue

        # Pack external images into the blend file
        if image.source == "FILE" and not image.packed_file:
            try:
                image.pack()
                print(f"    Packed texture: {image.name}")
            except Exception as e:
                print(f"    Warning: Could not pack {image.name}: {e}")

        # GLB only supports PNG and JPEG — convert others to PNG
        if image.file_format not in ("PNG", "JPEG"):
            image.file_format = "PNG"


def apply_transforms():
    """Apply all transforms to avoid export scale/rotation issues."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.select_all(action="DESELECT")


def convert_fbx_to_glb(fbx_path: Path, glb_path: Path):
    """Import an FBX file and export it as a self-contained GLB."""
    clear_scene()

    # Import FBX
    bpy.ops.import_scene.fbx(
        filepath=str(fbx_path),
        use_anim=True,
        use_custom_normals=True,
        force_connect_children=False,
        automatic_bone_orientation=True,
    )

    print(f"    Imported: {len(bpy.data.objects)} objects, {len(bpy.data.materials)} materials")

    # Pack textures
    pack_and_convert_textures()

    # Apply transforms
    try:
        apply_transforms()
    except Exception as e:
        print(f"    Warning: Could not apply transforms: {e}")

    # Export GLB (binary glTF with embedded textures)
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_colors=True,
        export_cameras=False,
        export_lights=False,
        export_animations=True,
        export_image_format="AUTO",  # PNG for lossless, JPEG for lossy
        export_apply=True,
    )

    # Report file size
    size_kb = glb_path.stat().st_size / 1024
    print(f"    Exported: {glb_path.name} ({size_kb:.1f} KB)")


def main():
    input_dir, output_dir = get_args()

    print(f"\n{'='*60}")
    print(f"FBX → GLB Batch Converter")
    print(f"{'='*60}")
    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")
    print()

    if not input_dir.exists():
        print(f"Error: Input directory does not exist: {input_dir}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    fbx_files = sorted(input_dir.glob("*.fbx")) + sorted(input_dir.glob("*.FBX"))

    if not fbx_files:
        print("No .fbx files found.")
        sys.exit(0)

    print(f"Found {len(fbx_files)} FBX file(s):\n")

    results = {"success": [], "failed": []}

    for fbx_path in fbx_files:
        glb_name = fbx_path.stem + ".glb"
        glb_path = output_dir / glb_name

        print(f"  [{fbx_files.index(fbx_path)+1}/{len(fbx_files)}] {fbx_path.name} → {glb_name}")

        try:
            convert_fbx_to_glb(fbx_path, glb_path)
            results["success"].append(fbx_path.name)
        except Exception as e:
            print(f"    ERROR: {e}")
            results["failed"].append((fbx_path.name, str(e)))

        print()

    # Summary
    print(f"{'='*60}")
    print(f"Results: {len(results['success'])} succeeded, {len(results['failed'])} failed")
    print(f"{'='*60}")

    if results["success"]:
        print(f"\n  Converted:")
        for name in results["success"]:
            print(f"    ✓ {name}")

    if results["failed"]:
        print(f"\n  Failed:")
        for name, err in results["failed"]:
            print(f"    ✗ {name}: {err}")

    print()


if __name__ == "__main__":
    main()
