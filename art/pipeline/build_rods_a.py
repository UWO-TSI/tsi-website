"""Rod rebuild, group A (2026-11-20): the Riptide, the Tempest, the Tidewarden and the Titanium rebuilt part by part
to their approved concepts (art/pipeline/concepts/old/<rod>/: hero.png, turnaround.png rod only, effects.png the
effect layer only), the way the Christmas rods were (build_rods.py north_star, candy_cane). David: "riptide effects
are crucial"; "tidewarden = original model plus the pearls, filigree and small details"; "titanium = match the
concept including details".

  Blender -b --factory-startup -P art/pipeline/build_rods_a.py -- [only riptide,tempest]

Uses build_rods.py's helpers and conventions (rig units, the grip's hand at the origin, Z up the rod, the reel toward
-Y, the camera side -X) without running its build. Each rod is measured off its turnaround's top row (the side view,
grip left, reel below): `at(x, y)` turns a point of that row (pixels) into the rod's space. Writes only the effect,
web/public/assets/game/props/rodfx-<name>.glb: the rods themselves are the Meshy models now (rod-meshy, rod-touchup),
fitted to these rods' frames, so their GLBs are never written here. Riptide's effect was since edited by
meshy_rods/fxedit.py: don't rebuild it. Review renders: compare_a.py (and compare_sheet.py).
"""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "build_rods.py")).read()
_head = _src.split("# ================================================================ build")[0]
_renders = _src.split("# ================================================================ renders")[1].split("\nFIXED = ")[0]
exec(compile(_head + "\n" + _renders, os.path.join(HERE, "build_rods.py"), "exec"), globals())   # noqa: S102


# ================================================================ shared
def sheet_space(x_hand, y_axis, px):
    """The turnaround's side view to the rod: x (pixels, right toward the tip) to Z, y (pixels, down) to -Y, so the
    reel below the rod hangs toward -Y. `px` rig metres per pixel."""
    at = lambda x, y=None: V((0.0, (y_axis - (y_axis if y is None else y)) * px, (x - x_hand) * px))
    return at, (lambda d: d * px)


def sweep(pc, rings, mat, closed=True, caps=(True, True)):
    """Faces between rings of points (each the same count, `closed` round), `mat(i, k)` naming each face's material;
    each face turned away from its rings' centre, the ends capped with a fan."""
    rv = [[pc.v(V(p)) for p in r] for r in rings]
    n = len(rings[0])
    cen = [sum((V(p) for p in r), V()) / n for r in rings]
    for i in range(len(rv) - 1):
        for k in range(n if closed else n - 1):
            j = (k + 1) % n
            pc.mat = mat(i, k)
            pc.f([rv[i][k], rv[i][j], rv[i + 1][j], rv[i + 1][k]], (cen[i] + cen[i + 1]) / 2)
    for e, (c, other) in enumerate(((0, 1), (-1, -2))):
        if caps[e]:
            pc.mat = mat(0 if c == 0 else len(rv) - 2, 0)
            hub = pc.v(cen[c])
            for k in range(n):
                pc.f([rv[c][k], rv[c][(k + 1) % n], hub], cen[other])
    return rv


def revolve(pc, c, prof, n=8, axis=(0, 0, 1), phase=0.0, mat=None):
    """lathe() with every face turned away from the solid's middle (its axis at the profile's mid height), so the flat
    rings of a drum face outward too. `prof` [(radius, height)], r=0 ends capped; `mat(band)` names a band's material."""
    c, a = V(c), V(axis).normalized()
    u = (V((1, 0, 0)) if abs(a.x) < 0.9 else V((0, 1, 0)))
    u = (u - a * u.dot(a)).normalized()
    w = a.cross(u)
    hs = [h for _, h in prof]
    mid = c + a * (min(hs) + max(hs)) / 2
    caps = [None, None]
    prof = list(prof)
    if prof[0][0] == 0:
        caps[0] = c + a * prof.pop(0)[1]
    if prof[-1][0] == 0:
        caps[1] = c + a * prof.pop()[1]
    rings = [[c + a * h + (u * math.cos(phase + TAU * k / n) + w * math.sin(phase + TAU * k / n)) * r for k in range(n)] for r, h in prof]
    keep = pc.mat
    rows = [[pc.v(p) for p in r] for r in rings]
    for i in range(len(rows) - 1):
        pc.mat = mat(i) if mat else keep
        for k in range(n):
            pc.f([rows[i][k], rows[i][(k + 1) % n], rows[i + 1][(k + 1) % n], rows[i + 1][k]], mid)
    for cap, row, e in ((caps[0], rows[0], 0), (caps[1], rows[-1], len(rows) - 2)):
        if cap is not None:
            pc.mat = mat(max(e, 0)) if mat else keep
            apex = pc.v(cap)
            for k in range(n):
                pc.f([row[k], row[(k + 1) % n], apex], mid)
    pc.mat = keep


def gem(pc, c, r, depth, normal, up=V((0, 0, 1)), n=4):
    """A cut gem set flat on a face: a rhombus (`n` corners, the first along `up`) raised to a point `depth` out."""
    c, normal, up = V(c), V(normal).normalized(), V(up)
    side = normal.cross(up).normalized()
    up = side.cross(normal).normalized()
    rim = [pc.v(c + (up * math.cos(TAU * k / n) + side * math.sin(TAU * k / n)) * r * (1.0 if k % 2 == 0 else 0.72)) for k in range(n)]
    top = pc.v(c + normal * depth)
    for k in range(n):
        pc.f([rim[k], rim[(k + 1) % n], top], c - normal)


def strip(pc, pts, widths, normal, ref):
    """A flat band through `pts` lying on a surface (`normal(p)` its normal there), `widths` across; its faces turned
    away from `ref(p)` (a point behind the surface)."""
    pts = [V(p) for p in pts]
    n = len(pts)
    edges = []
    for i, (p, w) in enumerate(zip(pts, widths)):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        side = t.cross(normal(p)).normalized() * w / 2
        edges.append((pc.v(p - side), pc.v(p + side)))
    for i in range(n - 1):
        pc.f([edges[i][0], edges[i][1], edges[i + 1][1], edges[i + 1][0]], ref((pts[i] + pts[i + 1]) / 2))


def spin_part(ob, axis):
    """Turn an effect part so its own up (the axis it spins about) lies along `axis` in the rod's space."""
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = V((0, 0, 1)).rotation_difference(V(axis).normalized())
    return ob


