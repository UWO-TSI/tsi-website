"""The seabed under the island's shallows (specs/v1-drop.md §8c.1, v1 water pass item 2).

Style targets (David, references/look/2026-10-13/): clear water over a visible sand bed with rocks and plants in it
(water-clarity-palette-ref.png, water-foam-shallows-ref.png). Our own art, built here; nothing is copied.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/water/build_seabed.py

Writes:
  web/public/assets/game/water/seabed-sand.webp  the bed's sand: 512 px, tileable, one repeat per 4 cells (needs cwebp)
  web/public/assets/game/water/seabed.glb        one mesh node per kind, drawn instanced (one draw per kind):
      boulder_a, boulder_b, boulder_c   chunky faceted rocks (c is tall: it breaks the surface in the shallows)
      seagrass_a, seagrass_b            a seagrass clump and a kelp frond (they sway on the world clock in the shader)
      coral_fan, coral_tube, coral_bush  coral-like plants: a branching fan, a tube cluster, a faceted bush

Frame: game units (x across, y up, z along; a character stands 1.36), each kind's base at y 0 on its own origin.
Matte throughout (roughness 1, no metal). Corals are white: the engine tints each instance. Every random choice is
seeded, so a rebuild writes the same models.
"""
import bmesh, bpy, math, os, shutil, subprocess, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cafe"))
import cafekit as K  # noqa: E402  (game→Blender axes, materials, export)
from cafekit import G, Mat  # noqa: E402

TAU = math.tau
K.OUT = os.path.join(K.ROOT, "web", "public", "assets", "game", "water")
os.makedirs(K.OUT, exist_ok=True)


# ================================================================ the sand (numpy, sRGB, row 0 at the top, tileable)
def tile_noise(n, cells, seed):
    return K._smooth_noise(np.random.default_rng(seed), n, n, cells)


def sand_texture(n=512):
    """Warm sand with wave ripple marks: crests run across x, warped by tileable noise so they wander and fork; the lee
    side of each crest a touch darker, grains and a few darker specks (bits of shell and weed). Every frequency is a whole
    number of periods across the tile, so it repeats without a seam."""
    u = (np.arange(n) + 0.5) / n
    U, V = np.meshgrid(u, u)
    warp = (tile_noise(n, 4, 11) - 0.5) * 0.9 + (tile_noise(n, 9, 12) - 0.5) * 0.25
    phase = (V * 9 + warp + 0.08 * np.sin(TAU * U * 2)) % 1.0
    # A ripple's profile: a gentle stoss slope up to a crest, a short steep lee down from it.
    crest = np.where(phase < 0.72, phase / 0.72, (1 - phase) / 0.28)
    lee = np.clip((phase - 0.72) / 0.28, 0, 1) * (phase > 0.72)
    breaks = tile_noise(n, 6, 13)
    strength = np.clip((breaks - 0.25) * 1.8, 0.25, 1)
    grain = tile_noise(n, 128, 14) * 0.6 + tile_noise(n, 64, 15) * 0.4
    patches = tile_noise(n, 3, 16)
    base = np.array(K.hexrgb("#e6d3a8"))
    val = 0.93 + 0.1 * (crest - 0.5) * strength - 0.07 * lee * strength + 0.06 * (grain - 0.5) + 0.05 * (patches - 0.5)
    rgb = base * val[..., None]
    # Cooler in the troughs (the finer, wetter sand settles there), warmer on the crests.
    rgb = rgb * (1 + 0.025 * (crest - 0.5)[..., None] * np.array([1.0, 0.2, -0.8]))
    rng = np.random.default_rng(17)
    for _ in range(240):
        cy, cx, r = rng.integers(0, n), rng.integers(0, n), rng.uniform(0.8, 2.2)
        tone = np.array(K.hexrgb(["#9b8a6b", "#b9a17a", "#f3ead6", "#7f8f6a"][rng.integers(0, 4)]))
        y0, x0 = cy - 3, cx - 3
        yy, xx = np.mgrid[y0:y0 + 7, x0:x0 + 7]
        d = np.hypot(yy - cy, xx - cx)
        a = np.clip((r - d) / 0.8, 0, 1)[..., None] * rng.uniform(0.35, 0.7)
        ys, xs = yy % n, xx % n
        rgb[ys, xs] = rgb[ys, xs] * (1 - a) + tone * a
    return np.clip(rgb, 0, 1)


