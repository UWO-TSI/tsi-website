"""The shared skull and its fit points (head fit, specs/characters/head-fit.md; ledger row 304).

Every hairstyle, hat and head accessory fits one skull: head_shape's v8 surface (the scalp shell), the shells laid
over it (where hair undersides, lock tops and hat insides go) and the named fit points below. A new piece is placed
and checked against these, never against another piece, so any hair fits every head and hats and accessories use the
same points (the Roblox lesson: one attachment per accessory type on the head, items authored around a reference
head cage, a bounding box per type; here the "cage" is the analytic skull and its offset shells).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/skull/skull.py      # writes skull/skull.json

Coordinates: (lat, lon) are skull rays (head_shape: lon 0 = the face, + toward the character's left, +X); positions are
Blender space (Z up, the face toward -Y) in this module and glTF space (Y up, the face toward +Z) in skull.json, the
part GLBs' space. A frame's z axis is the skull's outward normal, y runs up the surface, x = y cross z.
"""
import json, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "base"))
import head_shape as hs  # noqa: E402
from head_shape import HC, head_point, hair_point, hair_vol, hair_outer, hairline, INNER, SKULL, EYE_LAT, EYE_LON, MOUTH_LAT  # noqa: E402

VERSION = "v8"

# ---------------------------------------------------------------- shells over the scalp (metres above the skull)
HAT_CLEAR = 0.004           # a hat's inside sits this far over the hair's outer surface


def hat_in(lat):
    """Where a hat's inside goes: the hair's outer surface plus HAT_CLEAR."""
    return hair_outer(lat) + HAT_CLEAR


# ---------------------------------------------------------------- lines on the skull (lat as a function of lon)
def hatline(lon):
    """The standard hat line: where a hat's rim sits. Over the bangs' roll in front (lat 30, above the brows and the
    hairline's fringe), down to lat 8 at the back, so it always clears the ears. Hats may sit higher (a sun hat's crown)
    but never lower than EAR_TOP at the sides."""
    return 19 + 11 * math.cos(math.radians(lon))


def nape(lon):
    """The hairline at the back of the neck (lat): where the hair meets the neck under the back pieces."""
    return -36 + 8 * max(0.0, math.cos(math.radians(lon)))     # -36 at the back, rising toward the jaw


EAR_LAT = (EYE_LAT + MOUTH_LAT) / 2      # face thirds: the ear sits between the eye line and the mouth
EAR_LON = 92.0
EAR_R = 14.0                             # deg: the ear zone (glasses temples, headphones): a hat's rim stays above it
EAR_TOP = EAR_LAT + EAR_R

# ---------------------------------------------------------------- fit points
#   name: (lat, lon, off over the scalp, what fits there)
POINTS = {
    "top": (90.0, 0.0, 0.0, "the hair and hat attachment: top centre of the skull (Roblox's Hair/HatAttachment sit there)"),
    "crown": (72.0, 180.0, 0.0, "the crown whorl: back pieces root their locks round it; a back piece covers it"),
    "hairline_C": (hairline(0), 0.0, 0.0, "front of the hairline: bangs roll over it, back caps' front edge ends there"),
    "hairline_L": (hairline(36), 36.0, 0.0, "hairline over the left brow"),
    "hairline_R": (hairline(-36), -36.0, 0.0, "hairline over the right brow"),
    "temple_L": (hairline(62), 62.0, 0.0, "the left temple: the hairline turns down to the sideburn"),
    "temple_R": (hairline(-62), -62.0, 0.0, "the right temple"),
    "ear_L": (EAR_LAT, EAR_LON, 0.0, "left ear clearance centre: glasses temples rest here; hat rims stay above EAR_TOP"),
    "ear_R": (EAR_LAT, -EAR_LON, 0.0, "right ear clearance centre"),
    "nape": (nape(180), 180.0, 0.0, "the nape: where back hair meets the neck"),
    "hat_C": (hatline(0), 0.0, 0.0, "the hat line in front (hat rims sit on hat_in over it)"),
    "hat_B": (hatline(180), 180.0, 0.0, "the hat line at the back"),
    "face_front": (EYE_LAT, 0.0, 0.0, "the face plane between the eyes (Roblox's FaceFrontAttachment): glasses bridge"),
    "eye_L": (EYE_LAT, EYE_LON, 0.0, "the left eye centre (face canvas anchor): glasses lenses"),
    "eye_R": (EYE_LAT, -EYE_LON, 0.0, "the right eye centre"),
    "mouth": (MOUTH_LAT, 0.0, 0.0, "the mouth (face canvas anchor): masks, scarves stay below"),
    "neck": (-90.0, 0.0, 0.0, "under the chin, the head bone's base: neck pieces"),
}
# a piece that covers a fit point lies on the skull there: its underside within FLOAT_MAX of the scalp
COVERS = {
    "bangs": ("hairline_C",),
    "back": ("crown", "top"),
    "full": ("crown", "top", "hairline_C"),
    "hat": ("top", "crown"),      # rims sit on or above the hat line, so a hat covers the line's front only if it is low
}

