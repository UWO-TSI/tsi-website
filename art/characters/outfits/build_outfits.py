"""Outfit library (deliverable 3): 8 tops, 6 bottoms, 4 one-pieces (+ the hood-up variant) and 6 shoes; pass 2: the
crafted silk sweater (top), monarch cape and koi kimono (one-pieces), `item` = their economy slug.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/outfits/build_outfits.py

Every piece is a shell on base/body_shape.py (the locked v6 torso/limb rings) at CL + ease over the skin and takes
the skin's own weights, so it deforms with the body; skirts and dresses blend the hips into both thighs. Each GLB is
the 22-bone CharacterRig + one skinned mesh (bind by bone name, like the hair). Materials are flat palette slots
(M_Main, M_Accent, M_Trim, M_Sole, M_Sock) tinted from palette.json at runtime; every top also carries M_Decal: a
small patch 4 mm over the chest/badge spot, UV 0..1, alpha-clipped, transparent by default (the TSI crewneck ships
with the TSI mark placeholder). Writes outfits/<slot>/<id>.glb, decal_tsi_mark.png and the "outfits" section of
../character_catalog.json.
"""
import bpy, math, os, sys
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import kit  # noqa: E402
from kit import Piece, body as B  # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
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


def legs(pc, zs, offs, lons=R8, mat=None):
    for sx, s in SIDES:
        pc.region = f"leg_{s}"
        pc.band([[B.leg_pt(sx, z, l, o) for l in lons] for z, o in zip(zs, offs)], mat=mat)


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
@part("top_tee", "top", "Base tee", with_decal({"M_Main": ("outfit", 0)}), decal=True)
def tee(pc):
    trunk(pc, [Z_TEE, B.WAIST + 0.02, Z_CHEST, Z_SH, Z_NECK], [CL + 0.004, CL, CL, CL, CL])
    sleeves(pc, [X0 * 0.8, X0 + 0.03, X0 + 0.058], [0.013, CL, 0.0118])
    chest_decal(pc, CL)


@part("top_hoodie", "top", "Hoodie", with_decal({"M_Main": ("outfit", 11), "M_Accent": ("outfit", 1)}), decal=True)
def hoodie(pc):
    trunk(pc, [B.WAIST - 0.03, B.WAIST - 0.016, B.WAIST + 0.02, Z_CHEST, Z_SH, Z_NECK],
          [CL + 0.004, CL + 0.012, CL + 0.012, CL + 0.012, CL + 0.01, CL + 0.008])
    sleeves(pc, *LONG_SLEEVE)
    hood_down(pc, CL + 0.03)
    pc.mat = "M_Accent"
    for s in (-1, 1):                                            # drawstrings
        strip(pc, [T(s * 13, Z_NECK - 0.004, CL + 0.012), T(s * 14, 0.47, CL + 0.014), T(s * 15, 0.452, CL + 0.014)], 0.008)
    pc.mat = "M_Main"
    chest_decal(pc, CL + 0.012, z0=0.365, z1=0.43)


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


@part("top_stripe_ls", "top", "Striped long-sleeve", with_decal({"M_Main": ("outfit", 1), "M_Stripe": ("outfit", 12)}), decal=True)
def striped(pc):
    zs = [Z_TEE, 0.358, 0.389, 0.42, 0.451, 0.482, Z_NECK]
    trunk(pc, zs, [CL + 0.004] + [CL + 0.002] * 6, mat=lambda i, k: "M_Stripe" if i % 2 == 1 else None)
    sleeves(pc, [X0 * 0.8, 0.152, 0.184, 0.216, 0.262], [0.013, CL + 0.002, CL + 0.002, CL + 0.002, CL + 0.002],
            mat=lambda i, k: "M_Stripe" if i % 2 == 1 else None)
    chest_decal(pc, CL + 0.002)


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


@part("bottom_shorts", "bottom", "Base shorts", {"M_Main": ("outfit", 4)})
def shorts(pc):
    seat(pc, B.WAIST)
    legs(pc, *SHORT_LEGS)


@part("bottom_trousers", "bottom", "Long trousers", {"M_Main": ("outfit", 12)})
def trousers(pc):
    seat(pc, B.WAIST, (CL + 0.002, CL + 0.002, CL))
    legs(pc, [0.045, 0.09, 0.14, 0.2, B.CROTCH + 0.02], [CL + 0.009, CL + 0.007, CL + 0.007, CL + 0.005, CL])


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