def save_png(rgb, name):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    px = np.ones((h, w, 4), dtype=np.float32)
    px[..., :3] = rgb[::-1]
    img.pixels.foreach_set(px.ravel())
    path = os.path.join(K.OUT, f"{name}.png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    # Shipped as WebP (cwebp, Homebrew's libwebp): a twentieth of the PNG.
    webp = path[:-4] + ".webp"
    subprocess.run([shutil.which("cwebp") or "/opt/homebrew/bin/cwebp", "-q", "88", "-quiet", path, "-o", webp], check=True)
    os.remove(path)
    print(f"TEXTURE {name}.webp {w}x{h} bytes={os.path.getsize(webp)}")


# ================================================================ geometry
def finish(bm, name, mat, smooth_deg):
    """One object from a bmesh: flat shading wherever faces meet past `smooth_deg` (faceted rocks: all of it)."""
    bm.normal_update()
    sharp = [e for e in bm.edges if len(e.link_faces) != 2 or math.degrees(e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0)) > smooth_deg]
    bmesh.ops.split_edges(bm, edges=sharp)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        f.smooth = True
        for lp in f.loops:
            lp[uv].uv = (0.5, 0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat.m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def boulder(name, size, seed, mat, squash=0.62, sink=0.12):
    """A chunky faceted rock: an icosphere pushed about (whole facets, not noise), squashed, its foot flattened and sunk."""
    r = np.random.default_rng(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    for v in bm.verts:
        p = Vector(v.co)
        k = 1 + r.uniform(-0.16, 0.2)
        v.co = Vector((p.x * size[0] * k, p.y * size[2] * k, p.z * size[1] * squash * k))   # Blender z is game y
    for v in bm.verts:
        if v.co.z < -size[1] * 0.18:
            v.co.z = -size[1] * 0.18 - 0.02 * r.random()
    lift = min(v.co.z for v in bm.verts)
    for v in bm.verts:
        v.co.z -= lift + sink
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, mat, 12)


def ribbon(bm, base, height, width, lean, twist, segs, curl):
    """A tapered blade standing from `base` (game point): a ribbon of quads, bending over with height and turning."""
    pts = []
    for i in range(segs + 1):
        t = i / segs
        bend = lean * t * t
        ang = twist + curl * t
        cx = base[0] + math.cos(ang) * bend
        cz = base[2] + math.sin(ang) * bend
        cy = base[1] + height * t * (1 - 0.18 * t * abs(lean))
        w = width * (1 - 0.85 * t) + 0.004
        sx, sz = -math.sin(ang) * w / 2, math.cos(ang) * w / 2
        pts.append(((cx - sx, cy, cz - sz), (cx + sx, cy, cz + sz)))
    vs = [(bm.verts.new(G(*a)), bm.verts.new(G(*b))) for a, b in pts]
    for i in range(segs):
        bm.faces.new([vs[i][0], vs[i][1], vs[i + 1][1], vs[i + 1][0]])


def seagrass(name, blades, hmin, hmax, width, spread, seed, mat, segs=3, lean=0.16):
    r = np.random.default_rng(seed)
    bm = bmesh.new()
    for _ in range(blades):
        a, d = r.uniform(0, TAU), spread * math.sqrt(r.random())
        base = (math.cos(a) * d, 0.0, math.sin(a) * d)
        ribbon(bm, base, r.uniform(hmin, hmax), width * r.uniform(0.8, 1.2), r.uniform(0.3, 1.0) * lean * 2, r.uniform(0, TAU), segs, r.uniform(-0.8, 0.8))
    return finish(bm, name, mat, 70)


def tube(bm, path, r0, r1, sides):
    """A tapering tube along game points (open ends): branches and stalks."""
    P = [Vector(p) for p in path]
    rings = []
    for i, p in enumerate(P):
        d = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        ref = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
        n1 = d.cross(ref).normalized()
        n2 = d.cross(n1)
        rr = r0 + (r1 - r0) * i / max(1, len(P) - 1)
        rings.append([bm.verts.new(G(*(p + (n1 * math.cos(TAU * j / sides) + n2 * math.sin(TAU * j / sides)) * rr))) for j in range(sides)])
    for i in range(len(rings) - 1):
        for j in range(sides):
            j2 = (j + 1) % sides
            bm.faces.new([rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]])
    return rings