# ---------------------------------------------------------------- clearances (the fit checker's limits, metres)
CLEARANCE = {
    "clip_max": 0.002,          # no outward-facing hair or hat surface more than this under the skin (roots excepted)
    "float_max": 0.006,         # at every fit point a piece covers, its underside within this of the scalp
    "gap_max": 0.004,           # air between scalp and hair anywhere the piece covers (fit_check hair_gap_max)
    "hat_gap_max": 0.010,       # air between a hat and the hair it sits on
    "hat_poke_max": 0.002,      # hair through a hat
    "ear_top_lat": round(EAR_TOP, 2),   # no hat rim below this at the sides
    # m from `top`: the box a piece of each type stays in (Roblox's per-type accessory bounds; catches a mis-scaled import)
    "reach": {"hair": {"up": 0.15, "down": 0.72, "front": 0.30, "back": 0.36, "side": 0.34},
              "hat": {"up": 0.16, "down": 0.36, "front": 0.42, "back": 0.42, "side": 0.42}},
}


def point(name):
    lat, lon, off, _ = POINTS[name]
    return hair_point(lat, lon, off) if off else head_point(lat, lon)


def normal(lat, lon):
    """Outward normal of the skull at (lat, lon), from neighbouring points."""
    e = 0.5
    la0, la1 = max(-89.5, lat - e), min(89.5, lat + e)
    if abs(lat) > 89:                     # the poles: straight up or down
        return Vector((0, 0, 1 if lat > 0 else -1))
    t1 = head_point(la1, lon) - head_point(la0, lon)
    t2 = head_point(lat, lon + e) - head_point(lat, lon - e)
    n = t2.cross(t1).normalized()
    p = head_point(lat, lon)
    return n if n.dot(p - HC) > 0 else -n


def frame(name):
    """4x4 Blender-space frame of a fit point: z out of the skull, y up the surface (toward the face at the poles)."""
    lat, lon, _, _ = POINTS[name]
    z = normal(lat, lon)
    up = Vector((0, 0, 1)) if abs(z.z) < 0.95 else Vector((0, -1, 0))
    y = (up - z * up.dot(z)).normalized()
    x = y.cross(z)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = point(name)
    return m


def to_gltf(v):
    return Vector((v.x, v.z, -v.y))


def gltf_frame(m):
    """A Blender-space frame as glTF position + quaternion (x, y, z, w)."""
    c = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))       # Blender -> glTF
    r = c @ m.to_3x3() @ c.transposed()
    q = r.to_quaternion()
    p = to_gltf(m.translation)
    return [round(x, 5) for x in p], [round(x, 6) for x in (q.x, q.y, q.z, q.w)]


def export(path=os.path.join(HERE, "skull.json")):
    anchors = {}
    for name, (lat, lon, off, use) in POINTS.items():
        p, q = gltf_frame(frame(name))
        anchors[name] = {"lat": round(lat, 3), "lon": round(lon, 3), "p": p, "q": q, "use": use}
    lons = list(range(-180, 181, 15))
    doc = {
        "version": VERSION,
        "note": "The shared skull (art/characters/skull/skull.py; specs/characters/head-fit.md). Every hair piece, hat and head "
                "accessory is fitted to this skull and its fit points, never to another piece. Positions and frames are "
                "glTF space (Y up, the face toward +Z), the part GLBs' space; a frame's z is the skull's outward normal.",
        "centre": [round(x, 5) for x in to_gltf(HC)],
        "skull": {k: round(v, 4) for k, v in SKULL.items()},
        "anchors": anchors,
        "lines": {
            "hairline": [[lo, round(hairline(lo), 2)] for lo in range(-60, 61, 15)],
            "hatline": [[lo, round(hatline(lo), 2)] for lo in lons],
            "nape": [[lo, round(nape(lo), 2)] for lo in lons if abs(lo) >= 90],
            "ear": {"lat": round(EAR_LAT, 2), "lon": EAR_LON, "radius_deg": EAR_R, "top_lat": round(EAR_TOP, 2)},
        },
        "shells": {
            "inner": INNER, "hat_clear": HAT_CLEAR,
            "hair_vol": [[la, round(hair_vol(la), 4)] for la in range(-60, 91, 15)],
            "hair_outer": [[la, round(hair_outer(la), 4)] for la in range(-60, 91, 15)],
        },
        "covers": {k: list(v) for k, v in COVERS.items()},
        "clearance": CLEARANCE,
    }
    json.dump(doc, open(path, "w"), indent=1)
    return doc


if __name__ == "__main__":
    d = export()
    print("SKULL_OK", d["version"], len(d["anchors"]), "anchors")