# ================================================================ the Riptide (rare)
def riptide():
    """Rare, the Riptide (its approved concept): a crystal point and a silver cap for the pommel, a sea-glass grip
    with white wave lines, a silver fore collar set with a gem, a navy blank, a teal crescent rising off it, a teal
    ribbon of water wound three times up the blank, standing up into foam-crested waves on top and hugging it under,
    tied on with a silver clasp, a silver arrow collar with a gem near the tip, and a breaking wave curling over the
    tip; a navy drum reel in a silver rim with three silver claws, a blue whirlpool on its faces and a crystal on a ring
    hanging under it. The effect (the library's Water type, effects.png): the ribbon and the wave's face running water
    with foam at their edges, the whirlpool on the reel turning in, foam breaking on the crests and the wave's crown,
    drops flung off it all, and a light trailing the crescent."""
    at, P = sheet_space(220, 88, 1.1 / 1112)
    R = lambda x: P(15.5 - 4.0 * (x - 268) / (1095 - 268))          # the blank's radius (18 px across at the collar)
    rc = at(273, 146)                                                # the reel's hub
    RO, RT = P(38), P(22)                                            # the reel's radius and half thickness

    # the ribbon: a thick band wound round and round the blank on a helix, over and under it, swelling up off it on
    # top (+Y) into a wave that stands up, its leading edge capped in white foam all the way
    def rib(x):
        a = math.pi / 2 + TAU * (x - 565) / 180                     # crests at x 565, 745, 925 (+Y is up the sheet)
        fade = min(1.0, max(0.0, (x - 400) / 90)) * min(1.0, max(0.0, (1010 - x) / 40))
        return a, max(0.0, math.sin(a)) ** 1.5 * fade
    RX = [380 + (1010 - 380) * i / 41 for i in range(42)]

    def rib_c(x):
        a, top = rib(x)
        d = V((math.cos(a), math.sin(a), 0))
        swell = ((1 + math.sin(a)) / 2) ** 2.5 if top > 0 else 0.0   # a round mound over the top, not a peak
        return at(x) + d * (R(x) + P(11) + P(22) * max(swell, top)), d, top

    def rib_sec(x):
        """The band at x: its trailing edge, middle, leading edge, and the normal of its face."""
        c, d, top = rib_c(x)
        t = (rib_c(x + 1.5)[0] - c).normalized()
        w = t.cross(d).normalized()
        if w.z < 0:
            w = -w
        wd = (w + d * 1.5 * top).normalized()
        hw = P(17)
        return c - wd * hw, c, c + wd * hw, t.cross(wd).normalized()

    WC = at(1150, 50)                            # the breaking wave's eye

    def curl(u):
        """The breaker at u (0 where it leaves the blank's end, 1 its lip): a log spiral round the eye, sweeping down
        under, up the far side and over the top, curling back in; its point, its thickness in the sheet's plane and
        across, and the direction out of the curl."""
        th = math.radians(218 + 400 * u)
        rho = P(62) * math.exp(-1.15 * u)
        rad = V((0, math.sin(th), math.cos(th)))
        return WC + rad * rho, P(16) * (1 - 0.75 * u) + P(2), P(30) * (1 - 0.6 * u) + P(3), rad

    def b(pc):
        pc.mat = "Gem"                           # the pommel's crystal point
        loft(pc, [at(36), at(50), at(58), at(68)], [P(1), P(14), P(16), P(10)], sides=6, tip=False, cap=False)
        pc.mat = "Silver"                        # its cap, flaring, faceted
        revolve(pc, at(65), [(P(10), 0), (P(20), P(6)), (P(20), P(20)), (P(17.5), P(30))], n=6, phase=math.pi / 6)
        pc.mat = "Teal"                          # the sea-glass grip
        revolve(pc, at(94), [(P(17.5), 0), (P(18.3), P(70)), (P(17.5), P(140))], n=8)
        pc.mat = "Foam"                          # its white wave lines, two crossing on each face
        for side in (-1, 1):
            for ph in (0.0, math.pi):
                pts = []
                for i in range(7):
                    u = i / 6
                    a = (math.pi if side < 0 else 0.0) + 0.75 * math.sin(math.pi * 1.4 * u + ph)
                    pts.append(at(104 + 124 * u) + V((math.cos(a), math.sin(a), 0)) * P(18.6))
                strip(pc, pts, [P(5) * math.sin(math.pi * (i + 0.5) / 7) ** 0.5 for i in range(7)],
                      lambda q: V((q.x, q.y, 0)).normalized(), lambda q: V((0, 0, q.z)))
        pc.mat = "Silver"                        # the fore collar
        revolve(pc, at(232), [(P(17.5), 0), (P(21), P(5)), (P(21), P(32)), (P(15), P(42))], n=6, phase=math.pi / 6)
        pc.mat = "Gem"
        for s in (-1, 1):
            gem(pc, at(252) + V((s * P(21), 0, 0)), P(6.5), P(2.5), (s, 0, 0))
        pc.mat = "Navy"                          # the blank
        loft(pc, [at(268 + (1095 - 268) * i / 7) for i in range(8)], [R(268 + (1095 - 268) * i / 7) for i in range(8)],
             sides=8, tip=False, cap=True)
        pc.mat = "Navy"                          # the reel's neck, down off the collar
        pc.tube([at(258, 94), at(262, 104), rc + V((0, RO - P(4), -P(4)))], [P(7), P(6), P(7)], sides=6, tip=False, cap=False)
        # the reel: a drum along X, silver flanges round a navy body, its faces navy with a silver boss
        prof = [(0.0, -RT - P(3)), (P(6), -RT - P(2)), (RO * 0.8, -RT), (RO, -RT + P(4)), (RO + P(1), -RT + P(9)),
                (RO + P(1), RT - P(9)), (RO, RT - P(4)), (RO * 0.8, RT), (P(6), RT + P(2)), (0.0, RT + P(3))]
        silver = {1, 2, 4, 5}
        revolve(pc, rc, prof, n=10, axis=(1, 0, 0), mat=lambda band: "Silver" if band in silver else "Navy")
        pc.mat = "Gem"                           # the whirlpool on each face: a spiral of light blue
        for s in (-1, 1):
            pts = [rc + V((s * (RT + P(1) + P(2) * (1 - i / 11)), math.cos(s * a) * rr, math.sin(s * a) * rr))
                   for a, rr in ((TAU * 1.6 * i / 11, P(3) + P(27) * i / 11) for i in range(12))]
            strip(pc, pts, [P(11) * (0.5 + 0.5 * i / 11) for i in range(12)], lambda q, s=s: V((s, 0, 0)), lambda q: rc)
        pc.mat = "Silver"                        # three claws round the rim, curling the way the water turns
        for a0 in (0.55, 2.65, 4.75):
            pts, rad = [], []
            for i in range(5):
                u = i / 4
                a = a0 + 0.95 * u
                rr = RO + P(1) + P(16) * u * u
                pts.append(rc + V((0, math.cos(a) * rr, math.sin(a) * rr)))
                rad.append((RT * 0.9 * (1 - 0.8 * u), P(7) * (1 - 0.85 * u)))
            loft(pc, pts, rad, sides=3, tip=True, cap=True, ref=(1, 0, 0))
        drop = rc + V((0, math.cos(4.25) * (RO + P(2)), math.sin(4.25) * (RO + P(2))))
        pc.tube([drop + V((0, -P(4) + math.cos(TAU * k / 4) * P(4), math.sin(TAU * k / 4) * P(4))) for k in range(4)], [P(1.3)] * 4, sides=3, closed_loop=True)
        pc.mat = "Gem"                           # the crystal hanging off it
        loft(pc, [drop + V((0, -P(8), 0)), drop + V((0, -P(19), 0)), drop + V((0, -P(40), 0))], [P(0.8), P(8), P(0.8)], sides=4, tip=False, cap=False, ref=(1, 0, 0))
        # the crescent rising off the blank, opening toward the tip
        cc, rings = at(346, 60), []
        for i in range(10):
            u = i / 9
            th = math.radians(262 - 233 * u)
            w = P(19) * math.sin(math.pi * u) ** 0.8 + P(1)
            o = cc + V((0, math.sin(th), math.cos(th))) * P(42)
            inn = cc + V((0, math.sin(th), math.cos(th))) * (P(42) - w)
            t = P(3.2) * (0.4 + 0.6 * math.sin(math.pi * u))
            rings.append([o + V((-t * 0.5, 0, 0)), inn + V((-t, 0, 0)), inn + V((t, 0, 0)), o + V((t * 0.5, 0, 0))])
        sweep(pc, rings, lambda i, k: "Teal")
        # the ribbon: a thick band, teal, its leading edge white, a lumpy roll of foam riding that edge, big on the crests
        rings = []
        for x in RX:
            p0, p1, p2, nrm = rib_sec(x)
            wd, hw = (p2 - p1).normalized(), (p2 - p1).length
            rings.append([p1 + wd * math.cos(TAU * k / 8) * hw + nrm * math.sin(TAU * k / 8) * P(5) for k in range(8)])
        tops = [rib(x)[1] for x in RX]
        sweep(pc, rings, lambda i, k: "Foam" if k in (0, 7) and tops[i] > 0.35 else "Teal")
        pc.mat = "Foam"                          # rolling mounds of foam riding each crest
        for xc in (565, 745, 925):
            for k in range(6):
                x = xc - 58 + 116 * k / 5
                p0, p1, p2, nrm = rib_sec(x)
                top = rib(x)[1]
                if top < 0.15:
                    continue
                pc.blob(p2 + (p2 - p1).normalized() * P(3), P(6 + 6 * top) * (0.8 + 0.25 * (k % 2)), segs=6, rings=4)
        pc.mat = "Silver"                        # the clasp tying the ribbon on
        revolve(pc, at(412), [(R(412) + P(3), 0), (R(412) + P(4), P(5)), (R(412) + P(3), P(11))], n=6)
        # the arrow collar near the tip: a long point back down the blank, deep below in a V, a gem on each face
        loft(pc, [at(1003), at(1040), at(1072, 90), at(1093, 89)], [(P(1), P(1)), (P(8), P(9)), (P(9.5), P(15)), (P(8), P(13))],
             sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.tube([at(1070, 95), at(1082, 108), at(1086, 112)], [P(6), P(3.5), P(0.5)], sides=4, tip=False, cap=True)
        pc.mat = "Gem"
        for s in (-1, 1):
            gem(pc, at(1062) + V((s * P(8.5), 0, 0)), P(5), P(2.2), (s, 0, 0))
        # the breaker over the tip: a teal curl growing out of the blank's end, white foam only on its lip, drops off it
        rings = []
        for i in range(19):
            c, t, dp, rad = curl(i / 18)
            rings.append([c + rad * t * math.cos(TAU * k / 8) * (1.15 if k in (0, 1, 7) else 1.0) + V((dp * math.sin(TAU * k / 8), 0, 0)) for k in range(8)])
        sweep(pc, rings, lambda i, k: "Foam" if i >= 14 or (i >= 10 and k in (0, 1, 7)) else "Teal")
        pc.mat = "Foam"
        for k, u in enumerate((0.8, 0.88, 0.95)):
            c, t, dp, rad = curl(u)
            pc.blob(c + rad * t * 0.9, P(9 - 2 * k), segs=6, rings=4)
        pc.mat = "Gem"                           # drops flung off the lip
        for k, (dy, dz) in enumerate(((22, 10), (34, -4), (14, 30), (40, 22))):
            pc.blob(curl(0.92)[0] + V((P(6) * (k % 2), P(dy), P(dz))), P(3.5 - 0.5 * (k % 2)), segs=5, rings=3)
        pc.mat = "Foam"                          # the line: the reel to the wave's hook
        pc.tube([rc + V((0, RO * 0.6, RO * 0.6)), at(700, 112), at(1100, 106)], [P(0.9)] * 3, sides=3, tip=False, cap=False)
    rod = model("rod-riptide", {"Navy": "#13305B", "Silver": "#B9BEC8", "Teal": "#79D3C6", "Foam": "#F4F8FA", "Gem": "#2C8FD8"}, b)
    for m in rod.data.materials:                 # the silver and the crystal a little glossy
        if m.name.endswith(("_Silver", "_Gem", "_Navy")):
            bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            bs.inputs["Roughness"].default_value = 0.4
            bs.inputs["Metallic"].default_value = 0.3 if m.name.endswith("_Silver") else 0.0

    # ---- the effect
    rings, cuts = [], []
    for side in (-1, 1):                         # the ribbon's water, a sheet on each face of the fin
        for x in RX:
            p0, p1, p2, nrm = rib_sec(x)
            off = nrm * side * P(7)
            rings.append([p0 + off, p0.lerp(p1, 0.5) + off, p1 + off, p1.lerp(p2, 0.5) + off, p2 + off + (p2 - p1).normalized() * P(2)])
        cuts.append(len(rings) - 1)
    for s in (-1, 1):                            # the breaker's face: water running up the curl to the lip
        for i in range(15):
            c, t, dp, rad = curl(i / 14 * 0.85)
            rings.append([c + rad * t * (j / 2 - 1) * 1.05 + V((s * (dp + P(1.5)), 0, 0)) for j in range(5)])
        cuts.append(len(rings) - 1)
    current = water("Current", "#3CB7C9", rings, cut=tuple(cuts[:-1]))
    wrings, wcuts = [], []
    for s in (-1, 1):                            # the whirlpool on each of the reel's faces, running in
        for i in range(16):
            u = i / 15
            a, rr, w = s * TAU * 1.5 * (1 - u), P(30) * (1 - u) + P(3), P(9) * (1 - 0.6 * u)
            d = V((0, math.cos(a), math.sin(a)))
            wrings.append([rc + V((s * (RT + P(4)), 0, 0)) + d * (rr - w / 2 + w * j / 4) for j in range(5)])
        wcuts.append(len(wrings) - 1)
    whirl = water("Whirl", "#2E86D8", wrings, cut=tuple(wcuts[:-1]))

    fv, ft, fd, fp, fc = [], [], [], [], []      # foam: a ragged blob on each crest, and the wave's crown and back
    blobs = []
    for n, xc in enumerate((565, 745, 925)):
        p0, p1, p2, nrm = rib_sec(xc + 10)
        blobs.append((p2 + (p2 - p1).normalized() * P(4), P(10), 0.7, n))
    for n, u in enumerate((0.82, 0.93)):         # and on the breaker's lip
        c, t, dp, rad = curl(u)
        blobs.append((c + rad * t, P(10), 1.0, n + 3))
    for c, r, crown, n in blobs:
        for s in (-1, 1):
            k0 = len(fv)
            fv.append(c + V((s * P(12), 0, 0)))
            fd.append(1.0)
            for j in range(10):
                ang = TAU * j / 10
                rch = r * (1.0 + 0.5 * (j % 3 == 0) + 0.2 * math.sin(3 * ang + n))
                fv.append(c + V((s * P(14), math.sin(ang) * rch * 0.75, math.cos(ang) * rch)))
                fd.append(0.0)
            for j in range(10):
                ft.append((k0, k0 + 1 + j, k0 + 1 + (j + 1) % 10))
            fp += [0.19 * n + 0.1] * 11
            fc += [crown] * 11
    crests = foam("Crests", "#F4FEFF", fv, ft, fd, fp, fc)

    drops = []                                   # drops: flung off the crests, round the crescent, off the wave
    for i in range(26):
        x = 330 + (1180 - 330) * ((i * 0.618) % 1)
        a = 1.3 + 2.1 * math.sin(i * 2.3)
        r = P(30 + 30 * ((i * 0.37) % 1))
        p = at(x) + V((math.cos(a) * r * 0.6, math.sin(a) * r, 0))
        drops.append((p, P(3.2 + 2.0 * ((i * 0.53) % 1)), (0.29 * i) % 1, 0.35 + 0.02 * i, i % 4 == 3))
    spray_ = spray("Drops", "#7FD8F2", drops)

    def swoosh(pc):                              # a light along the crescent's back, trailing down past the reel
        pc.mat = "Light"
        cc = at(346, 60)
        pts = [cc + V((0, math.sin(math.radians(a)), math.cos(math.radians(a)))) * P(47) for a in (35, 85, 135, 185, 235)]
        pts += [at(372, 112), at(430, 104)]
        pc.tube(pts, [P(1.2), P(2.6), P(3.4), P(3.4), P(2.6), P(1.6), P(0.4)], sides=4, tip=False, cap=True, up=V((1, 0, 0)))
    trail_ = light("Swoosh", "#8FE8FF", swoosh, pivot=tuple(at(346, 60)), pulse=0.12)
    fx = [current, whirl, crests, spray_, trail_]
    return rod, fx, {"rodFx": "riptide"}, particles("#BFF3FF", "glow", every=0.12, size=0.045, rise=0.2)


# ================================================================ the Tempest (epic)
def tempest():
    """Epic, the Tempest (its approved concept): an ice crystal point in two silver rings for the pommel, a charcoal
    grip bound in white rings, a silver collar, a silver horn curling back over the seat and silver wings sweeping
    along the chain; the blank a chain of faceted ice links, the links seen side on bent into chevrons that rise and
    fall like a bolt, the links between them lying flat, icicles hanging under it; at the tip a silver collar with a
    ring, silver crescents and ice blades fanned round a long crystal spear point; a blue storm-globe reel under the
    seat in a silver claw, a white cloud winding into it, a silver crank with a crystal knob. The effect (effects.png):
    lightning crackling the length of the chain and forking, the storm's eye glowing in the reel, a spark at the spear
    point, gusts of wind winding round it, an aura hugging the chain, ice glints drifting off."""
    at, P = sheet_space(225, 79, 1.15 / 1213)
    rc = at(282, 150)                            # the storm globe
    RG = P(50)
    def corner(j, k):
        """The bolt's corners (side view) in period j: k 0 top left, 1 top right, 2 bottom left, 3 bottom right."""
        return V(((375, 430, 470, 525)[k] + 165 * j, (46 + 2 * j) if k < 2 else (112 - 2 * j)))

    def bar(j, s_):
        """A bar of the bolt: up (s_ 1) over a top, or down (-1) under a bottom, from half way up the diagonal before it
        to half way down the one after, so each overlaps the next and they read as one bolt."""
        if s_ > 0:
            start = corner(j - 1, 3).lerp(corner(j, 0), 0.45) if j else V((330, 79))
            pts = [start, corner(j, 0), corner(j, 1), corner(j, 1).lerp(corner(j, 2), 0.6)]
        else:
            end = corner(j, 3).lerp(corner(j + 1, 0), 0.6) if j < 3 else V((990, 80))
            pts = [corner(j, 1).lerp(corner(j, 2), 0.35), corner(j, 2), corner(j, 3), end]
        return [at(p.x, p.y) for p in pts]

    def flat(x0, L=118.0, w=15.0):
        """A link lying flat (in the top view's plane), round the axis."""
        c = at(x0 + L / 2)
        return [c + V((dx, 0, dz)) for dx, dz in ((0, -P(L / 2)), (P(w), -P(L / 2 - 30)), (P(w), P(L / 2 - 30)), (0, P(L / 2)), (-P(w), P(L / 2 - 30)), (-P(w), -P(L / 2 - 30)))]

    def b(pc):
        pc.mat = "Ice"                           # the pommel's crystal point
        loft(pc, [at(18), at(36), at(46), at(58)], [P(1), P(12), P(13), P(9)], sides=6, tip=False, cap=False)
        pc.mat = "Silver"                        # its two rings, the grip's three, the collar
        for x0, x1, r in ((57, 68, 19.5), (70, 82, 19.5), (135, 150, 20.5), (200, 216, 20.5), (230, 262, 21.5)):
            revolve(pc, at(x0), [(P(r - 1.5), 0), (P(r), P(2)), (P(r), P(x1 - x0 - 2)), (P(r - 1.5), P(x1 - x0))], n=6)
        pc.mat = "Grip"                          # the dark wood grip
        revolve(pc, at(80), [(P(18), 0), (P(18.5), P(75)), (P(18), P(152))], n=8)
        pc.mat = "Deep"                          # the collar's blue band
        revolve(pc, at(243), [(P(22), 0), (P(22), P(6))], n=8)
        pc.mat = "Silver"                        # the horn curling back over the seat
        pts = [at(266, 72), at(258, 50), at(242, 34), at(222, 25)]
        loft(pc, pts, [(P(5), P(13)), (P(5), P(15)), (P(3.5), P(10)), (P(1), P(1.5))], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        for y0, y1, y2 in ((70, 56, 60), (88, 102, 98)):    # the wings along the chain's root, one over and one under
            pts = [at(262, y0), at(300, (y0 + y1) / 2), at(345, y1), at(388, y2)]
            loft(pc, pts, [(P(11), P(8)), (P(12), P(9)), (P(8), P(6)), (P(1), P(1))], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        # the chain: closed rectangular links of ice strung along the bolt, each through the last, turned a quarter
        # from it (seen side on, one open and the next edge on), so the chain itself zigzags
        path = [V((330, 79))] + [corner(j, k) for j in range(4) for k in range(4)] + [V((990, 80))]
        cum = [0.0]
        for p0, p1 in zip(path, path[1:]):
            cum.append(cum[-1] + (p1 - p0).length)

        def along(d):
            i = max(k for k in range(len(cum) - 1) if cum[k] <= d) if d < cum[-1] else len(cum) - 2
            return path[i].lerp(path[i + 1], min(1.0, (d - cum[i]) / max(cum[i + 1] - cum[i], 1e-6)))
        n_links = 15
        step = cum[-1] / n_links
        pc.mat = "Ice"
        for i in range(n_links):
            a2, b2 = along(i * step), along(min(cum[-1], i * step + step * 1.32))
            c0, c1 = at(a2.x, a2.y), at(b2.x, b2.y)
            t = (c1 - c0).normalized()
            w = t.cross(V((1, 0, 0))).normalized() if i % 2 == 0 else V((1, 0, 0))
            hw, hl = P(19 - 0.3 * i), (c1 - c0).length / 2
            m = (c0 + c1) / 2
            loop = [m + t * hl * x + w * hw * y for x, y in ((-1, -0.45), (-1, 0.45), (-0.55, 1), (0.55, 1), (1, 0.45), (1, -0.45), (0.55, -1), (-0.55, -1))][::1]
            loop = [loop[k] for k in (0, 1, 2, 3, 4, 5, 6, 7) if k not in (0, 4)]
            pc.tube(loop, [(P(8.5 - 0.2 * i), P(7.5 - 0.2 * i))] * 6, sides=4, closed_loop=True, up=t.cross(w).normalized())
        pc.mat = "Ice"                           # icicles under the falling links
        for j in range(4):                       # two or three off each falling bar's bottom, and one off each diagonal
            for dx, ln, y0 in ((-38, 26, 100), (2, 44, 120 - 2 * j), (22, 34, 120 - 2 * j), (48, 30, 112 - 2 * j)):
                x = 497 + 165 * j + dx
                if x > 985:
                    continue
                pc.tube([at(x, y0), at(x + 1, y0 + ln * 0.5), at(x + 2, y0 + ln)], [P(6), P(3.2), P(0.3)], sides=4, tip=False, cap=True)
        pc.mat = "Silver"                        # the tip: its collar, the ring under it, two crescents curling back
        revolve(pc, at(996), [(P(9), 0), (P(13), P(6)), (P(13), P(26)), (P(10), P(32))], n=8)
        pc.tube([at(1010, 98) + V((0, math.cos(TAU * k / 6) * P(7), math.sin(TAU * k / 6) * P(7))) for k in range(6)], [P(2)] * 6, sides=3, closed_loop=True)
        pts = [at(1010, 70), at(1020, 50), at(1036, 37), at(1052, 34)]
        loft(pc, pts, [(P(12), P(6)), (P(13), P(7)), (P(10), P(4)), (P(1), P(1))], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        pc.mat = "Ice"                           # the blades fanned round the spear's root, and the spear
        for (y0, x1, y1, w) in ((70, 1117, 30, 9), (96, 1097, 124, 7)):
            for s_ in (-1, 1):
                pts = [at(1030, y0) + V((s_ * P(4), 0, 0)), at((1030 + x1) / 2, (y0 + y1) / 2) + V((s_ * P(8), 0, 0)), at(x1, y1) + V((s_ * P(4), 0, 0))]
                loft(pc, pts, [(P(2.2), P(w)), (P(2), P(w * 0.8)), (P(0.5), P(0.5))], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        for s_ in (-1, 1):                       # and out to each side, as the top view's
            pts = [at(1035) + V((s_ * P(10), 0, 0)), at(1068) + V((s_ * P(26), 0, 0)), at(1100) + V((s_ * P(32), 0, 0))]
            loft(pc, pts, [(P(6), P(2)), (P(5), P(2)), (P(0.5), P(0.5))], sides=4, tip=True, cap=True, ref=(0, 1, 0))
        loft(pc, [at(1028), at(1090), at(1140), at(1275)], [P(10), P(24), P(30), P(1)], sides=4, tip=False, cap=True, phase=math.pi / 4)
        for d_ in (V((0, 1, 0)), V((0, -1, 0)), V((1, 0, 0)), V((-1, 0, 0))):   # its barbs, back and out from its widest
            root = at(1140) + d_ * P(22)
            loft(pc, [root, root + d_ * P(14) + V((0, 0, -P(10))), root + d_ * P(24) + V((0, 0, -P(34)))],
                 [(P(5), P(5)), (P(4), P(4)), (P(0.5), P(0.5))], sides=4, tip=False, cap=True, ref=tuple(d_.cross(V((0, 0, 1)))))
        # the storm globe: a sphere a little flattened along its axle, a silver claw over it, a white cloud winding in
        pc.mat = "Deep"                          # the storm globe: a blue core in a ring of white cloud puffs
        revolve(pc, rc, [(0.0, -RG * 0.55), (RG * 0.5, -RG * 0.45), (RG * 0.7, -RG * 0.15), (RG * 0.7, RG * 0.15), (RG * 0.5, RG * 0.45), (0.0, RG * 0.55)],
                n=10, axis=(1, 0, 0))
        pc.mat = "Ice"
        for s_ in (-1, 1):
            revolve(pc, rc + V((s_ * RG * 0.55, 0, 0)), [(P(13), 0), (P(8), s_ * P(3)), (0.0, s_ * P(4))], n=8, axis=(1, 0, 0))
        pc.mat = "Cloud"
        for k in range(10):
            a = TAU * k / 10 + 0.2
            rr = RG * (0.78 + 0.08 * (k % 2))
            pc.blob(rc + V((P(4) * ((k % 3) - 1), math.sin(a) * rr, math.cos(a) * rr)), (RG * 0.42, RG * (0.36 + 0.05 * (k % 2)), RG * (0.36 + 0.05 * (k % 2))), segs=7, rings=4)
        pc.mat = "Silver"
        pc.tube([at(262, 92), at(268, 104), rc + V((0, RG * 0.8, -P(4)))], [P(7), P(6), P(7)], sides=5, tip=False, cap=False)
        for s_ in (-1, 1):                       # the wing guard: a broad silver wing arching over the globe's top and back
            pts = [rc + V((s_ * RG * 0.55, math.sin(a) * RG * 1.22, math.cos(a) * RG * 1.22)) for a in (1.2, 0.5, -0.2, -0.9, -1.6, -2.3)]
            loft(pc, pts, [(P(3), P(9)), (P(3.5), P(13)), (P(3.5), P(14)), (P(3), P(11)), (P(2.5), P(7)), (P(1), P(1))], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        pc.mat = "Silver"                        # the crank, on the camera side, its crystal knob
        arm0 = rc + V((-RG * 0.62 - P(2), 0, 0))
        knob = at(210, 196) + V((-RG * 0.62 - P(8), 0, 0))
        pc.tube([arm0, arm0.lerp(knob, 0.5) + V((-P(4), 0, 0)), knob], [P(4), P(3.5), P(4)], sides=4, tip=False, cap=True)
        revolve(pc, knob + V((-P(2), 0, 0)), [(P(6), 0), (P(6.5), -P(12))], n=6, axis=(1, 0, 0))
        pc.mat = "Ice"
        revolve(pc, knob + V((-P(14), 0, 0)), [(P(6), 0), (0.0, -P(6))], n=6, axis=(1, 0, 0))
        pc.mat = "Cloud"                         # the line, the globe to the tip's ring
        pc.tube([rc + V((0, RG * 0.7, RG * 0.6)), at(700, 112), at(1010, 104)], [P(0.9)] * 3, sides=3, tip=False, cap=False)
    rod = model("rod-tempest", {"Grip": "#3B3346", "Silver": "#D5DCE6", "Ice": "#FFFFFF", "Deep": "#2E62C6", "Cloud": "#F2F5FA"}, b)
    me = rod.data                                # the ice lit from within: faces toward the light pale, their edges white
    col = me.color_attributes["Color"]
    names = [m.name.split("_")[-1] for m in me.materials]
    pale, white = kit.lin("#BFE0FF"), kit.lin("#FFFFFF")
    L = V((-0.5, 0.45, 0.75)).normalized()
    for poly in me.polygons:
        if names[poly.material_index] != "Ice":
            continue
        f = max(0.0, poly.normal.dot(L))
        for li in poly.loop_indices:
            g = col.data[li].color[0]
            base = [x + (y - x) * f * 0.75 for x, y in zip(kit.lin("#4C8EDD"), pale)]
            rgb = [x + (y - x) * f ** 6 * 0.7 for x, y in zip(base, white)]
            col.data[li].color = (rgb[0] * g, rgb[1] * g, rgb[2] * g, 1.0)
    for m in rod.data.materials:                 # the ice and the silver glossy
        if m.name.endswith(("_Ice", "_Silver", "_Deep")):
            bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            bs.inputs["Roughness"].default_value = 0.35
            bs.inputs["Metallic"].default_value = 0.25 if m.name.endswith("_Silver") else 0.0

    # ---- the effect
    tip = at(1282)

    def bolts(pc):                               # lightning the length of the chain, over it and under it, forking
        pc.mat = "Glow"
        for s_, ph in ((1, 0.0), (-1, 1.7)):
            pts = []
            for i in range(23):
                x = 300 + (1080 - 300) * i / 22
                jag = 16 * math.sin(i * 2.9 + ph) + 9 * math.sin(i * 5.3 + ph)
                pts.append(at(x, 79 - s_ * (26 + 0.6 * jag)) + V((P(8) * math.sin(i * 1.3 + ph), 0, 0)))
            pc.tube(pts, [P(1.6)] * len(pts), sides=3, tip=True, cap=True)
            for i in (4, 9, 15, 19):             # forks flicking off it
                f = pts[i]
                pc.tube([f, f + V((0, s_ * P(14), P(8))), f + V((P(3), s_ * P(20), P(22)))], [P(1.2), P(0.9), P(0.5)], sides=3, tip=True)
        for i in range(3):                       # and down into the globe
            x = 300 + 40 * i
            pc.tube([at(x, 60), at(x - 12, 100), at(x - 4, 115), rc + V((0, P(20), P(10 - 12 * i)))], [P(1.4)] * 4, sides=3, tip=True)

    def eye(pc):                                 # the storm's eye, glowing in the globe's face
        pc.mat = "Glow"
        for s_ in (-1, 1):
            pts = [rc + V((s_ * (RG * 0.62 + P(3)), math.sin(a) * rr, math.cos(a) * rr)) for a, rr in ((s_ * TAU * 1.3 * i / 9, P(2) + P(18) * i / 9) for i in range(10))]
            strip(pc, pts, [P(9) * (1 - 0.6 * i / 9) for i in range(10)], lambda q, s_=s_: V((s_, 0, 0)), lambda q: rc)
        for k in range(9):                       # ice shards flung out round the globe
            a = TAU * k / 9 + 0.3
            d = V((0.25 * math.sin(3 * k), math.sin(a), math.cos(a))).normalized()
            c0 = rc + d * (RG + P(8 + 6 * (k % 3)))
            side = d.cross(V((1, 0, 0))).normalized()
            pc.f([pc.v(c0), pc.v(c0 + d * P(9) + side * P(3)), pc.v(c0 + d * P(22)), pc.v(c0 + d * P(9) - side * P(3))], c0 + V((1, 0, 0)))

    def spark(pc):                               # the spark at the spear point: jagged points
        pc.mat = "Glow"
        for d in (V((0, 0, 1)), V((0, 0.8, 0.35)), V((0, -0.75, 0.25)), V((0.7, 0.2, 0.3)), V((-0.7, -0.1, 0.4))):
            d = d.normalized()
            side = d.cross(V((1, 0, 0)) if abs(d.x) < 0.5 else V((0, 1, 0))).normalized()
            pc.tube([tip, tip + d * P(18) + side * P(4), tip + d * P(40)], [P(6), P(4), 0.0], sides=3, tip=False)

    def gust(pc):                                # three gusts of wind round the rod, curving
        pc.mat = "Light"
        for k, (x0, r) in enumerate(((330, 85), (640, 78), (930, 70))):
            pts = []
            for i in range(7):
                a = 2.2 * k + 1.9 * i / 6
                pts.append(at(x0 + 70 * i / 6) + V((math.cos(a) * P(r), math.sin(a) * P(r), 0)))
            pc.tube(pts, [P(1), P(3), P(4.5), P(4.5), P(3.5), P(2), P(0.4)], sides=3, tip=False, cap=True)
    axis_ = [at(290)] + [at(330 + 90 * j) for j in range(9)] + [at(1150)]
    # the eye crackles with the bolts that run into it: one draw, so the effect stays at five a holder with the trail
    fx = [glow("Bolts", "#62D8FF", lambda pc: (bolts(pc), eye(pc)), flicker=1.0),
          glow("Spark", "#D8FAFF", spark, pivot=tuple(tip), pulse=0.16),
          light("Gust", "#B4DDFF", gust, pivot=tuple(at(600)), spin=1.6, **trail(P(6), (0, P(80), 0))),
          aura_hug("Aura", "#3C8CF0", axis_, [P(30)] * len(axis_), inflate=1.6)]
    return rod, fx, {"rodFx": "tempest"}, particles("#C9F6FF", "sparkle", every=0.07, size=0.06, rise=0.4)


# ================================================================ the Tidewarden (rare)
def tidewarden():
    """Rare, the Tidewarden (rod-5), rebuilt to its concept (David, via the coordinator 2026-11-20: the original's look
    with the concept's pearls, filigree and details, the nautilus reel included): a pearl pommel in gold leaves with a
    pearl and crystal drop, a pale mother-of-pearl shaft wound with two strands of gold filigree, a pearl wave cresting
    over the reel seat in a gold rim, a nautilus-shell reel of pearl ridged in gold with a teal spool and a pearl
    knob, a pearl and crystal drop behind it, gold guide rings under the shaft and pearls along it; the head a gold
    coral trident: gold leaves and a pearl petal at the neck, a gold setting with a teal diamond, crescent hooks over
    and under, two blue crystal prongs in gold sockets and pink coral branching between and round them. The effect:
    faint sea wisps of light round the head and along the line, glints drifting."""
    at, P = sheet_space(240, 75, 1.12 / 1145)
    R = P(12)                                    # the shaft
    rc = at(306, 140)                            # the reel

    def pearl(pc, c, r):
        pc.mat = "Pearl"
        pc.blob(c, r, segs=8 if r > P(9) else 6, rings=5 if r > P(9) else 4)

    def b(pc):
        pearl(pc, at(84), P(14))                 # the pommel: a pearl in gold leaves
        pc.mat = "Gold"
        revolve(pc, at(96), [(P(8), 0), (P(10), P(6)), (P(7), P(14)), (R, P(22))], n=8)
        for s_ in (-1, 1):                       # the leaves curling back over the pearl and forward up the shaft
            leaf(pc, at(104, 75 - s_ * 6), V((0, s_ * 0.75, -0.66)), P(40), P(17), side=V((1, 0, 0)), curl=0.0, lobes=(0.5, 1.0, 0.8, 0.35), thick=P(3), sides=4)
            leaf(pc, at(112, 75 - s_ * 6), V((0, s_ * 0.45, 0.9)), P(50), P(16), side=V((1, 0, 0)), curl=0.0, lobes=(0.4, 1.0, 0.7, 0.2), thick=P(3), sides=4)
        pc.mat = "Teal"                          # the teal leaf inlay on each face
        for s_ in (-1, 1):
            gem(pc, at(148) + V((s_ * (R + P(1)), 0, 0)), P(9), P(2), (s_, 0, 0))
        pc.mat = "Pearl"                         # the shaft
        loft(pc, [at(110), at(400), at(700), at(905)], [R * 1.05, R, R * 0.95, R * 0.9], sides=8, tip=False, cap=False)
        pc.mat = "Gold"                          # the filigree: a broad gold ribbon spiralling the shaft, two strands against it
        for ph, sg, w_, lift in ((0.0, 1, 12, 1.4), (2.1, -1, 6.5, 2.2), (4.2, -1, 6.5, 2.2)):
            pts = [at(160 + (880 - 160) * i / 25) + V((math.cos(ph + sg * TAU * 4.0 * i / 25), math.sin(ph + sg * TAU * 4.0 * i / 25), 0)) * (R + P(lift)) for i in range(26)]
            strip(pc, pts, [P(w_)] * 26, lambda q: V((q.x, q.y, 0)).normalized(), lambda q: V((0, 0, q.z)))
        for x in (160, 270, 880):                # gold rings
            revolve(pc, at(x - 4), [(R + P(1), 0), (R + P(2.5), P(4)), (R + P(1), P(8))], n=8)
        path = [at(262 + 150 * u, 75 - 4 - 32 * math.sin(math.pi * u ** 0.75) * (1 - 0.2 * u)) for u in (i / 8 for i in range(9))]
        pc.mat = "Pearl"                         # the pearl wave cresting over the seat, rimmed in gold along its top
        loft(pc, path, [(P(3.5), P(6) * math.sin(math.pi * (i + 0.6) / 9.2) + P(1)) for i in range(9)], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Gold"
        pc.tube([q + V((0, P(6.5) * math.sin(math.pi * (i + 0.6) / 9.2), 0)) for i, q in enumerate(path)][1:-1], [P(1.6)] * 7, sides=3, tip=False, cap=False)
        # the reel: a gold arm down off the seat, the nautilus shell on the camera side, its teal spool behind
        pc.mat = "Gold"
        pc.tube([at(282, 80), at(292, 100), rc + V((0, P(28), -P(6)))], [P(4.5), P(4), P(4.5)], sides=5, tip=False, cap=True)
        pc.mat = "Teal"                          # the spool behind the shell, peeking out toward the tip
        revolve(pc, rc + V((-P(4), 0, P(18))), [(0.0, 0), (P(26), 0), (P(28), P(3)), (P(28), P(24)), (P(26), P(27)), (0.0, P(27))], n=12, axis=(1, 0, 0))
        pc.mat = "Gold"
        for h in (0, P(27)):
            revolve(pc, rc + V((-P(4) + h, 0, P(18))), [(P(29.5), -P(1.5)), (P(29.5), P(1.5))], n=12, axis=(1, 0, 0))
        # the nautilus: a shell coiled in a log spiral on the camera side, each whorl swelling round the last to its
        # open mouth, banded pearl and gold
        pts, rad = [], []
        for i in range(20):
            th = 2.6 * math.pi * i / 19
            rho = P(4.5) * math.exp(0.235 * th)
            pts.append(rc + V((-P(16), math.sin(th + 1.0) * rho, math.cos(th + 1.0) * rho)))
            tr = rho * 0.55 + P(1.5)
            rad.append((tr * 1.05, tr))
        loft(pc, pts, rad, sides=7, tip=False, cap=True, ref=(1, 0, 0), mat=lambda i, k: "Gold" if i % 4 == 3 else "Pearl")
        pc.mat = "Gold"                          # the crank and its pearl knob
        knob = rc + V((-P(30), -P(36), P(78)))
        pc.tube([rc + V((-P(26), 0, P(16))), rc + V((-P(30), -P(14), P(48))), knob], [P(3.5)] * 3, sides=4, tip=False, cap=True)
        pearl(pc, knob + V((-P(4), -P(2), P(4))), P(9))
        for x, drop in ((84, 1), (256, 0)):      # the drops: pearls and a teal crystal, off the pommel and the seat
            y0 = 89 if drop else 82
            pc.mat = "Gold"
            pc.tube([at(x, y0), at(x, y0 + 8)], [P(1.4)] * 2, sides=3, tip=False, cap=False)
            for k, yy in enumerate((y0 + 14, y0 + 27) if not drop else (y0 + 15,)):
                pearl(pc, at(x, yy), P(6))
            yc = y0 + (36 if not drop else 24)
            pc.mat = "Teal"
            loft(pc, [at(x, yc), at(x, yc + 12), at(x, yc + 36)], [P(1), P(7), P(1)], sides=4, tip=False, cap=False, ref=(1, 0, 0))
        pc.mat = "Gold"                          # the guides
        for x in (450, 580, 700, 795):
            pc.tube([at(x, 85), at(x, 92)], [P(1.8)] * 2, sides=3, tip=False, cap=False)
            pc.tube([at(x + 7 * math.sin(TAU * k / 6), 99 - 7 * math.cos(TAU * k / 6)) for k in range(6)], [P(2.2)] * 6, sides=3, closed_loop=True)
        for x, y, r in ((445, 58, 6.5), (625, 55, 9), (775, 57, 8), (915, 60, 7.5), (1030, 68, 8)):
            pearl(pc, at(x, y), P(r))
        pc.mat = "Gold"
        pc.tube([at(775 + 12 * math.sin(TAU * k / 8), 57 - 12 * math.cos(TAU * k / 8)) for k in range(8)], [P(2)] * 8, sides=3, closed_loop=True)
        # ---- the head
        for s_ in (-1, 1):                       # gold leaves and a pearl petal at the neck
            leaf(pc, at(888, 75 - s_ * 5), V((0, s_ * 0.6, 0.8)), P(52), P(15), side=V((1, 0, 0)), curl=0.0, lobes=(0.5, 1.0, 0.8, 0.3), thick=P(5), sides=4)
        pc.mat = "Pearl"
        loft(pc, [at(895, 70), at(905, 50), at(920, 34), at(938, 26)], [(P(3), P(7)), (P(3), P(9)), (P(2.5), P(7)), (P(1), P(1))], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        pc.mat = "Gold"                          # the setting, a gold diamond plate
        loft(pc, [at(922), at(965), at(1008)], [(P(7), P(4)), (P(9), P(26)), (P(7), P(4))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        for s_ in (-1, 1):                       # gold scrolls curling off the setting, over and under
            leaf(pc, at(950, 75 - s_ * 18), V((0, s_ * 0.8, -0.6)), P(40), P(13), side=V((1, 0, 0)), curl=0.0, lobes=(0.6, 1.0, 0.8, 0.3), thick=P(5), sides=4)
            leaf(pc, at(985, 75 - s_ * 16), V((0, s_ * 0.9, 0.45)), P(44), P(12), side=V((1, 0, 0)), curl=0.0, lobes=(0.6, 1.0, 0.7, 0.25), thick=P(5), sides=4)
        pc.mat = "Teal"
        for s_ in (-1, 1):
            gem(pc, at(965) + V((s_ * P(9.2), 0, 0)), P(18), P(4.5), (s_, 0, 0))
        pc.mat = "Gold"                          # the arms forking to the prongs' sockets, and the crescents
        for y1 in (50, 100):
            loft(pc, [at(990), at(1020, (75 + y1) / 2), at(1050, y1), at(1066, y1)], [(P(7), P(8)), (P(7), P(8)), (P(8), P(10)), (P(8), P(11))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        loft(pc, [at(975, 56), at(990, 30), at(1015, 16), at(1032, 24)], [(P(6), P(9)), (P(6), P(9)), (P(4), P(6)), (P(1), P(1))], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        loft(pc, [at(985, 94), at(1005, 124), at(1034, 136), at(1046, 118)], [(P(6), P(9)), (P(6), P(10)), (P(4), P(6)), (P(1), P(1))], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        pc.mat = "Crystal"                       # the two crystal prongs
        for y1 in (50, 100):
            loft(pc, [at(1060, y1), at(1100, y1 - 1), at(1160, y1 - 2), at(1216, y1 - 3)], [(P(6), P(9)), (P(6), P(8.5)), (P(4.5), P(6)), (P(0.3), P(0.3))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Coral"                         # pink coral, over, between and under the prongs
        for root, tipp, twigs in ((at(950, 52), at(1125, 4), (0.25, 0.45, 0.65, 0.85)), (at(1045, 75), at(1130, 72), (0.4, 0.7)), (at(995, 98), at(1120, 132), (0.3, 0.55, 0.8))):
            mid = root.lerp(tipp, 0.5) + V((0, P(6), 0))
            pc.tube([root, mid, tipp], [P(8.5), P(7), P(2.8)], sides=4, tip=True, cap=True)
            for k, t_ in enumerate(twigs):
                p0 = root.lerp(mid, t_ * 2) if t_ < 0.5 else mid.lerp(tipp, (t_ - 0.5) * 2)
                up = V((0, 1 if k % 2 == 0 else -1, 0.7)).normalized()
                pc.tube([p0, p0 + up * P(22), p0 + up * P(36) + V((0, 0, P(8)))], [P(5.5), P(4.2), P(1.8)], sides=4, tip=True, cap=False)
                q0 = p0 + up * P(20)             # and each twig forks again
                pc.tube([q0, q0 + V((0, up.y * P(4), P(16)))], [P(3.5), P(1.4)], sides=3, tip=True, cap=False)
        pc.mat = "Teal"                          # the line, the spool to the lower prong's socket
        pc.tube([rc + V((0, P(28), P(16))), at(700, 86), at(1060, 102)], [P(1)] * 3, sides=3, tip=False, cap=False)
    rod = model("rod-5", {"Gold": "#C88B3C", "Pearl": "#F2ECF1", "Teal": "#10AFC4", "Crystal": "#FFFFFF", "Coral": "#F6D0C8"}, b, grad=(0.85, 1.0))
    me = rod.data                                # the crystal teal into blue along the prongs; the pearl's pastel sheen
    col = me.color_attributes["Color"]
    names = [m.name.split("_")[-1] for m in me.materials]
    pastel = [kit.lin(c) for c in ("#FFFFFF", "#F3E0F0", "#DFE6FB", "#DDF4EE")]
    shell = [kit.lin(c) for c in ("#FBF7F4", "#E9C7DF", "#F7EFF4", "#C9D4F2")]
    teal, blue = kit.lin("#0AB8D2"), kit.lin("#1574DC")
    z0, z1 = at(1060).z, at(1216).z
    for poly in me.polygons:
        n_ = names[poly.material_index]
        if n_ not in ("Crystal", "Pearl"):
            continue
        for li in poly.loop_indices:
            p = me.vertices[me.loops[li].vertex_index].co
            g = col.data[li].color[0]
            if n_ == "Crystal":
                u = min(1.0, max(0.0, (p.z - z0) / (z1 - z0)))
                rgb = [a_ + (b2 - a_) * u for a_, b2 in zip(teal, blue)]
            elif (p - rc).length < P(60) and p.x < rc.x - P(2):   # the shell: pastel bands spiralling out
                q = p - rc
                rho = max(math.hypot(q.y, q.z), P(2))
                k = (math.atan2(q.y, q.z) / TAU - math.log(rho / P(4)) / (0.32 * TAU)) * 4 % 4
                rgb = shell[int(k)]
            else:
                k = (math.atan2(p.y, p.x) / TAU * 4 + p.z * 25) % 4
                a_, b2 = pastel[int(k)], pastel[(int(k) + 1) % 4]
                rgb = [x + (y - x) * (k % 1) for x, y in zip(a_, b2)]
            col.data[li].color = (rgb[0] * g, rgb[1] * g, rgb[2] * g, 1.0)
    for m in me.materials:
        bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bs.inputs["Roughness"].default_value = {"Gold": 0.32, "Pearl": 0.28, "Crystal": 0.15}.get(m.name.split("_")[-1], 0.5)
        bs.inputs["Metallic"].default_value = 0.6 if m.name.endswith("_Gold") else 0.05

    def wisp(pc, pts, w):
        n = len(pts)
        strip(pc, pts, [w * math.sin(math.pi * (i + 0.5) / n) ** 0.7 for i in range(n)], lambda q: V((1, 0, 0)), lambda q: q + V((1, 0, 0)))

    def wisps(pc):                               # faint, curling past the prongs
        pc.mat = "Light"
        for y0, ph in ((40, 0.0), (112, 2.0)):
            wisp(pc, [at(1040 + 15 * i, y0 + 10 * math.sin(i * 0.8 + ph)) + V((P(10) * math.sin(i), 0, 0)) for i in range(12)], P(7))

    def drift(pc):                               # along the line
        pc.mat = "Light"
        wisp(pc, [at(420 + 50 * i, 92 + 6 * math.sin(i * 1.1)) + V((P(6), 0, 0)) for i in range(10)], P(5))
    fx = [light("Wisps", "#7FEADC", wisps, pivot=tuple(at(1120)), bob=0.006, rate=0.5),
          light("Drift", "#8FE4EC", drift, pivot=tuple(at(640)), bob=0.006, rate=0.7)]
    return rod, fx, {"rodFx": "tidewarden", "fxRoom": 0.04}, particles("#E4FFF8", "sparkle", every=0.2, size=0.035, rise=0.2)


# ================================================================ the Titanium (epic)
TI_A = {"Body": "#8E95A3", "Steel": "#646B77", "Dark": "#22262D", "Cyan": "#4FD2F0", "Spool": "#AFC2D2", "Line": "#E6ECF0"}


def titanium():
    """Epic, the Titanium (its approved concept; David: "match the concept including details"): polished titanium with
    a grazing rainbow film (build_rods.py metal: one P_Polished material). At the butt a two-pronged fork of faceted
    blades, a swept fin rising off its hinge, both with cyan slits; a machined receiver; the blank nine octagonal
    sections, each with a dark slot down its side, joined by hex collars set with a cyan band and four bolts,
    narrowing to a cone point with a ring for the line; under the receiver a reel of wound line along the rod, a
    cyan ring at its front, two curved claws round its back, a crank with a knob. The effect (effects.png): the cyan
    bands and slits glowing, the coil of line lit and turning, sparks crackling off the reel."""
    at, P = sheet_space(290, 70, 1.15 / 1187)
    COL = [330, 432, 540, 650, 760, 865, 978, 1080, 1147]          # the collars
    r_at = lambda x: P(25 - 7.5 * (x - 330) / (978 - 330)) if x <= 978 else P(17.5 - 6.0 * (x - 978) / (1147 - 978))
    rc = at(282, 156)                            # the reel's middle (its axle along the rod)
    Pr = lambda v: P(v * 1.55)                   # the reel drawn half as big again as measured

    def oct_(pc, x0, x1, r0, r1, phase=0.0):
        revolve(pc, at(x0), [(r0, 0), (r1, at(x1).z - at(x0).z)], n=6, phase=phase)

    def b(pc):
        # the fork: two faceted blades back from the hinge, the upper one deep, the lower one slim, a gap between
        pc.mat = "Body"
        loft(pc, [at(252, 58), at(150, 54), at(80, 60), at(10, 70)], [(P(14), P(31)), (P(13), P(27)), (P(10), P(15)), (P(0.5), P(0.5))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        loft(pc, [at(248, 108), at(150, 112), at(80, 112), at(10, 108)], [(P(13), P(22)), (P(12), P(20)), (P(9), P(11)), (P(0.5), P(0.5))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Dark"                          # the gap's dark web between them
        loft(pc, [at(250, 84), at(170, 86)], [(P(4), P(12)), (P(4), P(8))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Body"                          # the fin rising off the hinge, swept toward the tip
        loft(pc, [at(214, 52), at(250, 18), at(300, 0), at(385, -6)], [(P(10), P(22)), (P(10), P(18)), (P(7), P(11)), (P(0.5), P(0.5))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Steel"                         # the receiver, octagonal, and the hinge's pivot on each face
        oct_(pc, 225, 332, P(26), P(27))
        for s_ in (-1, 1):
            revolve(pc, at(236, 68) + V((s_ * P(17), 0, 0)), [(P(13), 0), (P(13), s_ * P(4)), (P(5), s_ * P(7)), (0.0, s_ * P(7))], n=8, axis=(1, 0, 0))
        pc.mat = "Cyan"                          # the cyan slits: on the fin, on the upper blade, on the receiver
        for s_ in (-1, 1):
            for p0, p1, y_ in ((at(238, 32), at(276, 15), 0), (at(100, 56), at(170, 53), 0), (at(100, 110), at(165, 111), 0), (at(272, 62), at(318, 62), 0)):
                strip(pc, [p0 + V((s_ * P(14.6 if p0.z < at(200).z else 10.6), 0, 0)), p1 + V((s_ * P(14.6 if p0.z < at(200).z else 10.6), 0, 0))] if p0.z < at(200).z or p0.y > at(0, 50).y else [p0 + V((s_ * P(26.3), 0, 0)), p1 + V((s_ * P(26.3), 0, 0))],
                      [P(3.5)] * 2, lambda q, s_=s_: V((s_, 0, 0)), lambda q: V((0, q.y, q.z)))
        # the blank: octagonal sections between hex collars
        for x0, x1 in zip(COL, COL[1:] + [1155]):
            pc.mat = "Body"
            oct_(pc, x0 + 6, x1 - 6, r_at(x0 + 6), r_at(x1 - 6))
            if x1 - x0 < 90 and x0 < 1140:       # the slim sections' cyan slots
                pc.mat = "Cyan"
                for s_ in (-1, 1):
                    rr = r_at((x0 + x1) / 2)
                    strip(pc, [at(x0 + 18, 70) + V((s_ * rr * 0.95, 0, 0)), at(x1 - 18, 70) + V((s_ * rr * 0.95, 0, 0))],
                          [P(3)] * 2, lambda q, s_=s_: V((s_, 0, 0)), lambda q: V((0, q.y, q.z)))
        for x in COL:                            # the collars: hex, a cyan band round the middle
            r = r_at(x) + P(4)
            pc.mat = "Steel"
            revolve(pc, at(x - 8), [(r - P(2), 0), (r, P(2.5)), (r, P(4.5))], n=6)
            revolve(pc, at(x + 3.5), [(r, 0), (r, P(2)), (r - P(2), P(4.5))], n=6)
            pc.mat = "Cyan"
            revolve(pc, at(x - 3.5), [(r + P(0.4), 0), (r + P(0.4), P(7))], n=6)
        pc.mat = "Steel"                         # the cone point and the ring for the line under the last collar
        revolve(pc, at(1153), [(P(7), 0), (P(6), P(8)), (0.0, P(80))], n=8)
        pc.tube([at(1147, 88) + V((0, math.cos(TAU * k / 6) * P(5), math.sin(TAU * k / 6) * P(5))) for k in range(6)], [P(1.5)] * 6, sides=3, closed_loop=True)
        # the reel: a spinning reel hung off a solid foot under the receiver, its body and spool along the rod: a
        # rounded housing at the back, a cyan ring, the wound spool, a lipped front, two curved claws guarding it
        pc.mat = "Body"
        loft(pc, [at(258, 84), at(264, 100), rc + V((0, Pr(24), -Pr(8)))], [(Pr(10), Pr(16)), (Pr(9), Pr(14)), (Pr(10), Pr(18))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        revolve(pc, rc, [(0.0, -Pr(50)), (Pr(14), -Pr(49)), (Pr(25), -Pr(42)), (Pr(29), -Pr(30)), (Pr(29), -Pr(6)), (Pr(25), -Pr(3))], n=12)
        pc.mat = "Cyan"
        revolve(pc, rc, [(Pr(29.4), -Pr(30)), (Pr(29.4), -Pr(22))], n=12)
        pc.mat = "Spool"
        revolve(pc, rc, [(Pr(25), -Pr(3)), (Pr(24), 0), (Pr(24), Pr(12)), (Pr(25), Pr(15))], n=12)
        pc.mat = "Body"
        revolve(pc, rc, [(Pr(25), Pr(15)), (Pr(30), Pr(17)), (Pr(30), Pr(24)), (Pr(16), Pr(28)), (Pr(8), Pr(34)), (0.0, Pr(36))], n=12)
        pc.mat = "Cyan"
        revolve(pc, rc + V((0, 0, Pr(29))), [(Pr(17), 0), (Pr(17), Pr(2))], n=10)
        pc.mat = "Body"
        for s_ in (1, -1):                       # the claw guard: two crescents curling out round the spool's front
            pts = [rc + V((0, s_ * Pr(28), -Pr(10))), rc + V((0, s_ * Pr(44), Pr(4))), rc + V((0, s_ * Pr(54), Pr(26))), rc + V((0, s_ * Pr(50), Pr(48))), rc + V((0, s_ * Pr(38), Pr(62))), rc + V((0, s_ * Pr(24), Pr(66)))]
            loft(pc, pts, [(Pr(4), Pr(8)), (Pr(4.5), Pr(12)), (Pr(5), Pr(15)), (Pr(4), Pr(11)), (Pr(2.5), Pr(5)), (Pr(0.5), Pr(0.5))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Steel"                         # the crank: out of the housing's camera side, down and back to its knob
        hub = rc + V((-Pr(26), 0, -Pr(36)))
        revolve(pc, hub, [(Pr(9), 0), (Pr(9), -Pr(5)), (0.0, -Pr(5))], n=8, axis=(1, 0, 0))
        knob = hub + V((-Pr(8), -Pr(30), -Pr(26)))
        pc.tube([hub + V((-Pr(5), 0, 0)), hub + V((-Pr(8), -Pr(14), -Pr(12))), knob], [Pr(4.5), Pr(4), Pr(4.5)], sides=4, tip=False, cap=True)
        revolve(pc, knob + V((-Pr(2), 0, 0)), [(Pr(7), 0), (Pr(7.5), -Pr(16)), (Pr(5), -Pr(22)), (0.0, -Pr(22))], n=8, axis=(1, 0, 0))
        pc.mat = "Cyan"
        revolve(pc, knob + V((-Pr(6), 0, 0)), [(Pr(7.8), 0), (Pr(7.8), -Pr(5))], n=8, axis=(1, 0, 0))
        pc.mat = "Line"                          # the line: the spool to the ring at the tip
        pc.tube([rc + V((0, Pr(23), Pr(10))), at(700, 104), at(1147, 92)], [P(0.9)] * 3, sides=3, tip=False, cap=False)
    def colour(p, part, n):
        c = kit.lin(TI_A[part])
        if part in ("Body", "Steel"):            # each flat a touch lighter or darker than the next: ground metal
            flat = math.cos(4 * math.atan2(n.y, n.x)) if abs(n.z) < 0.7 else 0.0
            k = 1.0 + 0.08 * flat + 0.06 * n.z
            import colorsys                      # a thin-film rainbow baked faintly into the flats, hue by facing
            film = colorsys.hsv_to_rgb((math.atan2(n.y, n.z) / TAU + 0.35 * n.x) % 1.0, 0.45, 1.0)
            return tuple(min(1.0, x * k * (0.78 + 0.3 * kit.lin('#%02X%02X%02X' % tuple(int(f * 255) for f in film))[i])) for i, x in enumerate(c))
        return c
    rod = metal(model("rod-titanium", {k: "#FFFFFF" for k in TI_A}, b), colour)

    # ---- the effect
    def bands(pc):                               # the collars' cyan bands and the slits, glowing
        pc.mat = "Glow"
        for x in COL:
            r = r_at(x) + P(4)
            revolve(pc, at(x - 3.8), [(r + P(0.8), 0), (r + P(0.8), P(7.6))], n=6)
        revolve(pc, rc, [(Pr(27.8), -Pr(30.5)), (Pr(27.8), -Pr(22.5))], n=10)
        for s_ in (-1, 1):
            for p0, p1, xo in ((at(238, 32), at(276, 15), 11), (at(100, 56), at(170, 53), 15), (at(100, 110), at(165, 111), 15)):
                strip(pc, [p0 + V((s_ * P(xo), 0, 0)), p1 + V((s_ * P(xo), 0, 0))], [P(3)] * 2, lambda q, s_=s_: V((s_, 0, 0)), lambda q: V((0, q.y, q.z)))

    def sparks(pc):                              # sparks crackling off the reel and the fork's root
        pc.mat = "Glow"
        for c0, d in ((rc + V((0, -P(30), -P(30))), V((0, -1, -0.6))), (rc + V((0, P(10), -P(48))), V((0, 0.4, -1))), (at(215, 86), V((0, 0.8, -1)))):
            d = d.normalized()
            side = d.cross(V((1, 0, 0))).normalized()
            pts = [c0 + d * P(9 * i) + side * P(5 * (1 if i % 2 else -1)) for i in range(5)]
            pc.tube(pts, [P(1.1)] * 5, sides=3, tip=True, cap=True)
    fx = [glow("Bands", "#5FE4FF", bands, pulse=0.06),
          glow("Sparks", "#BFF6FF", sparks, flicker=1.0)]
    return rod, fx, {"rodFx": "titanium"}, particles("#7FE8FF", "sparkle", every=0.18, size=0.035, rise=0.15)


# ================================================================ build
FILES = {"riptide": "rod-riptide", "tempest": "rod-tempest", "tidewarden": "rod-5", "titanium": "rod-titanium"}
BUILDERS = {"riptide": riptide, "tempest": tempest, "tidewarden": tidewarden, "titanium": titanium}
BUDGET_A = 2500                                   # the rebuild's triangle budget per rod (the coordinator, 2026-11-20, raised from 1500)
for name in (ARGS[ARGS.index("only") + 1].split(",") if "only" in ARGS else list(BUILDERS)):
    rod, fx, rod_extras, fx_extras = BUILDERS[name]()
    mats = len(rod.data.materials)
    print(f"MODEL tools/{FILES[name]} tris={tris(rod)} materials={mats}")
    if fx:
        export(fx, os.path.join(PROPS, f"rodfx-{name}.glb"), fx_extras)
        print(f"MODEL props/rodfx-{name} tris={sum(tris(o) for o in fx)} meshes={sum(o.type == 'MESH' for o in fx)}")
    assert tris(rod) <= BUDGET_A and mats <= 5, f"{name} over its budget"
    for o in [rod] + list(fx):
        bpy.data.objects.remove(o)