@part("bottom_joggers", "bottom", "Jogger pants", {"M_Main": ("outfit", 14), "M_Accent": ("outfit", 14)})
def joggers(pc):
    trunk(pc, [B.CROTCH - 0.012, B.CROTCH + 0.025, B.WAIST - 0.004, B.WAIST + 0.01], [CL + 0.005, CL + 0.009, CL + 0.008, CL + 0.005],
          mat=lambda i, k: "M_Accent" if i == 2 else None, caps=(Vector((0, 0, B.CROTCH - 0.036)), None))
    legs(pc, [0.04, 0.066, 0.076, 0.14, 0.2, B.CROTCH + 0.02], [CL + 0.003, CL + 0.004, CL + 0.015, CL + 0.015, CL + 0.011, CL + 0.004],
         mat=lambda i, k: "M_Accent" if i == 0 else None)
    pc.mat = "M_Accent"
    for s in (-1, 1):
        strip(pc, [T(s * 8, B.WAIST + 0.004, CL + 0.012), T(s * 10, B.WAIST - 0.03, CL + 0.013)], 0.007)
    pc.mat = "M_Main"


@part("bottom_long_skirt", "bottom", "Long skirt", {"M_Main": ("outfit", 15)}, sharp=40)
def long_skirt(pc):
    pc.region = "skirt"
    rings = skirt_rings([(0.27, 0.15, 0.126, 0), (0.16, 0.182, 0.157, 0)])
    rings.append([oval(l, 0.068 + 0.007 * (-1) ** (k // 2), 0.202, 0.176) for k, l in enumerate(L20)])
    pc.band(rings)


# ================================================================ one-pieces
HOOD_L = [0, 35, 70, 105, 140, 180, -140, -105, -70, -35, 0]
HOOD_ROWS = [-62, -25, 8, 34, 64]           # the face opening runs up to lat 34, so the brim sits on the bangs


def raincape(pc, hood_up):
    """#18 hooded rain-cape dress: a bell in eight big panels, wide sleeves, pink underskirt, hood up or down."""
    pc.region = "skirt"
    prof = [(Z_NECK + 0.006, 0.105, 0.082, 0.006), (Z_SH - 0.004, 0.148, 0.114, 0.004), (0.4, 0.157, 0.136, 0.0),
            (0.31, 0.163, 0.162, 0.0), (0.205, 0.198, 0.2, 0.0)]
    rings = [[oval(l, z, rx, ry, cy) for l in P8] for z, rx, ry, cy in prof]
    rings[-1] = [p + Vector((0, 0, 0.008 * (-1) ** k)) for k, p in enumerate(rings[-1])]
    pc.band(rings)
    pc.mat = "M_Accent"
    pc.band([[oval(l, z, rx, ry) for l in P8] for z, rx, ry in ((0.222, 0.172, 0.16), (0.186, 0.182, 0.17))])
    pc.mat = "M_Main"
    sleeves(pc, [X0 * 0.85, X0 + 0.05, 0.215, 0.256], [0.018, 0.022, 0.02, 0.014])
    if not hood_up:
        hood_down(pc, CL + 0.03)
        return
    pc.region = "hood"
    offs = (0.066, 0.078, 0.084, 0.086, 0.086)
    pc.patch(HOOD_L, lambda lon: HOOD_ROWS, lambda lat, lon, ri: offs[ri],
             skip=lambda i, r: max(abs(HOOD_L[i]), abs(HOOD_L[i + 1])) <= 70 and r < 3)
    # rim lip: the face opening's edge folds inward, so the hood reads thick like #18
    edge = [(r, 70) for r in HOOD_ROWS[:4]] + [(HOOD_ROWS[3], l) for l in (35, 0, -35)] + [(r, -70) for r in HOOD_ROWS[3::-1]]
    ri = {r: i for i, r in enumerate(HOOD_ROWS)}
    pc.band([[kit.hair_point(la, lo, offs[ri[la]]) for la, lo in edge], [kit.hair_point(la, lo, offs[ri[la]] - 0.022) for la, lo in edge]],
            closed=False, refs=[kit.HC + Vector((0, 0.3, 0))])
    top = [kit.hair_point(HOOD_ROWS[-1], l, offs[-1]) for l in HOOD_L[:-1]]
    apex = kit.hair_point(84, 180, 0.12)
    vs = [pc.v(p) for p in top]
    a = pc.v(apex)
    for k in range(len(vs)):
        pc.f([vs[k], vs[(k + 1) % len(vs)], a], kit.HC)
    trunk(pc, [Z_NECK - 0.006, Z_NECK + 0.024], [CL + 0.022, CL + 0.014], region="hood")


CAPE_MATS = {"M_Main": ("outfit", 10), "M_Accent": ("outfit", 8)}


@part("onepiece_raincape", "onepiece", "Hooded rain-cape dress (#18)", CAPE_MATS, sharp=34, grad=(0.72, 1.0), hides=("top", "bottom"))
def raincape_down(pc):
    raincape(pc, False)


@part("onepiece_raincape_hood", "onepiece", "Hooded rain-cape dress, hood up (#18)", CAPE_MATS, sharp=30, grad=(0.72, 1.0),
      hides=("top", "bottom"), hidesBackHair=True, variantOf="onepiece_raincape")
def raincape_up(pc):
    raincape(pc, True)


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


@part("onepiece_robe", "onepiece", "Robe", {"M_Main": ("outfit", 12), "M_Accent": ("outfit", 0), "M_Trim": ("outfit", 6)},
      hides=("top", "bottom"))
def robe(pc):
    low = {0.06: (0.2, 0.172), 0.17: (0.178, 0.152), 0.28: (0.152, 0.13)}
    offs = {B.WAIST: CL + 0.012, Z_CHEST: CL + 0.012, Z_SH: CL + 0.011, Z_NECK: CL + 0.009}
    pt = lambda l, z: oval(l, z, *low[z]) if z in low else T(l, z, offs[z])
    zs = [0.06, 0.17, 0.28, B.WAIST, Z_CHEST, Z_SH, Z_NECK]
    pc.mat, pc.region = "M_Accent", "torso"
    pc.band([[T(l, z, CL) for l in (-28, -14, 0, 14, 28)] for z in (0.37, 0.42, Z_SH, Z_NECK)], closed=False)
    pc.mat = "M_Main"
    open_front(pc, pt, zs, lambda z: 0.0 if z <= 0.37 else 26 * ((z - 0.37) / (Z_NECK - 0.37)) ** 0.8, region="skirt")
    pc.mat = "M_Trim"
    trunk(pc, [0.312, 0.35], CL + 0.017)
    pc.mat = "M_Main"
    sleeves(pc, [X0 * 0.8, X0 + 0.03, 0.2, 0.25], [0.02, 0.022, 0.032, 0.044])


@part("onepiece_jumpsuit", "onepiece", "Jumpsuit", {"M_Main": ("outfit", 3), "M_Accent": ("outfit", 5)}, hides=("top", "bottom"))
def jumpsuit(pc):
    trunk(pc, [B.WAIST - 0.012, Z_CHEST, Z_SH, Z_NECK], [CL + 0.006, CL + 0.006, CL + 0.005, CL + 0.004])
    seat(pc, B.WAIST - 0.012, (CL + 0.004, CL + 0.007, CL + 0.006))
    legs(pc, [0.045, 0.12, 0.2, B.CROTCH + 0.02], [CL + 0.01, CL + 0.008, CL + 0.007, CL + 0.002])
    sleeves(pc, [X0 * 0.8, X0 + 0.055], [0.014, CL + 0.004])
    pc.mat = "M_Accent"
    trunk(pc, [B.WAIST - 0.02, B.WAIST + 0.004], CL + 0.011)
    pc.mat, pc.region = "M_Main", "torso"
    lons = [14, 60, 100, 140, 180, 220, 260, 300, 346]
    pc.band([[T(l, Z_NECK + 0.004, CL + 0.004) for l in lons], [T(l, Z_NECK - 0.024, CL + 0.026) for l in lons]],
            closed=False, refs=[B.torso_at(Z_NECK, 0)[0]])


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
                                                        "M_Sock": ("outfit", 1)})
def slipon(pc):
    shoe(pc, CHUNKY, (0.066, 0.026), (-0.092, 0.018), open_top=(0, 1), sole=(3,))
    pc.mat = "M_Sock"
    legs(pc, [0.03, 0.058, 0.068], [0.006, 0.006, 0.011])
    pc.mat = "M_Main"


@part("shoes_sneakers", "shoes", "Sneakers", {"M_Main": ("outfit", 11), "M_Sole": ("outfit", 1), "M_Accent": ("outfit", 1)})
def sneakers(pc):
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
kit.build_parts(PARTS, rig, "outfits", "outfits", IMG)
print("OUTFITS_OK", len(PARTS))
