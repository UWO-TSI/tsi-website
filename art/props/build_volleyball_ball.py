"""The beach volleyball's ball (game/volleyball; David's reference specs/references/volleyball/beach-ball.png, 2026-10-30):
a classic inflatable beach ball. Six gores from pole to pole, red, white, blue, white, yellow, white; a clear valve cap
where they meet at the top, with its plug; a small white cap at the bottom; glossy vinyl, each gore puffed a little
between its welded seams.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_volleyball_ball.py [-- review <dir>]

Writes, in game units, radius 1, resting on its origin like every prop (the centre at y 1; the match centres it and
scales it to court.ts BALL_R and squashes it on a hit; the island's decorative balls are this low-poly, scaled), the
valve cap on +y:
  web/public/assets/game/props/beach-ball-hd.glb   the high-def ball (close-ups: the HUD's contact-point ball, a close
                                                   view): 60 segments round, the cap's lip and plug modelled.
  web/public/assets/game/props/beach-ball.glb      the low-poly ball (in play), retopologised from the high-def: the same
                                                   gores at 18 segments, shrink-wrapped onto its surface; one material.
  web/public/assets/game/volleyball/ball-icon.png  a 256 px render of the high-def, three-quarter, the cap in view
                                                   (transparent), for the HUD's contact-point widget.
Materials: M_Vinyl (the gores, their colours in COLOR_0, glossy) and, on the high-def, M_VinylCap (the clear cap).
"""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import propkit as K  # noqa: E402
from mathutils import Matrix  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
# The reference's gores (its photo's colours, lifted to albedo) and its caps. Listed with phi increasing, so seen from
# the side, left to right, they read as the reference: red, white, blue, white, yellow, white.
RED, BLUE, YELLOW, WHITE = "#c8200f", "#2f72d4", "#f7d14a", "#f4f1ec"
GORES = (BLUE, WHITE, RED, WHITE, YELLOW, WHITE)
CAP, BOTTOM = "#e3e9ee", "#f4f1ec"
TOP_CAP, BOT_CAP = 0.21, 0.11          # the caps' angular radii (rad): the valve cap about a fifth of the ball across
PINCH = 0.035                          # the seams sit this far in: each gore puffs out between them


def surface_r(theta, u):
    """The skin's radius at polar angle theta, `u` across a gore (0 and 1 the seams): puffed between the seams, the
    pinch fading toward the poles where the seams meet."""
    return 1.0 - PINCH * (1 - math.sin(math.pi * u)) ** 2 * math.sin(theta) ** 0.5


def at(theta, phi, r):
    return (r * math.sin(theta) * math.cos(phi), r * math.cos(theta), r * math.sin(theta) * math.sin(phi))


