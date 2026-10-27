"""Outfit library (deliverable 3): 8 tops, 6 bottoms, the sundress and 6 shoes; pass 2: the crafted silk sweater (top),
monarch cape and koi kimono (one-pieces), `item` = their economy slug. The rain-cape, robe and jumpsuit were cut
(David's wardrobe cut, playtest round 1, 2026-10-14).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/characters/outfits/build_outfits.py [-- ids ...]
  (ids: rebuild just these parts; the rest keep their GLBs and catalogue entries)

Every piece is a shell on base/body_shape.py (the locked v6 torso/limb rings) at CL + ease over the skin, so it deforms
with the body; skirts and dresses blend the hips into both thighs. Each GLB is the 22-bone CharacterRig + one skinned
mesh (bind by bone name, like the hair). Materials are flat palette slots (M_Main, M_Accent, M_Trim, M_Sole, M_Sock)
tinted from palette.json at runtime; the older tops also carry M_Decal: a small patch 4 mm over the chest/badge spot,
UV 0..1, alpha-clipped, transparent by default (the TSI crewneck ships with the TSI mark placeholder).

clothing-v2 (David, 2026-10-26): the starter set is rebuilt as universal models, one mesh per garment type, a design
painted on it (designs.png; the striped long-sleeve is the long-sleeve with the stripe design), each fitted to the clip
base's own skin (weights transferred from it) with the skin it covers cut away in the engine (hidden_cut.py bodycut).
Writes outfits/<slot>/<model or id>.glb, decal_tsi_mark.png, designs.png and the "outfits" and "designs" sections of
../character_catalog.json.
"""
import bpy, json, math, os, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import kit  # noqa: E402
from kit import Piece, body as B  # noqa: E402

ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def body_source():
    """The clip base's body in rest pose as the engine skins it, for weight transfer (clothing-v2): its skin, and the
    base tee and shorts standing in for the torso under clothes. Returns positions (Blender axes), triangles and each
    vertex's {bone: weight}; the imported objects go again before the rig is loaded."""
    cat = json.load(open(os.path.join(HERE, "..", "character_catalog.json")))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "..", cat["base"]["clips_glb"]))
    pos, tris, wts = [], [], []
    for name in ("V6_Body", "V6_Top", "V6_Bottom"):
        o = bpy.data.objects[name]
        names = [g.name.replace(kit.BONE, "") for g in o.vertex_groups]
        n0 = len(pos)
        for v in o.data.vertices:
            pos.append(o.matrix_world @ v.co)
            wts.append({names[g.group]: g.weight for g in v.groups if g.weight > 1e-4})
        o.data.calc_loop_triangles()
        tris += [tuple(n0 + i for i in t.vertices) for t in o.data.loop_triangles]
    for o in [o for o in bpy.data.objects if o not in before]:
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.actions, bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    return pos, tris, wts


BODY = body_source()
rig = kit.load_rig(scene)

CL, X0 = B.CL, B.ARM_X0
Z_TEE, Z_CHEST, Z_SH, Z_NECK = B.WAIST - 0.012, B.SH_Z - 0.08, B.SH_Z - 0.01, B.SH_Z + 0.03
R8 = [45 * k for k in range(8)]
R10 = [36 * k for k in range(10)]
P8 = [22.5 + 45 * k for k in range(8)]           # flat top/bottom panel (shoes, cape)
SIDES = ((1, "L"), (-1, "R"))
T = B.torso_pt


# ================================================================ decal images
def tsi_mark(n=128, ss=4):
    """Placeholder TSI mark: cream roundel with blocky T S I (sRGB, transparent background)."""
    N = n * ss
    y, x = (np.mgrid[0:N, 0:N] + 0.5) / N
    w = 0.06
    rect = lambda x0, y0, x1, y1: (x >= x0) & (x <= x1) & (y >= y0) & (y <= y1)
    r = np.hypot(x - 0.5, y - 0.5)
    m = (r < 0.47) & (r > 0.405)
    m |= rect(0.19, 0.33, 0.41, 0.33 + w) | rect(0.3 - w / 2, 0.33, 0.3 + w / 2, 0.67)                 # T
    m |= (rect(0.44, 0.33, 0.58, 0.33 + w) | rect(0.44, 0.33, 0.44 + w, 0.5 + w / 2) |                    # S
          rect(0.44, 0.5 - w / 2, 0.58, 0.5 + w / 2) | rect(0.58 - w, 0.5 - w / 2, 0.58, 0.67) |
          rect(0.44, 0.67 - w, 0.58, 0.67))
    m |= rect(0.7 - w / 2, 0.33, 0.7 + w / 2, 0.67) | rect(0.64, 0.33, 0.76, 0.33 + w) | rect(0.64, 0.67 - w, 0.76, 0.67)
    a = m.astype(np.float32).reshape(n, ss, n, ss).mean(axis=(1, 3))
    out = np.zeros((n, n, 4), np.float32)
    out[..., :3] = [int(kit.PAL["outfit"][0][i:i + 2], 16) / 255 for i in (1, 3, 5)]
    out[..., 3] = a
    return out


IMG = {None: (kit.image("decal_blank", np.zeros((8, 8, 4), np.float32)), None),     # key -> (image, catalogue default)
       "tsi_mark": (kit.image("decal_tsi_mark", tsi_mark(), os.path.join(HERE, "decal_tsi_mark.png")), "outfits/decal_tsi_mark.png")}


PARTS, part = kit.registry()


def with_decal(mats, img=None):
    return {**mats, "M_Decal": ("decal", img)}


# ================================================================ shell helpers
def trunk(pc, zs, offs, lons=R10, mat=None, caps=(None, None), region="torso"):
    offs = offs if isinstance(offs, (list, tuple)) else [offs] * len(zs)
    pc.region = region
    return pc.band([[T(l, z, o) for l in lons] for z, o in zip(zs, offs)], mat=mat, caps=caps)


def open_front(pc, pt, zs, e_fn, n=10, region="torso", mat=None):
    """Band open at the front: ring k runs lon e(z)..360-e(z); pt(lon, z) -> point."""
    pc.region = region
    rings = [[pt(e_fn(z) + (360 - 2 * e_fn(z)) * k / n, z) for k in range(n + 1)] for z in zs]
    refs = [B.torso_at((a + b) / 2, 0)[0] for a, b in zip(zs[:-1], zs[1:])]
    return pc.band(rings, closed=False, refs=refs, mat=mat)


def oval(lon, z, rx, ry, cy=0.0):
    a = math.radians(lon)
    return Vector((math.sin(a) * rx, cy - math.cos(a) * ry, z))


def sleeves(pc, xs, offs, lons=R8, mat=None):
    for sx, s in SIDES:
        pc.region = f"arm_{s}"
        pc.band([[B.arm_pt(sx, x, l, o) for l in lons] for x, o in zip(xs, offs)], mat=mat)


def legs(pc, zs, offs, lons=R8, mat=None, top_cap=None):
    """Leg tubes; top_cap=z: each closed at its top by a fan to (leg centre, z) inside the seat, so a thigh raised to
    sit shows the shorts' seat at its back end, not the tube's open end."""
    for sx, s in SIDES:
        pc.region = f"leg_{s}"
        pc.band([[B.leg_pt(sx, z, l, o) for l in lons] for z, o in zip(zs, offs)], mat=mat,
                caps=(None, Vector((sx * B.LEG_X, 0, top_cap)) if top_cap else None))


def seat(pc, top_z, offs=(CL, CL, CL), mat=None):
    trunk(pc, [B.CROTCH - 0.012, B.CROTCH + 0.025, top_z], list(offs), mat=mat,
          caps=(Vector((0, 0, B.CROTCH - 0.034)), None))


