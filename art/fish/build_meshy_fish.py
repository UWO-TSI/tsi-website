"""The approved raw Meshy fish into game fish (fish-models lane, round 2; David 2026-11-25: "looks good, now time to
model and convert into triangles"). One script for every Meshy fish, matching the house finish of the remodel set
(art/remodel/build_fish.py): one mesh, one material, one texture, smooth shading, the counter-shade in COLOR_0, the soft
wet sheen (roughness 0.5, no metal), the game's fish frame (head +y, back -z in game axes, centred), sized against the
house fish of its size class.

  Blender -b --factory-startup -P art/fish/build_meshy_fish.py [-- only common-shiner,brown-trout]

For each fish in FISH: reads art/fish/meshy/<slug>-raw.glb (not in git, see specs/lanes/fish-models.md), then
  1. turns it into the game frame (Meshy raw: nose -y, back +z, as imported) and scales it to LENGTH;
  2. shape edits on the dense mesh: the pectoral (and any listed) fins swung back against the body and drooped, like
     the house fish (Meshy made them flat blades straight out); the paddlefish's jaw slimmed;
  3. a low-poly copy, collapse-decimated (mirror-symmetric) to TRIS, smart-UV-unwrapped;
  4. the raw colour baked onto it (Cycles diffuse colour, selected to active) at TEX px, then a colour nudge toward the
     concept (Brown Trout, Paddlefish), the house blur and grade;
  5. exported to web/public/assets/game/remodel/fish/<slug>.glb. Pack after: cd web && node scripts/pack-glbs.mjs <files>.
"""
import math, os, sys
import bpy, bmesh
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "remodel"))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
import dumpkit as D  # noqa: E402
import build_fish as H  # noqa: E402  (the house finish: blur, grade, soften, counter_shade)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RAW = os.path.join(HERE, "meshy")
CONCEPT = os.environ.get("FISH_CONCEPTS")  # dir with the registered concept views (<short>-side.png), for the colour nudge
TEX = 1024

# slug: length (Blender z, game units; house: dace 0.63, golden trout 0.79, char 1.05, pike 1.35, gar 1.63, sturgeon 2.38),
# triangles, fins to fold (window as a fraction of length from the nose, body half-width there as a fraction of length),
# colour nudge toward the concept (0..1), the concept's short name, jaw slimming.
FISH = {
    "common-shiner": dict(length=0.62, tris=900, fins=[(0.18, 0.33, 0.076)], nudge=0.0, short="shiner"),
    "brown-trout": dict(length=0.95, tris=1200, fins=[(0.19, 0.33, 0.071)], nudge=0.85, short="trout"),
    "paddlefish": dict(length=2.3, tris=1600, fins=[(0.37, 0.475, 0.06)], nudge=0.6, short="paddle", jaw=(0.17, 0.38, 0.9, 0.86)),
    "muskellunge": dict(length=1.7, tris=1400, fins=[(0.21, 0.33, 0.052), (0.47, 0.55, 0.049)], nudge=0.0, short="muskie"),
}
SWING, DROOP = math.radians(58), math.radians(18)
NAMES = {"common-shiner": "CommonShiner", "brown-trout": "BrownTrout", "paddlefish": "Paddlefish", "muskellunge": "Muskellunge"}


def load_raw(slug):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(RAW, f"{slug}-raw.glb"))
    obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in obs:
        o.data.transform(o.matrix_world); o.parent = None; o.matrix_world = Matrix.Identity(4)
    for o in [o for o in bpy.context.scene.objects if o.type != "MESH"]:
        bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    hi = bpy.context.view_layer.objects.active
    hi.name = "high"
    bm = bmesh.new(); bm.from_mesh(hi.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(hi.data); bm.free()
    return hi


def to_frame(ob, length):
    """Meshy raw (nose -y, back +z) -> house frame in Blender axes (head +z, back +y), centred, LENGTH long."""
    ob.data.transform(Matrix.Rotation(math.radians(-90), 4, "X"))
    V = np.array([v.co for v in ob.data.vertices])
    lo, hi = V.min(0), V.max(0)
    s = length / (hi[2] - lo[2])
    ob.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation(Vector(-(lo + hi) / 2)))


def coords(ob):
    a = np.empty(len(ob.data.vertices) * 3); ob.data.vertices.foreach_get("co", a); return a.reshape(-1, 3)


def set_coords(ob, V):
    ob.data.vertices.foreach_set("co", V.ravel()); ob.data.update()


def smooth01(t):
    t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)


def slim_jaw(ob, f0, f1, kx, ky):
    """Slim the head behind the paddle: x toward the midline by kx, the lower half toward the body axis by ky."""
    V = coords(ob); L = V[:, 2].max() - V[:, 2].min(); f = (V[:, 2].max() - V[:, 2]) / L
    w = smooth01((f - f0) / 0.05) * smooth01((f1 - f) / 0.05)
    axis = np.median(V[(f > f0) & (f < f1), 1])
    V[:, 0] *= 1 - (1 - kx) * w
    low = V[:, 1] < axis
    V[low, 1] = axis + (V[low, 1] - axis) * (1 - (1 - ky) * w[low])
    set_coords(ob, V)