def ball(name, per_gore, rings, M, Mcap, top_profile, bottom_profile):
    """One closed skin: the gores' grid between the caps, then each cap as polar rings (angle, radius) to its pole."""
    k = K.Kit(name)
    n = 6 * per_gore
    phis = [math.tau * j / n for j in range(n)]
    us = [(j % per_gore) / per_gore for j in range(n)]
    thetas = [TOP_CAP + (math.pi - TOP_CAP - BOT_CAP) * i / rings for i in range(rings + 1)]
    grid = [[k.vert(at(t, phis[j], surface_r(t, us[j]))) for j in range(n)] for t in thetas]
    for i in range(rings):
        for j in range(n):
            j1 = (j + 1) % n
            q = [grid[i][j], grid[i][j1], grid[i + 1][j1], grid[i + 1][j]]
            uv = [(j / n, 1 - i / rings), ((j + 1) / n, 1 - i / rings), ((j + 1) / n, 1 - (i + 1) / rings), (j / n, 1 - (i + 1) / rings)]
            k.face(q, uv, M, GORES[j // per_gore])

    def cap(edge, profile, pole_sign, mat, col):
        """Rings inward from the gores' edge ring: each (angle from the pole, radius); the last angle 0 is the pole."""
        prev = edge
        for a, r in profile:
            th = a if pole_sign > 0 else math.pi - a
            if a == 0:
                p = k.vert((0, pole_sign * r, 0))
                for j in range(n):
                    j1 = (j + 1) % n
                    tri = [prev[j], prev[j1], p] if pole_sign > 0 else [prev[j1], prev[j], p]
                    k.face(tri, [(0, 0), (1, 0), (0.5, 1)], mat, col)
                return
            ring = [k.vert(at(th, phis[j], r)) for j in range(n)]
            for j in range(n):
                j1 = (j + 1) % n
                q = [prev[j], prev[j1], ring[j1], ring[j]] if pole_sign > 0 else [prev[j1], prev[j], ring[j], ring[j1]]
                k.face(q, [(0, 0), (1, 0), (1, 1), (0, 1)], mat, col)
            prev = ring
    cap(grid[0], top_profile, 1, Mcap, CAP)
    cap(grid[-1], bottom_profile, -1, M, BOTTOM)
    return k


# The valve cap (high-def): a welded lip proud of the skin, a shallow dish, the plug standing in the middle.
HD_TOP = [(TOP_CAP * 0.94, 1.012), (TOP_CAP * 0.86, 1.014), (TOP_CAP * 0.7, 1.006), (0.072, 1.004), (0.07, 1.03),
          (0.062, 1.042), (0.045, 1.047), (0.0, 1.048)]
HD_BOTTOM = [(BOT_CAP * 0.9, 1.008), (BOT_CAP * 0.6, 1.006), (0.0, 1.004)]
LP_TOP = [(0.0, 1.012)]
LP_BOTTOM = [(0.0, 1.004)]


def flip_inward_check(ob):
    """Normals out (finish recalculates them; a closed skin so this only reports)."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    nonman = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    print("MANIFOLD", ob.name, "non-manifold edges:", nonman)


def build():
    import bpy
    K.reset()
    vinyl = K.Mat("M_Vinyl", "#ffffff", rough=0.22)
    capm = K.Mat("M_VinylCap", "#ffffff", rough=0.12)
    hd = ball("beach-ball-hd", 10, 36, vinyl, capm, HD_TOP, HD_BOTTOM).finish(smooth_deg=60)
    # The low-poly: the same gores at a third of the segments, its points pulled onto the high-def's skin.
    lp = ball("beach-ball", 3, 7, vinyl, vinyl, LP_TOP, LP_BOTTOM).finish(smooth_deg=60)
    sw = lp.modifiers.new("onto-hd", "SHRINKWRAP")
    sw.target, sw.wrap_method = hd, "NEAREST_SURFACEPOINT"
    bpy.context.view_layer.objects.active = lp
    bpy.ops.object.modifier_apply(modifier="onto-hd")
    for o in (hd, lp):
        flip_inward_check(o)
        o.data.transform(Matrix.Translation(K.G(0, 1, 0)))     # rest on the sand: the origin under the ball
    K.export([hd], "game/props/beach-ball-hd.glb")
    K.export([lp], "game/props/beach-ball.glb")
    return hd, lp


def shot(obs, out, az, el, size, transparent=True, fill=1.0, bg=(0.96, 0.94, 0.9)):
    """A glossy-product render: key, fill and rim lights, a soft studio world for the reflections; framed on the
    objects' bounds (`fill`: the share of the frame the ball spans)."""
    import bpy
    from mathutils import Vector
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_EEVEE"
    except TypeError:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    try:
        sc.view_settings.view_transform = "Standard"
    except TypeError:
        pass
    sc.render.film_transparent = transparent
    if sc.world is None:
        w = bpy.data.worlds.new("W")
        sc.world = w
        w.use_nodes = True
        node = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
        node.inputs[0].default_value = (*bg, 1)
        node.inputs[1].default_value = 0.85
        for name, kind, energy, rot, size_ in (("Key", "AREA", 260, (55, 0, -40), 2.5), ("Fill", "AREA", 90, (70, 0, 130), 4.0),
                                               ("Rim", "AREA", 160, (-60, 0, 20), 2.0)):
            li = bpy.data.lights.new(name, kind)
            li.energy, li.size = energy, size_
            lo = bpy.data.objects.new(name, li)
            sc.collection.objects.link(lo)
            r = [math.radians(v) for v in rot]
            lo.rotation_euler = r
            lo.location = lo.rotation_euler.to_matrix() @ Vector((0, 0, 6))
        cam = bpy.data.cameras.new("C")
        cam.lens = 85
        co = bpy.data.objects.new("C", cam)
        sc.collection.objects.link(co)
        sc.camera = co
    co = sc.camera
    fov = 2 * math.atan(18 / co.data.lens)
    d = 1.06 / math.sin(fov / 2) / fill
    a, e = math.radians(az), math.radians(el)
    gdir = Vector((math.sin(a) * math.cos(e), math.sin(e), -math.cos(a) * math.cos(e)))
    centre = K.G(0, 1, 0)
    co.location = centre + K.G(*gdir) * d
    co.rotation_euler = (centre - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.filepath = out
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.hide_render = o not in obs
    bpy.ops.render.render(write_still=True)
    print("SHOT", out)


if __name__ == "__main__":
    hd, lp = build()
    K.show_vertex_colors([hd, lp])
    icon = os.path.join(K.ROOT, "web", "public", "assets", "game", "volleyball", "ball-icon.png")
    os.makedirs(os.path.dirname(icon), exist_ok=True)
    shot([hd], icon, 205, 50, 256, fill=0.9)
    if "review" in ARGS:
        out = ARGS[ARGS.index("review") + 1]
        os.makedirs(out, exist_ok=True)
        shot([hd], os.path.join(out, "ball-hd.png"), 205, 50, 640, fill=0.86)
        shot([lp], os.path.join(out, "ball-lp.png"), 205, 50, 640, fill=0.86)
        shot([lp], os.path.join(out, "ball-lp-game.png"), 205, 20, 40, fill=0.86)
        shot([hd], os.path.join(out, "ball-hd-side.png"), 115, 4, 640, fill=0.86)