def decal(pc, lon0, lon1, z0, z1, off, n=2):
    """M_Decal patch on the torso shell at `off`, UV 0..1 (u toward the character's left = viewer's right)."""
    pc.region, keep = "torso", pc.mat
    pc.mat = "M_Decal"
    g = [[pc.v(T(lon0 + (lon1 - lon0) * i / n, z0 + (z1 - z0) * j / n, off)) for i in range(n + 1)] for j in range(n + 1)]
    for j in range(n):
        ref = B.torso_at(z0 + (z1 - z0) * (j + 0.5) / n, 0)[0]
        for i in range(n):
            pc.f([g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]], ref,
                 uv=[(i / n, j / n), ((i + 1) / n, j / n), ((i + 1) / n, (j + 1) / n), (i / n, (j + 1) / n)])
    pc.mat = keep


def chest_decal(pc, off, half=17, z0=0.372, z1=0.44):
    decal(pc, -half, half, z0, z1, off + 0.004)


def badge_decal(pc, off):
    decal(pc, 30, 52, 0.395, 0.445, off + 0.004)


def r10_ring(z, off, m=2):
    """The torso's own 10-gon at (z, off), each edge split m times: faces stay parallel to the skin and to every
    R10 top, so layered shells never poke through each other between vertices."""
    base = [T(36 * j, z, off) for j in range(10)]
    return [base[j].lerp(base[(j + 1) % 10], i / m) for j in range(10) for i in range(m)]


L20 = [18 * k for k in range(20)]


def placket(pc, off, mat, z0=Z_TEE + 0.003, z1=Z_NECK - 0.006, half=5):
    """Raised button strip down the centre front."""
    keep, pc.mat, pc.region = pc.mat, mat, "torso"
    zs = [z0, (z0 + z1) / 2, z1]
    pc.band([[T(l, z, off) for l in (-half, 0, half)] for z in zs], closed=False,
            refs=[B.torso_at(z, 0)[0] for z in zs[:-1]])
    pc.mat = keep


strip = kit.strip