def fold_fins(ob, f0, f1, wfrac):
    """Swing the fins that stick out sideways (|x| past the body's half-width, between f0 and f1 from the nose) back
    toward the tail and down a little, about a hinge on the body's side; the angle ramps in over the first 3% of length
    past the hinge so the root stays joined."""
    V = coords(ob); L = V[:, 2].max() - V[:, 2].min(); f = (V[:, 2].max() - V[:, 2]) / L
    w = wfrac * L
    sel = (f >= f0) & (f <= f1) & (np.abs(V[:, 0]) > w)
    root = sel & (np.abs(V[:, 0]) < w + 0.04 * L)
    for side in (1, -1):
        m = sel & (np.sign(V[:, 0]) == side)
        r = root & (np.sign(V[:, 0]) == side)
        if not m.any():
            continue
        hinge = np.array([side * w, V[r, 1].mean(), V[r, 2].mean()])
        t = smooth01((np.abs(V[m, 0]) - w) / (0.03 * L))
        P = V[m] - hinge
        out = np.empty_like(P)
        for i, (p, ti) in enumerate(zip(P, t)):
            Ry = Matrix.Rotation(side * SWING * ti, 3, "Y")
            Rz = Matrix.Rotation(-side * DROOP * ti, 3, "Z")
            out[i] = Rz @ (Ry @ Vector(p))
        V[m] = out + hinge
        print(f"  fins {f0:.2f}-{f1:.2f} side {side}: {m.sum()} verts")
    set_coords(ob, V)


def make_low(hi, tris):
    lo = hi.copy(); lo.data = hi.data.copy(); lo.name = "low"
    bpy.context.collection.objects.link(lo)
    lo.data.materials.clear()
    n = sum(len(p.vertices) - 2 for p in lo.data.polygons)
    for ratio in (min(1.0, 60000 / n), None):  # a first pass to 60k keeps the collapse stable, then to the target
        n = sum(len(p.vertices) - 2 for p in lo.data.polygons)
        mod = lo.modifiers.new("dec", "DECIMATE")
        mod.ratio = ratio if ratio else tris / n
        mod.use_symmetry = True; mod.symmetry_axis = "X"
        bpy.context.view_layer.objects.active = lo
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bm = bmesh.new(); bm.from_mesh(lo.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
    bm.to_mesh(lo.data); bm.free()
    while lo.data.uv_layers:
        lo.data.uv_layers.remove(lo.data.uv_layers[0])
    lo.data.uv_layers.new(name="UVMap")
    bpy.ops.object.select_all(action="DESELECT"); lo.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006, area_weight=1.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    return lo


def bake(hi, lo, slug):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = 1; sc.cycles.device = "CPU"
    img = bpy.data.images.new(f"{NAMES[slug]}_col", TEX, TEX, alpha=True)
    img.generated_color = (0, 0, 0, 0)
    mat = bpy.data.materials.new(f"mFish{NAMES[slug]}"); mat.use_nodes = True
    nt = mat.node_tree; b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    nt.nodes.active = tex
    lo.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
    L = max(lo.dimensions)
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_selected_to_active=True,
                        cage_extrusion=0.012 * L, max_ray_distance=0.05 * L, margin=8, margin_type="EXTEND")
    return mat, img, b


def concept_stats(short):
    im = bpy.data.images.load(os.path.join(CONCEPT, "meshy", f"{short}-side.png"))
    a = np.array(im.pixels[:]).reshape(im.size[1], im.size[0], 4)
    px = a[a[..., 3] > 0.9][:, :3]
    bpy.data.images.remove(im)
    return px.mean(0), px.std(0)


def finish_texture(img, slug, cfg):
    px = D.pixels(img)  # sRGB floats, as the concept PNG reads
    rgb, alpha = px[..., :3], px[..., 3]
    m = alpha > 0.5
    rgb = H.grade(H.blur(rgb, 1))
    # After the house grade, so the finished colour lands on the concept's (the grade alone dulls a golden trout).
    if cfg["nudge"] and CONCEPT:
        cm, cs = concept_stats(cfg["short"])
        tm, ts = rgb[m].mean(0), rgb[m].std(0)
        moved = (rgb - tm) * (cs / np.maximum(ts, 1e-4)) + cm
        rgb = rgb + (moved - rgb) * cfg["nudge"]
        print(f"  nudge {slug}: mean {tm.round(3)} -> {cm.round(3)} (k {cfg['nudge']})")
    px[..., :3] = rgb; px[..., 3] = 1.0
    D.set_pixels(img, px)


def build(slug):
    cfg = FISH[slug]
    print("FISH", slug)
    hi = load_raw(slug)
    to_frame(hi, cfg["length"])
    if "jaw" in cfg:
        slim_jaw(hi, *cfg["jaw"])
    for fin in cfg["fins"]:
        fold_fins(hi, *fin)
    lo = make_low(hi, cfg["tris"])
    mat, img, bsdf = bake(hi, lo, slug)
    finish_texture(img, slug, cfg)
    img.pack()
    bsdf.inputs["Roughness"].default_value = H.ROUGH
    bsdf.inputs["Metallic"].default_value = 0.0
    bpy.data.objects.remove(hi, do_unlink=True)
    lo.name = lo.data.name = f"Fish{NAMES[slug]}"
    H.soften([lo])
    # Thin fins fold to a sheet whose two sides share vertices after the collapse: split the normals at edges sharper
    # than 70 degrees so a fin isn't shaded dark by the average of its two faces (the body stays smooth).
    lo.data.set_sharp_from_angle(angle=math.radians(70))
    H.counter_shade([lo])
    V = coords(lo)
    print(f"  size {np.ptp(V, 0).round(3)} (x wide, y tall, z long)")
    D.export([lo], f"game/remodel/fish/{slug}.glb", fmt="AUTO")


if __name__ == "__main__":
    names = list(FISH)
    if "only" in ARGS:
        names = [n for n in names if n in ARGS[ARGS.index("only") + 1].split(",")]
    for n in names:
        build(n)