def coral_fan(name, seed, mat):
    """A sea fan: branches forking upward in one plane (with a little depth), thinning as they go."""
    r = np.random.default_rng(seed)
    bm = bmesh.new()

    def branch(p, ang, length, rad, depth):
        q = (p[0] + math.sin(ang) * length, p[1] + math.cos(ang) * length, p[2] + r.uniform(-0.02, 0.02))
        mid = ((p[0] + q[0]) / 2 + r.uniform(-0.015, 0.015), (p[1] + q[1]) / 2, (p[2] + q[2]) / 2)
        tube(bm, [p, mid, q], rad, rad * 0.7, 3)
        if depth > 0:
            for da in (-0.42, 0.38):
                branch(q, ang + da + r.uniform(-0.12, 0.12), length * r.uniform(0.68, 0.82), rad * 0.72, depth - 1)

    branch((0, -0.02, 0), 0.0, 0.17, 0.028, 3)
    return finish(bm, name, mat, 60)


def coral_tubes(name, seed, mat):
    """A cluster of tube coral: open stalks of differing height, each flared a little at its lip."""
    r = np.random.default_rng(seed)
    bm = bmesh.new()
    for k in range(5):
        a, d = TAU * k / 5 + r.uniform(-0.3, 0.3), 0.06 + 0.06 * r.random() if k else 0.0
        x, z, h = math.cos(a) * d, math.sin(a) * d, r.uniform(0.14, 0.34)
        lx, lz = x * 0.35, z * 0.35
        rings = tube(bm, [(x, -0.02, z), (x + lx * 0.5, h * 0.6, z + lz * 0.5), (x + lx, h, z + lz)], 0.036, 0.045, 5)
        # The lip turns in: a short collar down the inside, so the open top reads as a tube from above.
        inner = [bm.verts.new(v.co + (Vector(G(x + lx, h - 0.03, z + lz)) - v.co) * 0.45) for v in rings[-1]]
        for j in range(5):
            j2 = (j + 1) % 5
            bm.faces.new([rings[-1][j], rings[-1][j2], inner[j2], inner[j]])
    return finish(bm, name, mat, 55)


def coral_bush(name, seed, mat):
    """A bushy coral: a short stalk crowned with faceted clumps, the soft round plant the reference's shallows have."""
    r = np.random.default_rng(seed)
    bm = bmesh.new()
    tube(bm, [(0, -0.02, 0), (0.01, 0.12, 0.0), (0.0, 0.2, 0.01)], 0.035, 0.028, 5)
    for k in range(6):
        a = TAU * k / 6 + r.uniform(-0.4, 0.4)
        d, y, rad = (0.0, 0.27, 0.15) if k == 0 else (r.uniform(0.08, 0.13), r.uniform(0.15, 0.23), r.uniform(0.1, 0.13))
        cx, cz = math.cos(a) * d, math.sin(a) * d
        geom = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        for v in geom["verts"]:
            p = Vector(v.co) * (1 + r.uniform(-0.12, 0.12))
            v.co = G(cx + p.x * rad, y + p.z * rad * 0.8, cz + p.y * rad)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, mat, 12)


def build():
    K.reset()
    save_png(sand_texture(), "seabed-sand")
    stone = Mat("M_SeabedStone", "#8f9a98", 1.0)
    grass = Mat("M_Seagrass", "#5f9a58", 1.0)
    kelp = Mat("M_Kelp", "#6d8a3e", 1.0)
    coral = Mat("M_Coral", "#f4efe8", 1.0)
    obs = [
        boulder("boulder_a", (0.32, 0.36, 0.3), 1, stone),
        boulder("boulder_b", (0.48, 0.3, 0.26), 2, stone, squash=0.7),
        boulder("boulder_c", (0.3, 0.9, 0.28), 3, stone, squash=1.0, sink=0.05),
        seagrass("seagrass_a", 11, 0.22, 0.42, 0.04, 0.12, 4, grass),
        seagrass("seagrass_b", 5, 0.5, 0.85, 0.085, 0.07, 5, kelp, segs=4, lean=0.22),
        coral_fan("coral_fan", 6, coral),
        coral_tubes("coral_tube", 7, coral),
        coral_bush("coral_bush", 8, coral),
    ]
    for o in obs:
        print(f"KIND {o.name} tris={K.tris([o])}")
    K.export(obs, "seabed")


if __name__ == "__main__":
    build()