def stud(pc, lon, z, off, size, mat):
    """Small flat square on the torso shell (buttons, toggles)."""
    keep, pc.mat, pc.region = pc.mat, mat, "torso"
    dl = math.degrees(size / 0.14)
    vs = [pc.v(T(lon + a * dl, z + b * size, off)) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    pc.f(vs, B.torso_at(z, 0)[0])
    pc.mat = keep


def hood_down(pc, off):
    """Hood lying on the upper back: a soft cowl narrowing to a rounded point."""
    rows = [(Z_NECK + 0.005, 116, 0.0), (Z_SH, 98, 0.012), (Z_SH - 0.04, 70, 0.012), (Z_SH - 0.07, 38, 0.004)]
    grid = [[T(180 - hw + 2 * hw * k / 5, z, off + bulge) for k in range(6)] for z, hw, bulge in rows]
    pc.region = "torso"
    pc.band(grid, closed=False, caps=(None, T(180, Z_SH - 0.092, off - 0.004)),
            refs=[B.torso_at(z, 0)[0] for z, _, _ in rows[:-1]])


LONG_SLEEVE = ([X0 * 0.8, X0 + 0.03, X0 + B.ARM_LEN * 0.55, 0.238, 0.262], [0.013, CL + 0.002, CL + 0.002, CL + 0.003, CL + 0.001])


# ================================================================ tops
@part("top_cardigan", "top", "Cardigan", with_decal({"M_Main": ("outfit", 7), "M_Accent": ("outfit", 0), "M_Trim": ("outfit", 0)}),
      decal=True)
def cardigan(pc):
    zs = [B.WAIST - 0.022, B.WAIST + 0.02, Z_CHEST, Z_SH, Z_NECK]
    pc.mat = "M_Accent"                                          # the tee under the open front
    pc.region = "torso"
    pc.band([[T(l, z, CL) for l in (-40, -20, 0, 20, 40)] for z in zs[:1] + [B.WAIST - 0.012] + zs[1:]], closed=False)
    pc.mat = "M_Main"
    e = lambda z: 7 + 27 * ((z - zs[0]) / (zs[-1] - zs[0])) ** 1.6
    open_front(pc, lambda l, z: T(l, z, CL + 0.009), zs, e)
    sleeves(pc, *LONG_SLEEVE)
    for z in (0.35, 0.39, 0.43):
        stud(pc, -e(z) - 4, z, CL + 0.012, 0.007, "M_Trim")
    badge_decal(pc, CL + 0.009)


@part("top_collar_shirt", "top", "Collared shirt", with_decal({"M_Main": ("outfit", 10), "M_Accent": ("outfit", 1)}), decal=True)
def collar_shirt(pc):
    trunk(pc, [Z_TEE, B.WAIST + 0.02, Z_CHEST, Z_SH, Z_NECK], [CL + 0.004, CL + 0.001, CL + 0.001, CL + 0.001, CL + 0.001])
    placket(pc, CL + 0.004, "M_Accent")
    sleeves(pc, [X0 * 0.8, X0 + 0.03, X0 + 0.062], [0.013, CL + 0.001, 0.013])
    pc.mat, pc.region = "M_Accent", "torso"
    lons = [12, 55, 95, 135, 180, 225, 265, 305, 348]
    drop = lambda l: 0.026 * max(0.0, math.cos(math.radians(l))) ** 6
    pc.band([[T(l, Z_NECK + 0.006, CL + 0.004) for l in lons],
             [T(l, Z_NECK - 0.028 - drop(l), CL + 0.03 - 0.012 * drop(l) / 0.026) for l in lons]],
            closed=False, refs=[B.torso_at(Z_NECK, 0)[0]])
    pc.mat = "M_Main"
    badge_decal(pc, CL + 0.001)


@part("top_sweater_vest", "top", "Sweater vest over tee",
      with_decal({"M_Main": ("outfit", 3), "M_Accent": ("outfit", 1)}), decal=True)
def sweater_vest(pc):
    pc.mat = "M_Accent"
    sleeves(pc, [X0 * 0.8, X0 + 0.03, X0 + 0.058], [0.013, CL, 0.0118])
    pc.region = "torso"
    pc.band([[T(l, z, CL) for l in (-32, -16, 0, 16, 32)] for z in (0.39, Z_SH, Z_NECK)], closed=False)
    pc.mat = "M_Main"
    zs = [B.WAIST - 0.032, B.WAIST - 0.016, B.WAIST + 0.02, 0.4, Z_SH, Z_NECK]
    offs = dict(zip(zs, [CL + 0.006, CL + 0.01, CL + 0.012, CL + 0.012, CL + 0.011, CL + 0.009]))
    open_front(pc, lambda l, z: T(l, z, offs[z]), zs, lambda z: 0.0 if z <= 0.4 else 28 * (z - 0.4) / (Z_NECK - 0.4))
    chest_decal(pc, CL + 0.012, half=16, z0=0.345, z1=0.395)


@part("top_tsi_crew", "top", "TSI crewneck", with_decal({"M_Main": ("outfit", 2), "M_Accent": ("outfit", 3)}, "tsi_mark"), decal=True)
def tsi_crew(pc):
    rib = lambda i, k: "M_Accent" if i == 0 else None
    trunk(pc, [B.WAIST - 0.03, B.WAIST - 0.014, B.WAIST + 0.02, Z_CHEST, Z_SH, Z_NECK],
          [CL + 0.004, CL + 0.01, CL + 0.01, CL + 0.01, CL + 0.009, CL + 0.008], mat=rib)
    trunk(pc, [Z_NECK, Z_NECK + 0.013], [CL + 0.008, CL + 0.003], mat=lambda i, k: "M_Accent")
    sleeves(pc, *LONG_SLEEVE, mat=lambda i, k: "M_Accent" if i == 3 else None)
    chest_decal(pc, CL + 0.01, half=23, z0=0.36, z1=0.455)


@part("top_raincoat", "top", "Raincoat", with_decal({"M_Main": ("outfit", 6), "M_Trim": ("outfit", 14)}), decal=True)
def raincoat(pc):
    pc.region = "torso"
    rings = [[oval(l, 0.283, 0.157, 0.134) for l in R10]]
    rings += [[T(l, z, o) for l in R10] for z, o in ((B.WAIST, CL + 0.016), (Z_CHEST, CL + 0.014), (Z_SH, CL + 0.012),
                                                     (Z_NECK, CL + 0.01))]
    pc.band(rings)
    trunk(pc, [Z_NECK, Z_NECK + 0.022], [CL + 0.01, CL + 0.008])                                        # stand collar
    placket(pc, CL + 0.018, "M_Main", z0=0.29, z1=Z_NECK - 0.004, half=6)
    sleeves(pc, [X0 * 0.8, X0 + 0.03, 0.2, 0.258], [0.018, 0.016, 0.018, 0.024])
    for z in (0.315, 0.365, 0.415):
        stud(pc, 0, z, CL + 0.022, 0.009, "M_Trim")
    badge_decal(pc, CL + 0.014)


@part("outfit_silk_sweater", "top", "Silk sweater", with_decal({"M_Main": ("outfit", 13), "M_Accent": ("outfit", 0)}), decal=True,
      item="outfit-silk-sweater")
def silk_sweater(pc):
    """Loose V-neck sweater: ribbed hem, full sleeves gathered into ribbed cuffs."""
    zs = [B.WAIST - 0.03, B.WAIST - 0.016, B.WAIST + 0.02, 0.42, Z_SH, Z_NECK]
    offs = dict(zip(zs, [CL + 0.005, CL + 0.012, CL + 0.014, CL + 0.014, CL + 0.012, CL + 0.009]))
    open_front(pc, lambda l, z: T(l, z, offs[z]), zs, lambda z: 0.0 if z <= 0.42 else 30 * (z - 0.42) / (Z_NECK - 0.42),
               mat=lambda i, k: "M_Accent" if i == 0 else None)
    sleeves(pc, [X0 * 0.8, X0 + 0.03, X0 + B.ARM_LEN * 0.55, 0.24, 0.262], [0.013, CL + 0.006, CL + 0.014, CL + 0.012, CL + 0.002],
            mat=lambda i, k: "M_Accent" if i == 3 else None)
    chest_decal(pc, CL + 0.014, half=16, z0=0.345, z1=0.395)


# ================================================================ bottoms
SHORT_LEGS = ([B.HEM - 0.004, 0.25, B.CROTCH + 0.02], [CL + 0.004, CL, CL])


def skirt_rings(profile):
    """Waistband on the torso 10-gon (under any top's hem), then ovals: profile = [(z, rx, ry, pleat_in)]."""
    top = [r10_ring(B.WAIST + 0.006, CL), r10_ring(B.WAIST - 0.016, CL + 0.002)]
    return top + [[oval(l, z, rx * (1 - pin * (k % 2)), ry * (1 - pin * (k % 2))) for k, l in enumerate(L20)]
                  for z, rx, ry, pin in profile]


@part("bottom_pleated_skirt", "bottom", "Pleated skirt", {"M_Main": ("outfit", 11)}, sharp=25)
def pleated_skirt(pc):
    pc.region = "skirt"
    pc.band(skirt_rings([(0.28, 0.148, 0.123, 0.045), (0.19, 0.184, 0.162, 0.17)]))


@part("bottom_overall_shorts", "bottom", "Overall shorts", {"M_Main": ("outfit", 11), "M_Accent": ("outfit", 6)})
def overall_shorts(pc):
    seat(pc, B.WAIST, (CL + 0.004, CL + 0.008, CL + 0.012))
    legs(pc, *SHORT_LEGS[:1], [CL + 0.008, CL + 0.005, CL + 0.004])
    pc.region = "torso"
    bib = [-36, -18, 0, 18, 36]
    pc.band([[T(l, z, CL + 0.012) for l in bib] for z in (B.WAIST, 0.395, 0.448)], closed=False)
    for s in (1, -1):
        path = [(30, 0.448), (33, 0.49), (42, 0.522), (90, 0.532), (138, 0.522), (148, 0.49), (152, 0.42), (156, B.WAIST)]
        strip(pc, [T(s * l, z, CL + 0.013) for l, z in path], 0.024)
        stud(pc, s * 28, 0.44, CL + 0.016, 0.008, "M_Accent")


@part("bottom_long_skirt", "bottom", "Long skirt", {"M_Main": ("outfit", 15)}, sharp=40)
def long_skirt(pc):
    pc.region = "skirt"
    rings = skirt_rings([(0.27, 0.15, 0.126, 0), (0.16, 0.182, 0.157, 0)])
    rings.append([oval(l, 0.068 + 0.007 * (-1) ** (k // 2), 0.202, 0.176) for k, l in enumerate(L20)])
    pc.band(rings)


# ================================================================ one-pieces
@part("onepiece_sundress", "onepiece", "Sundress", {"M_Main": ("outfit", 9), "M_Accent": ("outfit", 1)}, hides=("top", "bottom"))
def sundress(pc):
    trunk(pc, [B.WAIST - 0.006, 0.4, 0.452], [CL + 0.001, CL, CL])
    pc.region = "skirt"
    pc.band([r10_ring(B.WAIST + 0.002, CL + 0.002)] +
            [[oval(l, z, rx, ry) for l in L20] for z, rx, ry in ((0.28, 0.149, 0.125), (0.21, 0.172, 0.15), (0.15, 0.192, 0.168))])
    pc.mat = "M_Accent"
    trunk(pc, [B.WAIST - 0.012, B.WAIST + 0.012], CL + 0.005)
    for s in (1, -1):
        strip(pc, [T(s * 170, B.WAIST + 0.004, CL + 0.009), T(s * 150, B.WAIST - 0.03, CL + 0.012)], 0.03)   # bow tails
    pc.mat = "M_Main"
    for s in (1, -1):
        path = [(30, 0.448), (36, 0.49), (46, 0.522), (90, 0.532), (134, 0.522), (144, 0.49), (150, 0.448)]
        strip(pc, [T(s * l, z, CL + 0.002) for l, z in path], 0.014)


P12 = [15 + 30 * k for k in range(12)]


def spot(pc, c, n, size, mat):
    """Small diamond patch at c facing n (upright), just over the cloth."""
    keep, pc.mat = pc.mat, mat
    u = Vector((0, 0, 1)).cross(n).normalized()
    vs = [pc.v(c + n * 0.003 + d) for d in (u * size, Vector((0, 0, size)), -u * size, Vector((0, 0, -size)))]
    pc.f(vs, c - n)
    pc.mat = keep


@part("outfit_monarch_cape", "onepiece", "Monarch cape", {"M_Main": ("outfit", 7), "M_Accent": ("outfit", 14), "M_Trim": ("outfit", 1)},
      sharp=34, grad=(0.72, 1.0), hides=("top", "bottom"), item="outfit-monarch-cape")
def monarch_cape(pc):
    """Orange cape to the hips over a short black skirt: a wing-lobed black border with white spots, black collar."""
    pc.mat, pc.region = "M_Accent", "skirt"
    pc.band([[oval(l, z, rx, ry) for l in P8] for z, rx, ry in ((0.33, 0.148, 0.128), (0.19, 0.184, 0.172))])
    pc.mat = "M_Main"                                             # wide cape sleeves with black cuffs, as the rain-cape's
    sleeves(pc, [X0 * 0.85, X0 + 0.05, 0.215, 0.256], [0.018, 0.022, 0.02, 0.014], mat=lambda i, k: "M_Accent" if i == 2 else None)
    pc.region = "skirt"
    prof =[(Z_NECK + 0.006, 0.105, 0.082), (Z_SH - 0.004, 0.152, 0.118), (0.4, 0.166, 0.144), (0.31, 0.192, 0.18)]
    pc.band([[oval(l, z, rx, ry) for l in P12] for z, rx, ry in prof])
    pc.mat = "M_Accent"
    edge = [oval(l, 0.31, 0.192, 0.18) for l in P12]
    lobes = [oval(l, 0.262 - 0.03 * (k % 2), 0.2, 0.19) for k, l in enumerate(P12)]
    pc.band([edge, lobes])
    for k in range(12):
        c = oval(30 * k, 0.286 - 0.012 * (k % 2), 0.197, 0.186)
        spot(pc, c, Vector((c.x, c.y, 0)).normalized(), 0.008, "M_Trim")
    trunk(pc, [Z_NECK - 0.004, Z_NECK + 0.014], [CL + 0.03, CL + 0.012])


@part("outfit_koi_kimono", "onepiece", "Koi kimono",
      {"M_Main": ("outfit", 11), "M_Accent": ("outfit", 0), "M_Trim": ("outfit", 7), "M_Gold": ("outfit", 6)},
      hides=("top", "bottom"), item="outfit-koi-kimono")
def koi_kimono(pc):
    """Straight wrap kimono to the ankles, blue like a pond: a V collar over a cream under-collar, deep boxy sleeves, a
    cream obi tied in a bow at the back, two golden koi and an orange one swimming round the skirt."""
    low = {0.06: (0.184, 0.16), 0.17: (0.176, 0.152), 0.28: (0.154, 0.132)}      # nearly straight; room for seated knees
    offs = {B.WAIST: CL + 0.012, Z_CHEST: CL + 0.012, Z_SH: CL + 0.011, Z_NECK: CL + 0.009}
    pt = lambda l, z: oval(l, z, *low[z]) if z in low else T(l, z, offs[z])
    e = lambda z: 0.0 if z <= 0.38 else 24 * ((z - 0.38) / (Z_NECK - 0.38)) ** 0.8
    pc.mat, pc.region = "M_Accent", "torso"
    pc.band([[T(l, z, CL) for l in (-26, -13, 0, 13, 26)] for z in (0.37, 0.42, Z_SH, Z_NECK)], closed=False)
    pc.mat = "M_Main"
    open_front(pc, pt, [0.06, 0.17, 0.28, B.WAIST, Z_CHEST, Z_SH, Z_NECK], e, n=8, region="skirt")
    pc.mat = "M_Accent"
    for s in (1, -1):
        strip(pc, [T(s * (e(z) + 3), z, CL + 0.014) for z in (Z_NECK - 0.002, 0.45, 0.39)], 0.016)
    trunk(pc, [0.3, 0.362], CL + 0.018)
    pc.blob(T(180, 0.335, CL + 0.036), (0.056, 0.022, 0.03), segs=6, rings=3)
    pc.mat = "M_Main"
    for sx, s in SIDES:                                           # deep front-to-back, so they hang square at the sides
        pc.region = f"arm_{s}"
        pc.band([[B.arm_pt(sx, x, l, o + d * abs(math.sin(math.radians(l)))) for l in R8]
                 for x, o, d in ((X0 * 0.8, 0.02, 0.0), (X0 + 0.03, 0.024, 0.012), (0.2, 0.03, 0.04), (0.245, 0.032, 0.046))])
    pc.region = "skirt"
    for lon, z, mat, head in ((32, 0.15, "M_Gold", 1), (-44, 0.225, "M_Trim", -1), (196, 0.13, "M_Gold", -1)):
        rx, ry = (0.179, 0.155) if z < 0.17 else (0.165, 0.142)
        c = oval(lon, z, rx, ry)
        n = Vector((c.x / rx ** 2, c.y / ry ** 2, 0)).normalized()
        t = Vector((0, 0, 1)).cross(n).normalized() * head
        up = Vector((0, 0, 1))
        c = c + n * 0.004
        nose, top, joint, bot = c + t * 0.05, c + up * 0.02 - t * 0.004, c - t * 0.03, c - up * 0.018 - t * 0.004
        tail_a, tail_b = c - t * 0.058 + up * 0.022, c - t * 0.058 - up * 0.018
        pc.mat = mat
        vs = [pc.v(p) for p in (nose, top, joint, bot, tail_a, tail_b)]
        pc.f(vs[:4], c - n)
        pc.f([vs[2], vs[4], vs[5]], c - n)
    pc.mat = "M_Main"


# ================================================================ clothing-v2: universal garments
# David, 2026-10-26: one universal model per garment type, every design paint on it; nothing pokes through. Each model
# is a shell on the body's own rings (body_shape) with its rings where the skin has its own (arms 0.076/0.138/0.199/
# 0.263, legs 0.289/0.17/0.09/0.035) and none between two of them across a joint (it would sink into the skin as the
# joint bends), so it bends as the skin does. fit() then gives every
# vertex the weights of the nearest body point on its own side (a trouser leg never takes the other thigh's) and the
# shared design layout (design_uv). The skin a model covers through every clip is cut away in the engine
# (hidden_cut.py bodycut: `_BODYCUT`, bit `bodyCut`). Budgets: at or under each garment's old triangles.

SIDE_OF = {"L": "Left", "R": "Right"}


def _side(w):
    l, r = any(b.startswith("Left") for b in w), any(b.startswith("Right") for b in w)
    return "L" if l and not r else "R" if r and not l else None


def _trees():
    pos, tris, wts = BODY
    out = {}
    for side in ("L", "R", None):
        other = {"L": "Right", "R": "Left"}.get(side)
        keep = [t for t in tris if not other or not any(b.startswith(other) for i in t for b in wts[i])]
        out[side] = (BVHTree.FromPolygons(pos, keep, all_triangles=True), keep)
    return out


TREES = _trees()


def transfer_weights(ob):
    """Every vertex takes the body's weights at the nearest body point on its own side (from its region weights:
    Left*/Right* bones), interpolated over that triangle; the four largest kept, normalised."""
    pos, _, wts = BODY
    names = [g.name.replace(kit.BONE, "") for g in ob.vertex_groups]
    new = []
    for v in ob.data.vertices:
        side = _side({names[g.group]: g.weight for g in v.groups if g.weight > 1e-4})
        tree, keep = TREES[side]
        loc, _, idx, _ = tree.find_nearest(v.co)
        a, b_, c = (pos[i] for i in keep[idx])
        bary = _bary(loc, a, b_, c)
        w = {}
        for k, i in enumerate(keep[idx]):
            for bn, x in wts[i].items():
                w[bn] = w.get(bn, 0.0) + x * bary[k]
        top = sorted(w.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(x for _, x in top)
        new.append({bn: x / tot for bn, x in top if x / tot > 1e-3})
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    groups = {}
    for vi, w in enumerate(new):
        for bn, x in w.items():
            if bn not in groups:
                groups[bn] = ob.vertex_groups.new(name=kit.BONE + bn)
            groups[bn].add([vi], x, "REPLACE")


def _bary(p, a, b_, c):
    v0, v1, v2 = b_ - a, c - a, p - a
    d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-12:
        return (1.0, 0.0, 0.0)
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    return (1 - v - w, v, w)


# ---------------------------------------------------------------- the design layout (image space: u right, v down)
# Tops: the torso round the body (u 0 = back centre, 0.5 = front centre, toward the character's left), v by height from
# DZ_TOP (0) to DZ_BOT (TORSO_V); each sleeve below it (the character's right in u 0..0.5, left 0.5..1), round the arm
# (the seam underneath) and down it from DX_ARM[0] (TORSO_V) to DX_ARM[1] (1). Bottoms: the hips as the torso; each leg
# (right 0..0.5, left 0.5..1) round it (the seam behind) and down it, v = 1 - z / DZ_HIP. Shoes: each foot (right, left)
# round it (the seam under the sole) and along it from the heel. One layout per family, so a design fits every model in it.
DZ_TOP, DZ_BOT, TORSO_V = 0.56, 0.24, 0.625
DX_ARM = (0.07, 0.29)
DZ_HIP = 0.36
DY_FOOT = (0.075, -0.1)


def _ring_u(ang):
    """An angle in degrees (0 opposite the seam, which is at 180) to 0..1 round the ring: 0.5 opposite the seam."""
    return ((ang + 180.0) % 360.0) / 360.0


def design_uv(ob):
    """UVMap on every face: where its corners lie in the family's design layout (by region: the vertex's own bones)."""
    me = ob.data
    names = [g.name.replace(kit.BONE, "") for g in ob.vertex_groups]
    kind = []
    for v in me.vertices:
        bones = {names[g.group] for g in v.groups if g.weight > 1e-3}
        side = _side(bones)
        limb = next((k for k, bs in (("arm", ("Shoulder", "Arm", "ForeArm", "Hand")), ("foot", ("Foot", "ToeBase")),
                                      ("leg", ("UpLeg", "Leg"))) if side and any(b == SIDE_OF[side] + x for x in bs for b in bones)), None)
        kind.append((limb or "torso", side))
    uvl = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        uv = []
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            p = me.vertices[vi].co
            limb, side = kind[vi]
            half = 0.0 if side == "R" else 0.5
            if limb == "arm":
                r_dz = B._interp(B.ARM, abs(p.x))[1]
                u = half + 0.5 * _ring_u(math.degrees(math.atan2(-p.y, p.z - (B.ARM_Z - r_dz))))
                v = TORSO_V + (1 - TORSO_V) * min(1.0, max(0.0, (abs(p.x) - DX_ARM[0]) / (DX_ARM[1] - DX_ARM[0])))
            elif limb == "leg":
                lx = B.LEG_X if side == "L" else -B.LEG_X
                u = half + 0.5 * _ring_u(math.degrees(math.atan2(p.x - lx, -p.y)))
                v = min(1.0, max(0.0, 1 - p.z / DZ_HIP))
            elif limb == "foot":
                lx = B.LEG_X if side == "L" else -B.LEG_X
                u = half + 0.5 * _ring_u(math.degrees(math.atan2(p.x - lx, p.z - 0.03)))
                v = min(1.0, max(0.0, (DY_FOOT[0] - p.y) / (DY_FOOT[0] - DY_FOOT[1])))
            else:
                c = B.torso_at(min(max(p.z, B.TORSO[0][0].z), B.TORSO[-1][0].z), 0)[0]
                u = _ring_u(math.degrees(math.atan2(p.x, -(p.y - c.y))))
                top = (DZ_TOP, DZ_BOT, TORSO_V) if ob.name.startswith("top") else (DZ_HIP, 0.0, 1.0)
                v = top[2] * min(1.0, max(0.0, (top[0] - p.z) / (top[0] - top[1])))
            uv.append([u, v, half, limb != "torso"])
        # the seam: a corner on it (u at its island's edge) takes the side the rest of the face is on
        for c in uv:
            lo, hi = c[2] if c[3] else 0.0, (c[2] + 0.5) if c[3] else 1.0
            if min(c[0] - lo, hi - c[0]) < 1e-3:
                rest = [d[0] for d in uv if d is not c and min(d[0] - lo, hi - d[0]) >= 1e-3]
                if rest:
                    c[0] = hi if sum(rest) / len(rest) > (lo + hi) / 2 else lo
        # a face across the seam with no corner on it (the hood's middle column): its corners on the far side of the
        # seam go onto it, or the face would sweep the whole row of the design (the zip and the logo on the hood)
        isl = {(c[2], c[3]) for c in uv}
        if len(isl) == 1:
            lo, hi = (uv[0][2], uv[0][2] + 0.5) if uv[0][3] else (0.0, 1.0)
            mid = (lo + hi) / 2
            if max(c[0] for c in uv) - min(c[0] for c in uv) > (hi - lo) / 2:
                up = sum(c[0] > mid for c in uv) * 2 >= len(uv)
                for c in uv:
                    if (c[0] > mid) != up:
                        c[0] = hi if up else lo
        for li, c in zip(poly.loop_indices, uv):
            uvl.data[li].uv = (c[0], 1.0 - c[1])        # Blender's v runs up; glTF's (the design image's) down


def fit(ob, spec):
    """A universal model: the design layout from its region weights, then the body's own weights."""
    if spec["meta"].get("model"):
        design_uv(ob)
        transfer_weights(ob)


# ---------------------------------------------------------------- the designs: one atlas, a cell per design
# 2 x 2 cells of 512 px (a 1024 atlas): the TSI zip hoodie's logo needs ~570 texels a metre round the torso to read at
# the creator's close-up (256 px cells gave ~280)
DESIGN_GRID, DESIGN_CELL, DESIGN_GUTTER = 2, 512, 0.03125


def stripe_design(n=DESIGN_CELL, ss=4):
    """Navy stripes (palette outfit 12) round the torso and the sleeves, as the striped long-sleeve always had."""
    N = n * ss
    v = (np.mgrid[0:N, 0:N][0] + 0.5) / N
    torso = v < TORSO_V
    # torso: period 0.062 m of height, stripes from the chest up; sleeves: period 0.064 m along the arm
    zt = DZ_TOP - v / TORSO_V * (DZ_TOP - DZ_BOT)
    xa = DX_ARM[0] + (v - TORSO_V) / (1 - TORSO_V) * (DX_ARM[1] - DX_ARM[0])
    on = np.where(torso, (((zt - 0.358) / 0.062) % 1.0 < 0.5) & (zt > 0.334), ((xa - 0.152) / 0.064) % 1.0 < 0.5)
    a = on.astype(np.float32).reshape(n, ss, n, ss).mean(axis=(1, 3))
    out = np.zeros((n, n, 4), np.float32)
    out[..., :3] = [int(kit.PAL["outfit"][12][i:i + 2], 16) / 255 for i in (1, 3, 5)]
    out[..., 3] = a
    return out


# ---------------------------------------------------------------- the TSI zip hoodie (David's photo, 2026-10-27:
# specs/references/clothing/2026-10-27-tsi-zip-hoodie.png): washed navy, lighter up top, darker ribbing, a silver zip with a
# blue pull tab, slanted pocket welts, the TSI varsity patch on the wearer's left chest with "EST." and "24".
TSI_ZIP = {"wash": "#4D659E", "mid": "#33508A", "deep": "#1E3463", "rib": "#172750", "line": "#0E1836", "cream": "#EDE7D4",
           "outline": "#13213F", "zip": "#C9CED8", "tab": "#2F58D8"}
# glyphs as rects (x0, y0, x1, y1) in their own box, y down: the patch's varsity serifs, and a 3 x 5 type for "EST." and "24"
VARSITY = {"T": [(0, 0, 1, 0.2), (0.33, 0, 0.67, 1), (0.18, 0.85, 0.82, 1), (0, 0, 0.14, 0.34), (0.86, 0, 1, 0.34)],
           "S": [(0.12, 0, 0.88, 0.19), (0, 0.07, 0.3, 0.52), (0.12, 0.41, 0.88, 0.59), (0.7, 0.48, 1, 0.93),
                 (0.12, 0.81, 0.88, 1), (0.7, 0, 1, 0.3), (0, 0.7, 0.3, 1)],
           "I": [(0.3, 0, 0.7, 1), (0.06, 0, 0.94, 0.17), (0.06, 0.83, 0.94, 1)]}
SMALL = {"E": [(0, 0, 0.36, 1), (0, 0, 1, 0.2), (0, 0.4, 0.85, 0.6), (0, 0.8, 1, 1)],
         "S": [(0, 0, 1, 0.2), (0, 0, 0.36, 0.6), (0, 0.4, 1, 0.6), (0.64, 0.4, 1, 1), (0, 0.8, 1, 1)],
         "T": [(0, 0, 1, 0.2), (0.32, 0, 0.68, 1)], ".": [(0, 0.78, 1, 1)],
         "2": [(0, 0, 1, 0.2), (0.64, 0, 1, 0.6), (0, 0.4, 1, 0.6), (0, 0.4, 0.36, 1), (0, 0.8, 1, 1)],
         "4": [(0, 0, 0.36, 0.6), (0, 0.4, 1, 0.6), (0.64, 0, 1, 1)]}


def _hex(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def _ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _type(S, Z, text, font, s0, z_top, w, h, gap, grow=0.0, arch=None):
    """Mask of `text` set from (s0, z_top) on the garment (s m round from the front centre, z m up), glyphs w x h m;
    with `arch` (a radius, m) the glyphs sit on an arc over the text's centre, each turned to it (the patch's arch)."""
    m = np.zeros(S.shape, bool)
    mid = s0 + _width(text, w, gap) / 2
    x = s0
    for ch in text:
        gw = w * (0.4 if ch == "." else 1.0)
        dx = x + gw / 2 - mid
        ang = dx / arch if arch else 0.0
        px, pz = S - (x + gw / 2), Z - (z_top - h / 2 - (dx * dx / (2 * arch) if arch else 0.0))
        xl, zl = np.cos(ang) * px - np.sin(ang) * pz, np.sin(ang) * px + np.cos(ang) * pz
        for x0, y0, x1, y1 in font[ch]:
            m |= ((xl >= (x0 - 0.5) * gw - grow) & (xl <= (x1 - 0.5) * gw + grow) &
                  (zl <= (0.5 - y0) * h + grow) & (zl >= (0.5 - y1) * h - grow))
        x += gw + gap
    return m


def _width(text, w, gap):
    return sum(w * (0.4 if ch == "." else 1.0) for ch in text) + gap * (len(text) - 1)


def tsi_zip_design(n=DESIGN_CELL, ss=4):
    """The TSI zip hoodie on the tops layout, opaque: each torso texel placed by its arc length round the hoodie from
    the front centre (s, + toward the wearer's left) and its height, each sleeve texel by its distance along the arm and
    its angle round it, so the patch and the welts keep their shape on the curved front."""
    N = n * ss
    v, u = (np.mgrid[0:N, 0:N] + 0.5) / N
    C = {k: _hex(c) for k, c in TSI_ZIP.items()}
    out = np.zeros((N, N, 3))
    # torso: height from v; s from the angle round the hoodie's own ellipse (design_uv's, grown to the shell)
    rows = int(np.searchsorted(v[:, 0], TORSO_V))
    Z = DZ_TOP - v[:rows] / TORSO_V * (DZ_TOP - DZ_BOT)
    th = np.radians(u[:rows] * 360.0 - 180.0)
    ab = np.array([torso_at_ab(z) for z in Z[:, 0]])
    a, b = ab[:, :1], ab[:, 1:]
    r = 1.0 / np.sqrt((np.sin(th) / a) ** 2 + (np.cos(th) / b) ** 2)
    px, py = r * np.sin(th), r * np.cos(th)
    seg = np.hypot(np.diff(px, axis=1, prepend=px[:, :1]), np.diff(py, axis=1, prepend=py[:, :1]))
    S = np.cumsum(seg, axis=1)
    S -= S[:, N // 2 - 1:N // 2 + 1].mean(axis=1, keepdims=True)
    col = C["deep"] + (C["mid"] - C["deep"]) * _ss(0.31, 0.40, Z)[..., None]
    col += (C["wash"] - col) * _ss(0.40, 0.475, Z)[..., None]
    mottle = 0.05 * np.sin(3 * th + 1.3) * np.cos(40 * Z + 0.7) + 0.03 * np.sin(5 * th + 0.4) * np.sin(70 * Z + 2.1)
    col *= (1 + mottle)[..., None]
    rib = Z < 0.317                                                     # the hem band
    col[rib] = C["rib"] * (1 + 0.08 * np.sign(np.sin(2 * np.pi * S[rib] / 0.005)))[..., None]
    for side in (-1, 1):                                                # the slanted welt pockets, open toward the zip
        t = np.linspace(0, 1, 48)[:, None]
        p0, c0, p1 = np.array([side * 0.088, 0.388]), np.array([side * 0.114, 0.368]), np.array([side * 0.124, 0.330])
        curve = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * c0 + t ** 2 * p1
        box = (np.abs(S - side * 0.106) < 0.03) & (np.abs(Z - 0.359) < 0.04)
        d = np.min(np.hypot(S[box][:, None] - curve[:, 0], Z[box][:, None] - curve[:, 1]), axis=1)
        lip = np.min(np.hypot(S[box][:, None] - curve[:, 0] + side * 0.0024, Z[box][:, None] - curve[:, 1]), axis=1)
        cb = col[box]
        cb[lip < 0.0011] *= 1.18
        cb[d < 0.0012] = C["line"]
        col[box] = cb
    zip_ = (np.abs(S) < 0.0034) & (Z < 0.516)                          # the zip: tape, then silver teeth, hem to neck
    col[zip_] = C["line"]
    teeth = (np.abs(S) < 0.0019) & (Z < 0.516)
    col[teeth] = C["zip"] * (0.82 + 0.18 * (np.sin(2 * np.pi * Z[teeth] / 0.0024) > 0))[..., None]
    col[(np.abs(S) < 0.0032) & (Z > 0.497) & (Z < 0.512)] = C["zip"] * 1.06    # the slider
    col[(np.abs(S) < 0.0032) & (Z > 0.299) & (Z < 0.305)] = C["zip"]           # the stop
    col[(np.abs(S) < 0.0022) & (Z > 0.481) & (Z <= 0.497)] = C["tab"]            # the blue pull tab
    # the patch: TSI, cream with a dark outline, centred 0.082 m round to the wearer's left; EST. and 24 beside it
    lw, lh, lg, sc, zt = 0.0185, 0.03, 0.0035, 0.082, 0.462
    s0 = sc - _width("TSI", lw, lg) / 2
    col[_type(S, Z, "TSI", VARSITY, s0, zt, lw, lh, lg, grow=0.0024, arch=0.12)] = C["outline"]
    col[_type(S, Z, "TSI", VARSITY, s0, zt, lw, lh, lg, arch=0.12)] = C["cream"]
    tw, th_, tg = 0.0062, 0.0105, 0.0013
    tz = zt - lh * 0.62 + th_ / 2 - 0.002
    col[_type(S, Z, "EST.", SMALL, s0 - 0.004 - _width("EST.", tw, tg), tz, tw, th_, tg)] = C["cream"]
    col[_type(S, Z, "24", SMALL, s0 + _width("TSI", lw, lg) + 0.004, tz, tw, th_, tg)] = C["cream"]
    out[:rows] = col
    # sleeves: along the arm from DX_ARM[0], the angle round it from the top; faded on top and at the shoulder
    xa = DX_ARM[0] + (v[rows:] - TORSO_V) / (1 - TORSO_V) * (DX_ARM[1] - DX_ARM[0])
    phi = np.radians(((u[rows:] * 2) % 1.0) * 360.0 - 180.0)
    col = C["wash"] + (C["deep"] - C["wash"]) * _ss(0.09, 0.24, xa)[..., None]
    col += (C["wash"] - col) * (0.35 * (0.5 + 0.5 * np.cos(phi)))[..., None]
    col *= (1 + 0.04 * np.sin(2 * phi + 0.8) * np.cos(30 * xa))[..., None]
    cuff = xa > 0.243
    col[cuff] = C["rib"] * (1 + 0.08 * np.sign(np.sin(70 * phi[cuff])))[..., None]
    out[rows:] = col
    img = out.reshape(n, ss, n, ss, 3).mean(axis=(1, 3))
    return np.concatenate([np.clip(img, 0, 1), np.ones((n, n, 1))], axis=2).astype(np.float32)


def torso_at_ab(z, off=0.018):
    """The hoodie shell's ellipse half-axes at height z (x, y)."""
    _, a, b = B.torso_at(min(max(z, B.TORSO[0][0].z), B.TORSO[-1][0].z), off)
    return a, b


DESIGNS = {"stripe": stripe_design, "tsi_zip": tsi_zip_design}


def design_atlas():
    """designs.png: each design in its cell, the cell's edge pixels repeated into its gutter (no bleed at any mip)."""
    g, c = DESIGN_GRID, DESIGN_CELL
    out = np.zeros((g * c, g * c, 4), np.float32)
    pad = int(round(DESIGN_GUTTER * c))
    inner = c - 2 * pad
    cells = {}
    for k, (name, fn) in enumerate(DESIGNS.items()):
        img = fn(inner)
        img = np.pad(img, ((pad, pad), (pad, pad), (0, 0)), mode="edge")
        r, col = divmod(k, g)
        out[r * c:(r + 1) * c, col * c:(col + 1) * c] = img
        cells[name] = k
    kit.image("designs", out, os.path.join(HERE, "designs.png"))
    kit.update_catalog("designs", {"atlas": "outfits/designs.png", "grid": g, "gutter": DESIGN_GUTTER, "materials": ["M_Main"],
                                   "cells": cells})
    return cells


CELLS = design_atlas()


def uni(model, cut, budget, design=None):
    """A part on a universal model: its mesh, its bit in the skin's `_BODYCUT`, its design's cell."""
    return dict(model=model, bodyCut=cut, budget=budget, **({"design": CELLS[design]} if design else {}))


TOP_TORSO = [(0.320, 0.016), (0.362, 0.014), (0.405, 0.012), (Z_SH - 0.001, 0.011), (Z_NECK, 0.008)]


@part("top_tee", "top", "Base tee", {"M_Main": ("outfit", 0)}, **uni("top_tee", 0, 152))
def tee(pc):
    """Boxy tee to the hips, short straight sleeves flaring a little at the end."""
    trunk(pc, *zip(*TOP_TORSO))
    sleeves(pc, [X0 * 0.8, 0.138, 0.176], [0.014, 0.012, 0.016])


def hoodie_shell(pc):
    """The universal hoodie: a ribbed hem band, full sleeves gathered into cuffs, the hood down on the back."""
    trunk(pc, [0.300, 0.316, 0.362, 0.405, Z_SH - 0.001, Z_NECK], [0.013, 0.019, 0.020, 0.018, 0.016, 0.012])
    sleeves(pc, [X0 * 0.8, 0.138, 0.199, 0.243, 0.262], [0.017, 0.016, 0.016, 0.019, 0.010])
    hood_down(pc, 0.036)


@part("top_hoodie", "top", "Hoodie", {"M_Main": ("outfit", 11), "M_Accent": ("outfit", 1)}, **uni("top_hoodie", 2, 279))
def hoodie(pc):
    """Roomy pullover hoodie: the universal hoodie and its drawstrings."""
    hoodie_shell(pc)
    pc.mat = "M_Accent"
    for s in (-1, 1):
        strip(pc, [T(s * 13, Z_NECK - 0.004, 0.014), T(s * 14, 0.47, 0.022), T(s * 15, 0.452, 0.022)], 0.008)
    pc.mat = "M_Main"


@part("top_tsi_zip_hoodie", "top", "TSI zip hoodie", {"M_Main": ("fixed", TSI_ZIP["mid"])}, key="tsi-zip-hoodie",
      **uni("top_hoodie_zip", 8, 279, "tsi_zip"))
def tsi_zip_hoodie(pc):
    """David's TSI zip hoodie (2026-10-27): the universal hoodie without the pullover's drawstrings (same rings, so the
    same weights, and the same skin cut under its own bit, 8: one bit per model); its zip, pockets, ribbing, wash and logo are the tsi_zip design. Unpriced: its
    `key` is not in specs/wardrobe/batch2-pricing.json yet (David prices it), so it has no shop row."""
    hoodie_shell(pc)


@part("top_stripe_ls", "top", "Striped long-sleeve", {"M_Main": ("outfit", 1)}, **uni("top_longsleeve", 1, 256, "stripe"))
def longsleeve(pc):
    """Fitted long-sleeve to the hips, the hem turned in, a crew neck, sleeves to the wrist."""
    trunk(pc, [0.327] + [z for z, _ in TOP_TORSO] + [Z_NECK + 0.008], [0.009] + [o for _, o in TOP_TORSO] + [0.004])
    sleeves(pc, [X0 * 0.8, 0.138, 0.199, 0.255, 0.266], [0.014, 0.011, 0.011, 0.012, 0.008])


LEG_CAP = B.CROTCH + 0.04     # where the legs' top fans meet, inside the seat


def seat_rings(pc, top, mat=None):
    """The seat: closed under the crotch, on the skin's own rings, up to `top` [(z, off)] (the waistband)."""
    trunk(pc, [B.CROTCH - 0.012, B.CROTCH + 0.025] + [z for z, _ in top], [0.007, 0.007] + [o for _, o in top], mat=mat,
          caps=(Vector((0, 0, B.CROTCH - 0.034)), None))


@part("bottom_shorts", "bottom", "Base shorts", {"M_Main": ("outfit", 4)}, **uni("bottom_shorts", 3, 114))
def shorts(pc):
    """Shorts to mid-thigh, the legs closed at the top under the seat."""
    seat_rings(pc, [(B.WAIST + 0.004, 0.005)])
    legs(pc, [0.215, B.CROTCH + 0.02], [0.013, 0.008], top_cap=LEG_CAP)


@part("bottom_trousers", "bottom", "Long trousers", {"M_Main": ("outfit", 12)}, **uni("bottom_trousers", 4, 178))
def trousers(pc):
    """Straight trousers to the shoe. No ring at the knee: the skin has none there either, and a ring between two of
    the skin's would sink into the back of the knee as it bends."""
    seat_rings(pc, [(B.WAIST + 0.004, 0.005)])
    legs(pc, [0.052, 0.09, 0.17, B.CROTCH + 0.02], [0.015, 0.013, 0.011, 0.008], top_cap=LEG_CAP)


@part("bottom_joggers", "bottom", "Jogger pants", {"M_Main": ("outfit", 14), "M_Accent": ("outfit", 14)}, **uni("bottom_joggers", 5, 234))
def joggers(pc):
    """Soft joggers: an elastic waistband, roomy legs gathered into cuffs at the ankle."""
    seat_rings(pc, [(B.WAIST - 0.004, 0.008), (B.WAIST + 0.01, 0.005)], mat=lambda i, k: "M_Accent" if i == 2 else None)
    legs(pc, [0.046, 0.068, 0.09, 0.17, B.CROTCH + 0.02], [0.007, 0.008, 0.018, 0.011, 0.008],
         mat=lambda i, k: "M_Accent" if i == 0 else None, top_cap=LEG_CAP)


# ================================================================ shoes (own slot; both feet in one piece)
def shoe(pc, prof, heel, toe, open_top=(), sole=(2, 3, 4), top_mat=None):
    """prof: [(y, half-width, z top, z bottom)] along the foot; P8 quads: k=7 top, k=3 bottom, k=2/4 lower sides."""
    for sx, s in SIDES:
        pc.region = f"foot_{s}"
        lx = sx * B.LEG_X
        rings = []
        for y, hw, zt, zb in prof:
            zc, rb = (zt + zb) / 2, (zt - zb) / 2
            rings.append([Vector((lx + math.sin(math.radians(l)) * hw, y, zc + math.cos(math.radians(l)) * rb)) for l in P8])
        pc.band(rings, caps=(Vector((lx, *heel)), Vector((lx, *toe))),
                skip=lambda i, k: k == 7 and i in open_top,
                mat=lambda i, k: "M_Sole" if k in sole else (top_mat if (top_mat and k == 7) else None))


CHUNKY = [(0.056, 0.03, 0.05, 0.002), (0.03, 0.045, 0.066, -0.001), (-0.01, 0.05, 0.066, -0.001), (-0.05, 0.047, 0.057, -0.001),
          (-0.078, 0.036, 0.044, 0.0)]


@part("shoes_slipon", "shoes", "Yellow slip-ons (#18)", {"M_Main": ("outfit", 6), "M_Sole": ("fixed", kit.PAL["derived"]["shoe_sole"]),
                                                        "M_Sock": ("outfit", 1)}, **uni("shoes_slipon", 6, 216))
def slipon(pc):
    """The #18 slip-ons: chunky, open over the instep, white socks to above the ankle."""
    shoe(pc, CHUNKY, (0.066, 0.026), (-0.092, 0.018), open_top=(0, 1), sole=(3,))
    pc.mat = "M_Sock"
    legs(pc, [0.03, 0.058, 0.07], [0.006, 0.007, 0.010])
    pc.mat = "M_Main"


@part("shoes_sneakers", "shoes", "Sneakers", {"M_Main": ("outfit", 11), "M_Sole": ("outfit", 1), "M_Accent": ("outfit", 1)},
      **uni("shoes_sneakers", 7, 156))
def sneakers(pc):
    """Chunky sneakers: a white sole all round, the laces' strip over the instep."""
    shoe(pc, [(0.058, 0.032, 0.052, 0.0), (0.03, 0.046, 0.068, -0.001), (-0.012, 0.05, 0.066, -0.001), (-0.052, 0.048, 0.056, -0.001),
              (-0.082, 0.036, 0.04, 0.0)], (0.068, 0.028), (-0.096, 0.016), open_top=(0,), top_mat="M_Accent")


@part("shoes_boots", "shoes", "Boots", {"M_Main": ("outfit", 5), "M_Sole": ("outfit", 14), "M_Accent": ("outfit", 4)})
def boots(pc):
    shoe(pc, CHUNKY, (0.066, 0.026), (-0.094, 0.018), open_top=(0, 1))
    legs(pc, [0.04, 0.085, 0.116, 0.13], [0.016, 0.015, 0.017, 0.021], mat=lambda i, k: "M_Accent" if i == 2 else None)


@part("shoes_sandals", "shoes", "Sandals", {"M_Main": ("outfit", 4), "M_Sole": ("outfit", 5)})
def sandals(pc):
    outline = [(0, 0.058), (0.027, 0.05), (0.039, 0.02), (0.043, -0.02), (0.041, -0.056), (0.028, -0.08), (0, -0.09),
               (-0.028, -0.08), (-0.041, -0.056), (-0.043, -0.02), (-0.039, 0.02), (-0.027, 0.05)]
    for sx, s in SIDES:
        lx = sx * B.LEG_X
        pc.region, pc.mat = f"foot_{s}", "M_Sole"
        pc.band([[Vector((lx + x, y, z)) for x, y in outline] for z in (0.0, 0.01)],
                caps=(Vector((lx, -0.015, -0.002)), Vector((lx, -0.015, 0.012))))
        pc.mat = "M_Main"
        y, ra, rb, zc = -0.035, 0.0375 + 0.004, 0.0243 + 0.004, 0.0243        # toe strap over the forefoot
        arc = [(lx + math.sin(math.radians(a)) * ra, zc + math.cos(math.radians(a)) * rb) for a in range(-105, 106, 35)]
        pc.band([[Vector((x, y - 0.009, z)) for x, z in arc], [Vector((x, y + 0.009, z)) for x, z in arc]], closed=False,
                refs=[Vector((lx, y, zc))])
    legs(pc, [0.036, 0.05], [0.004, 0.004])


@part("shoes_loafers", "shoes", "Loafers", {"M_Main": ("outfit", 5), "M_Sole": ("outfit", 14), "M_Accent": ("outfit", 4)})
def loafers(pc):
    shoe(pc, [(0.056, 0.03, 0.046, 0.002), (0.03, 0.044, 0.059, -0.001), (-0.012, 0.048, 0.06, -0.001), (-0.052, 0.045, 0.05, -0.001),
              (-0.082, 0.032, 0.036, 0.0)], (0.064, 0.024), (-0.098, 0.015), open_top=(0,), top_mat=None)
    # penny strap across the instep
    for sx, s in SIDES:
        pc.region, pc.mat = f"foot_{s}", "M_Accent"
        lx = sx * B.LEG_X
        arc = [(lx + math.sin(math.radians(a)) * 0.05, 0.0295 + math.cos(math.radians(a)) * 0.0325) for a in range(-70, 71, 35)]
        pc.band([[Vector((x, -0.004, z)) for x, z in arc], [Vector((x, -0.02, z)) for x, z in arc]], closed=False,
                refs=[Vector((lx, -0.012, 0.03))])
    pc.mat = "M_Main"


@part("shoes_rainboots", "shoes", "Rain boots", {"M_Main": ("outfit", 7), "M_Sole": ("outfit", 14)})
def rainboots(pc):
    shoe(pc, [(0.058, 0.034, 0.052, 0.002), (0.03, 0.048, 0.068, -0.001), (-0.01, 0.052, 0.066, -0.001), (-0.05, 0.049, 0.058, -0.001),
              (-0.08, 0.038, 0.046, 0.0)], (0.068, 0.026), (-0.095, 0.02), open_top=(0, 1), sole=(3,))
    legs(pc, [0.04, 0.09, 0.128, 0.136], [0.019, 0.019, 0.022, 0.016])


# ================================================================ build + export
kit.build_parts(PARTS, rig, "outfits", "outfits", IMG, post=fit, only=ONLY)
print("OUTFITS_OK", len(PARTS))
