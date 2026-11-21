"""Rod rebuild, group A (2026-11-20): the Riptide, the Tempest, the Tidewarden and the Titanium rebuilt part by part
to their approved concepts (art/pipeline/concepts/old/<rod>/: hero.png, turnaround.png rod only, effects.png the
effect layer only), the way the Christmas rods were (build_rods.py north_star, candy_cane). David: "riptide effects
are crucial"; "tidewarden = original model plus the pearls, filigree and small details"; "titanium = match the
concept including details".

  Blender -b --factory-startup -P art/pipeline/build_rods_a.py -- [only riptide,tempest]

Uses build_rods.py's helpers and conventions (rig units, the grip's hand at the origin, Z up the rod, the reel toward
-Y, the camera side -X) without running its build. Each rod is measured off its turnaround's top row (the side view,
grip left, reel below): `at(x, y)` turns a point of that row (pixels) into the rod's space. Writes the rod to
web/public/assets/game/tools/rod-<name>.glb (the Tidewarden is rod-5) and its effect to
web/public/assets/game/props/rodfx-<name>.glb. Review renders: compare_a.py (and compare_sheet.py).
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
    R = lambda x: P(9.8 - 2.6 * (x - 268) / (1095 - 268))          # the blank's radius (18 px across at the collar)
    rc = at(273, 146)                                                # the reel's hub
    RO, RT = P(38), P(22)                                            # the reel's radius and half thickness

    # the ribbon: a band on a helix round the blank, lying on it underneath and turning up on top (+Y) into a wave
    # standing off it, its leading edge (ahead, out) white with foam
    def rib(x):
        a = math.pi / 2 + TAU * (x - 565) / 180                     # crests at x 565, 745, 925 (+Y is up the sheet)
        fade = min(1.0, max(0.0, (x - 440) / 80)) * min(1.0, max(0.0, (1004 - x) / 40))
        return a, min(1.0, 1.25 * ((1 + math.sin(a)) / 2) ** 1.4) * fade
    RX = [376 + (1008 - 376) * i / 25 for i in range(26)]

    def rib_pts(x):
        """The band's edge, middle and leading edge at x."""
        a, T = rib(x)
        c, rc, hw, H = at(x), R(x) + P(2.6), P(11), P(27)
        out = []
        for s_ in (-1, 0, 1):
            ang = a + s_ * hw / rc
            lie = c + V((math.cos(ang), math.sin(ang), 0)) * rc + V((0, 0, s_ * P(3)))
            d = V((math.cos(a), math.sin(a), 0))     # standing, it leans up (+Y) as it goes round, so the crest stays on top
            stand = c + d * (R(x) + P(1)) + (d + V((0, 1.1, 0))).normalized() * ((s_ + 1) / 2 * H) + V((0, 0, (s_ + 1) / 2 * P(6)))
            out.append(lie.lerp(stand, T))
        return out

    def rib_sec(x):
        """The band's three points at x and the normal of its face."""
        p = rib_pts(x)
        q = rib_pts(x + 1.5)
        return p[0], p[1], p[2], (q[1] - p[1]).cross(p[2] - p[0]).normalized()

    WC = at(1136, 80)                            # the breaking wave's eye

    def wave_r(u):
        """The wave's outer and inner radius at u (0 the lip, curling in over the eye; 1 the hook under it), the outer
        scalloped into foam."""
        th = math.radians(165 - 320 * u)
        ro = P(24 + 32 * math.sin(math.pi * min(1.0, u * 1.15)) ** 0.6) * (1 + 0.13 * abs(math.sin(6 * th)))
        if u > 0.62:                             # the hook: thinner, curling in
            ro *= 1 - 0.55 * (u - 0.62) / 0.38
        ri = P(10 + 10 * u)
        return max(ro, ri + P(4)), ri

    def b(pc):
        pc.mat = "Gem"                           # the pommel's crystal point
        loft(pc, [at(74), at(88), at(98)], [P(1), P(13), P(9)], sides=4, tip=False, cap=False, phase=math.pi / 4)
        pc.mat = "Silver"                        # its cap, flaring, faceted
        revolve(pc, at(95), [(P(8.5), 0), (P(15.5), P(6)), (P(15.5), P(20)), (P(13.5), P(30))], n=6, phase=math.pi / 6)
        pc.mat = "Teal"                          # the sea-glass grip
        revolve(pc, at(124), [(P(13.4), 0), (P(14), P(55)), (P(13.4), P(110))], n=8)
        pc.mat = "Foam"                          # its white wave lines, two crossing on each face
        for side in (-1, 1):
            for ph in (0.0, math.pi):
                pts = []
                for i in range(7):
                    u = i / 6
                    a = (math.pi if side < 0 else 0.0) + 0.75 * math.sin(math.pi * 1.4 * u + ph)
                    pts.append(at(135 + 92 * u) + V((math.cos(a), math.sin(a), 0)) * P(14.3))
                strip(pc, pts, [P(3.2) * math.sin(math.pi * (i + 0.5) / 7) ** 0.5 for i in range(7)],
                      lambda q: V((q.x, q.y, 0)).normalized(), lambda q: V((0, 0, q.z)))
        pc.mat = "Silver"                        # the fore collar
        revolve(pc, at(232), [(P(13.5), 0), (P(16.5), P(5)), (P(16.5), P(32)), (P(10), P(42))], n=6, phase=math.pi / 6)
        pc.mat = "Gem"
        for s in (-1, 1):
            gem(pc, at(252) + V((s * P(16.6), 0, 0)), P(5.5), P(2.5), (s, 0, 0))
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
                   for a, rr in ((TAU * 1.25 * i / 11, P(3) + P(25) * i / 11) for i in range(12))]
            strip(pc, pts, [P(7) * (0.5 + 0.5 * i / 11) for i in range(12)], lambda q, s=s: V((s, 0, 0)), lambda q: rc)
        pc.mat = "Silver"                        # three claws round the rim, curling the way the water turns
        for a0 in (0.55, 2.65, 4.75):
            pts, rad = [], []
            for i in range(5):
                u = i / 4
                a = a0 + 0.95 * u
                rr = RO + P(1) + P(9) * u * u
                pts.append(rc + V((0, math.cos(a) * rr, math.sin(a) * rr)))
                rad.append((RT * 0.62 * (1 - 0.8 * u), P(4.5) * (1 - 0.85 * u)))
            loft(pc, pts, rad, sides=3, tip=True, cap=True, ref=(1, 0, 0))
        drop = rc + V((0, math.cos(4.25) * (RO + P(2)), math.sin(4.25) * (RO + P(2))))
        pc.tube([drop + V((0, -P(4) + math.cos(TAU * k / 4) * P(4), math.sin(TAU * k / 4) * P(4))) for k in range(4)], [P(1.3)] * 4, sides=3, closed_loop=True)
        pc.mat = "Gem"                           # the crystal hanging off it
        loft(pc, [drop + V((0, -P(8), 0)), drop + V((0, -P(16), 0)), drop + V((0, -P(30), 0))], [P(0.8), P(5.5), P(0.8)], sides=4, tip=False, cap=False, ref=(1, 0, 0))
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
        # the ribbon: the fin, teal, its outer third white foam
        rings = []
        for x in RX:
            p0, p1, p2, nrm = rib_sec(x)
            th = P(1.8)
            pm = p1.lerp(p2, 0.45)
            rings.append([p0 - nrm * th, pm - nrm * th, p2 - nrm * th * 0.6, p2 + nrm * th * 0.6, pm + nrm * th, p0 + nrm * th])
        sweep(pc, rings, lambda i, k: "Foam" if k in (1, 2, 3) else "Teal")
        pc.mat = "Foam"                          # the foam crests: a lumpy roll along each crest's top
        for xc in (565, 745, 925):
            pts, rad = [], []
            for i in range(5):
                x = xc - 62 + 124 * i / 4
                p0, p1, p2, nrm = rib_sec(x)
                pts.append(p2 + (p2 - p1).normalized() * P(1.5))
                rad.append(P(4.5 + 3.0 * abs(math.sin(i * 1.9 + xc))) * math.sin(math.pi * (i + 0.6) / 5.2) ** 0.6)
            pc.tube(pts, rad, sides=4, tip=False, cap=True)
        pc.mat = "Silver"                        # the clasp tying the ribbon on
        revolve(pc, at(412), [(R(412) + P(3), 0), (R(412) + P(4), P(5)), (R(412) + P(3), P(11))], n=6)
        # the arrow collar near the tip: a long point back down the blank, deep below in a V, a gem on each face
        loft(pc, [at(1003), at(1040), at(1072, 90), at(1093, 89)], [(P(1), P(1)), (P(8), P(9)), (P(9.5), P(15)), (P(8), P(13))],
             sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.tube([at(1070, 95), at(1082, 108), at(1086, 112)], [P(6), P(3.5), P(0.5)], sides=4, tip=False, cap=True)
        pc.mat = "Gem"
        for s in (-1, 1):
            gem(pc, at(1062) + V((s * P(8.5), 0, 0)), P(5), P(2.2), (s, 0, 0))
        # the wave breaking over the tip: a fat C round its eye, open toward the grip where the blank goes in, its
        # inside teal water and its outside white foam, scalloped
        wc, rings = WC, []
        for i in range(14):
            u = i / 13
            th = math.radians(165 - 320 * u)                         # from the lip (upper left) over the top, round to the hook
            ro, ri = wave_r(u)
            dpt = P(32) * (0.25 + 0.75 * math.sin(math.pi * min(1.0, u * 1.3)) ** 0.7) if u < 0.75 else P(32) * max(0.12, (1 - u) * 3.6) * 0.5
            rad = V((0, math.sin(th), math.cos(th)))
            o, inn = wc + rad * ro, wc + rad * ri
            m1, m2 = inn.lerp(o, 0.25), inn.lerp(o, 0.36 + 0.46 * u * u)
            rings.append([inn, m1 + V((-dpt * 0.8, 0, 0)), m2 + V((-dpt * 0.62, 0, 0)), o + V((-dpt * 0.4, 0, 0)) - rad * P(2), o + rad * P(4),
                          o + V((dpt * 0.4, 0, 0)) - rad * P(2), m2 + V((dpt * 0.62, 0, 0)), m1 + V((dpt * 0.8, 0, 0))])
        sweep(pc, rings, lambda i, k: "Teal" if k in (0, 1, 6, 7) else "Foam")
        pc.mat = "Foam"                          # the line: the reel to the wave's hook
        pc.tube([rc + V((0, RO * 0.6, RO * 0.6)), at(700, 112), at(1102, 124)], [P(0.9)] * 3, sides=3, tip=False, cap=False)
    rod = model("rod-riptide", {"Navy": "#1D3F7A", "Silver": "#C9CDD3", "Teal": "#62CDBF", "Foam": "#F4F8FA", "Gem": "#5FC3F2"}, b)
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
            off = nrm * side * P(3.2)
            rings.append([p0 + off, p0.lerp(p1, 0.5) + off, p1 + off, p1.lerp(p2, 0.5) + off, p2 + off + (p2 - p1).normalized() * P(2)])
        cuts.append(len(rings) - 1)
    for s in (-1, 1):                            # the wave's face: water running up from the hook, over, to the lip
        for i in range(14):
            u = 1 - i / 13
            th = math.radians(165 - 320 * u)
            rad = V((0, math.sin(th), math.cos(th)))
            ro, ri = wave_r(u)
            dpt = P(16) * math.sin(math.pi * min(1.0, u * 1.2)) ** 0.5 + P(4)
            rings.append([WC + rad * (ri + (ro * 0.82 - ri) * j / 4) + V((s * dpt, 0, 0)) for j in range(5)])
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
    for n, th in enumerate((135, 95, 55, 15)):
        rad = V((0, math.sin(math.radians(th)), math.cos(math.radians(th))))
        blobs.append((WC + rad * P(52), P(9), 1.0, n + 3))
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
        loft(pc, [at(30), at(44), at(58)], [P(1), P(10), P(8)], sides=4, tip=False, cap=False, phase=math.pi / 4)
        pc.mat = "Silver"                        # its two rings, the grip's three, the collar
        for x0, x1, r in ((57, 68, 15.5), (70, 82, 15.5), (135, 150, 16.5), (200, 216, 16.5), (230, 262, 17.5)):
            revolve(pc, at(x0), [(P(r - 1.5), 0), (P(r), P(2)), (P(r), P(x1 - x0 - 2)), (P(r - 1.5), P(x1 - x0))], n=6)
        pc.mat = "Grip"                          # the charcoal grip
        revolve(pc, at(80), [(P(14), 0), (P(14.5), P(75)), (P(14), P(152))], n=8)
        pc.mat = "Deep"                          # the collar's blue band
        revolve(pc, at(243), [(P(18), 0), (P(18), P(6))], n=8)
        pc.mat = "Silver"                        # the horn curling back over the seat
        pts = [at(266, 72), at(258, 50), at(242, 34), at(222, 25)]
        loft(pc, pts, [(P(5), P(13)), (P(5), P(15)), (P(3.5), P(10)), (P(1), P(1.5))], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        for y0, y1, y2 in ((70, 56, 60), (88, 102, 98)):    # the wings along the chain's root, one over and one under
            pts = [at(262, y0), at(300, (y0 + y1) / 2), at(345, y1), at(388, y2)]
            loft(pc, pts, [(P(11), P(8)), (P(12), P(9)), (P(8), P(6)), (P(1), P(1))], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        pc.mat = "Ice"                           # the chain: bars bent up and down into the bolt, side on, faceted
        for j in range(4):
            for s_ in (1, -1):
                k = 1.0 if s_ > 0 else 0.86      # the falling bars a touch slimmer, inside the rising ones where they cross
                rr = (P(9.5 - 0.6 * j) * k, P(12.5 - 0.7 * j) * k)
                loft(pc, bar(j, s_), [rr] * 4, sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Deep"                          # and the links lying flat between, on the axis
        for j in range(6):
            pc.tube(flat(318 + 112 * j, L=128, w=15 - j), [(P(4.5), P(5))] * 6, sides=3, closed_loop=True, up=V((0, 1, 0)))
        pc.mat = "Ice"                           # icicles under the falling links
        for x, ln in ((440, 34), (505, 26), (605, 30), (628, 40), (775, 34), (800, 24), (930, 28)):
            pc.tube([at(x, 106), at(x + 1, 106 + ln * 0.5), at(x + 2, 106 + ln)], [P(4.5), P(2.5), P(0.3)], sides=3, tip=False, cap=True)
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
        loft(pc, [at(1028), at(1085), at(1128), at(1245)], [P(8), P(17), P(22), P(1)], sides=4, tip=False, cap=True, phase=math.pi / 4)
        # the storm globe: a sphere a little flattened along its axle, a silver claw over it, a white cloud winding in
        pc.mat = "Deep"
        revolve(pc, rc, [(0.0, -RG * 0.62), (RG * 0.6, -RG * 0.5), (RG * 0.95, -RG * 0.2), (RG * 0.95, RG * 0.2), (RG * 0.6, RG * 0.5), (0.0, RG * 0.62)],
                n=12, axis=(1, 0, 0))
        pc.mat = "Silver"
        pc.tube([at(262, 92), at(268, 104), rc + V((0, RG * 0.8, -P(4)))], [P(7), P(6), P(7)], sides=5, tip=False, cap=False)
        for s_ in (-1, 1):
            pts = [rc + V((s_ * RG * 0.45, math.sin(a) * RG * 1.06, math.cos(a) * RG * 1.06)) for a in (0.9, 0.2, -0.6, -1.4, -2.1)]
            loft(pc, pts, [(P(2), P(6)), (P(2.5), P(8)), (P(2.5), P(8)), (P(2), P(5)), (P(1), P(1))], sides=3, tip=True, cap=True, ref=(1, 0, 0))
        pc.mat = "Cloud"
        for s_ in (-1, 1):
            pts = []
            for i in range(10):
                a, rr = 1.8 + s_ * TAU * 0.9 * (1 - i / 9), P(6) + P(36) * i / 9
                xo = RG * 0.62 * math.sqrt(max(0.0, 1 - (rr / RG) ** 2)) + P(1.5)
                pts.append(rc + V((s_ * xo, math.sin(a) * rr, math.cos(a) * rr)))
            strip(pc, pts, [P(24) * (0.35 + 0.65 * i / 9) for i in range(10)], lambda q, s_=s_: (q - rc).normalized(), lambda q: rc)
        pc.mat = "Silver"                        # the crank, on the camera side, its crystal knob
        arm0 = rc + V((-RG * 0.62 - P(2), 0, 0))
        knob = at(210, 196) + V((-RG * 0.62 - P(8), 0, 0))
        pc.tube([arm0, arm0.lerp(knob, 0.5) + V((-P(4), 0, 0)), knob], [P(4), P(3.5), P(4)], sides=4, tip=False, cap=True)
        revolve(pc, knob + V((-P(2), 0, 0)), [(P(6), 0), (P(6.5), -P(12))], n=6, axis=(1, 0, 0))
        pc.mat = "Ice"
        revolve(pc, knob + V((-P(14), 0, 0)), [(P(6), 0), (0.0, -P(6))], n=6, axis=(1, 0, 0))
        pc.mat = "Cloud"                         # the line, the globe to the tip's ring
        pc.tube([rc + V((0, RG * 0.7, RG * 0.6)), at(700, 112), at(1010, 104)], [P(0.9)] * 3, sides=3, tip=False, cap=False)
    rod = model("rod-tempest", {"Grip": "#2C2F3A", "Silver": "#E4EAF2", "Ice": "#5E9EEA", "Deep": "#3A70DA", "Cloud": "#F5F8FC"}, b)
    for m in rod.data.materials:                 # the ice and the silver glossy
        if m.name.endswith(("_Ice", "_Silver", "_Deep")):
            bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            bs.inputs["Roughness"].default_value = 0.35
            bs.inputs["Metallic"].default_value = 0.25 if m.name.endswith("_Silver") else 0.0

    # ---- the effect
    tip = at(1250)

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
    fx = [glow("Bolts", "#62D8FF", bolts, flicker=1.0),
          glow("Eye", "#BFF3FF", eye, pivot=tuple(rc), pulse=0.18),
          glow("Spark", "#D8FAFF", spark, pivot=tuple(tip), pulse=0.16),
          light("Gust", "#B4DDFF", gust, pivot=tuple(at(600)), spin=1.6, **trail(P(6), (0, P(80), 0))),
          aura_hug("Aura", "#3C8CF0", axis_, [P(30)] * len(axis_), inflate=1.6)]
    return rod, fx, {"rodFx": "tempest"}, particles("#C9F6FF", "sparkle", every=0.07, size=0.06, rise=0.4)


# ================================================================ the Tidewarden (rare)
def tidewarden():
    """Rare, the Tidewarden (rod-5). David: "original model plus the pearls, filigree and small details". The original
    (build_rods.py tidewarden, traced from David's sketch) as it was: the gold trident head, its prongs running
    through mint into blue, the four-point star for a pommel, the teal wrap, the gold reel with its teal crank, the
    line up the middle prong; with its concept's pearls, filigree and details: the shaft mother-of-pearl wound with two
    strands of gold filigree, a pearl set in the star and a pearl and crystal drop hanging from it, gold leaves
    curling off the star and the neck, a pearl wave cresting over the reel seat in a gold rim, a pearl and crystal drop
    behind the reel, a pearl knob on the crank and a gold whorl on the spool, gold guide rings under the shaft, pearls
    along it, a teal diamond on each face of the head and pink coral branching off it. The effect (effects.png):
    the teal veins as before, sea wisps of light curling round the head and along the shaft, glints drifting."""
    from traced_refs import TIDEWARDEN as T
    R = 0.0095
    K, HALF, BEVEL = 1.2, 0.0058, 16.0
    tip, neck0, star = T["tip"][1], T["neck"][1], T["star"]
    neck = tip - (tip - neck0) * K
    top_z = neck + (tip - neck0) * K
    at = lambda x, z: (x * K, neck + (z - neck0) * K)
    lift = lambda d, ridge=False: HALF * min(1.0, d / BEVEL) ** 0.75 + (0.0012 if ridge and d > 0 else 0.0)
    H = T["head"]
    gold, mint, blue = (kit.lin(c) for c in ("#E2C47F", "#A9D9C2", "#5FA8DA"))
    shade = {}
    rz = 0.06
    sc = star["centre"]
    # the details are placed in the final rod's space (the head's plane faces +-X, the reel toward -Y); `turn` takes
    # them back to the build space (the head in XZ), as everything is turned a quarter at the end
    back = Matrix.Rotation(-math.pi / 2, 3, "Z")
    Q = lambda p: back @ V(p)

    def pearl(pc, c, r):
        pc.mat = "Pearl"
        pc.blob(Q(c), r, segs=6 if r > 0.007 else 5, rings=4 if r > 0.007 else 3)

    def b(pc):
        # ---- the original: the head (front raised toward -Y, back toward +Y), the shaft, the star, the wrap, the reel
        pc.mat = "Gold"
        front, back_ = [], []
        for (x, z), d, r, bd in zip(H["points"], H["depth"], H["ridge"], H["band"]):
            X, Z = at(x, z)
            h = lift(d, r)
            front.append(pc.v((X, -h, Z)))
            back_.append(pc.v((X, h, Z)))
            bd = min(bd, 2.0)
            u, w = min(bd, 1.0), max(bd - 1.0, 0.0)
            shade[(round(X, 4), round(Z, 4))] = [g + (m - g) * u + (bl - m) * w for g, m, bl in zip(gold, mint, blue)]
        for t in H["tris"]:
            c = sum((V(at(*H["points"][i])).to_3d() for i in t), V((0, 0, 0))) / 3
            mid = V((c.x, 0, c.y))
            pc.f([front[i] for i in t], mid + V((0, 1, 0)))
            pc.f([back_[i] for i in t], mid - V((0, 1, 0)))
        pc.mat = "Pearl"                         # the shaft, mother-of-pearl now (its tint below)
        pc.tube([(0, 0, sc), (0, 0, 0.12), (0, 0, 0.3), (0, 0, neck + 0.02)], [R, R * 0.97, R * 0.95, R * 0.9], sides=6, tip=False)
        pc.mat = "Shaft"                         # the star
        c, w = V((0, 0, sc)), star["span"] / 2
        tips = [c + V((0, 0, 0.032)), c + V((w, 0, 0)), V((0, 0, star["foot"])), c + V((-w, 0, 0))]
        dirs = [(q - c).normalized() for q in tips]
        valleys = [c + (dirs[i] + dirs[(i + 1) % 4]).normalized() * 0.012 for i in range(4)]
        hole = [c + d * 0.0055 for d in dirs]
        T_, Vv, D = [pc.v(p) for p in tips], [pc.v(p) for p in valleys], [pc.v(p) for p in hole]
        bk = c + V((0, 1, 0))
        for i in range(4):
            j = (i + 1) % 4
            pc.f([D[i], Vv[i - 1], T_[i]], bk)
            pc.f([D[i], T_[i], Vv[i]], bk)
            pc.f([D[i], Vv[i], D[j]], bk)
        pc.mat = "Teal"                          # the teal wrap
        pc.tube([V((math.cos(TAU * k / 5) * (R + 0.005), math.sin(TAU * k / 5) * (R + 0.005), -0.03 + 0.006 * math.cos(TAU * k / 5))) for k in range(5)], [0.0036] * 5, sides=3, closed_loop=True)
        pc.tube(helix((0, 0, -0.026), (0, 0, 0.028), R + 0.0015, R + 0.0015, 1.25, 7), [(0.005, 0.0016)] * 7, sides=3, tip=False, cap=False, up=V((0, 0, 1)))
        vs0, fs0 = set(pc.bm.verts), set(pc.ref)
        pc.mat = "Shaft"                         # the reel: a stem and a gold spool, a teal crank
        pc.tube([(0, -0.008, rz), (0, -0.034, rz)], [0.0055, 0.0055], sides=4, tip=False, cap=False)
        lathe(pc, (0, -0.044, rz), [(0, -0.012), (0.027, -0.009), (0.027, 0.009), (0, 0.012)], n=6, axis=(1, 0, 0))
        pc.mat = "Pearl"                         # (new) a pearl whorl on each of the spool's faces, a nautilus's
        for s_ in (-1, 1):
            pts = [V((s_ * (0.0125 - 0.003 * i / 9), -0.044 + math.cos(1.2 * TAU * i / 9) * (0.004 + 0.019 * i / 9), rz + math.sin(1.2 * TAU * i / 9) * (0.004 + 0.019 * i / 9))) for i in range(10)]
            strip(pc, pts, [0.004 + 0.006 * i / 9 for i in range(10)], lambda q, s_=s_: V((s_, 0, 0)), lambda q: V((0, -0.044, rz)))
        pc.mat = "Teal"
        pc.tube([(0.014, -0.044, rz), (0.026, -0.044, rz - 0.012), (0.03, -0.044, rz - 0.02)], [0.0035, 0.0035, 0.004], sides=4, tip=False)
        pc.mat = "Pearl"                         # (new) the crank's pearl knob
        pc.blob((0.032, -0.044, rz - 0.026), 0.0075, segs=6, rings=4)
        turn = Matrix.Rotation(-math.pi / 2, 3, "Z")
        for v_ in set(pc.bm.verts) - vs0:
            v_.co = turn @ v_.co
        for f_ in set(pc.ref) - fs0:
            pc.ref[f_] = turn @ V(pc.ref[f_])
        pc.mat = "Teal"                          # the line, onto the middle prong's face
        face = -(HALF + 0.0016)
        pts = [V((-0.044, 0, rz + 0.016)), V((-0.014, 0, rz + 0.08)), V((-0.011, 0, neck - 0.03)), V((0, face, neck + 0.04)), V((0, face * 0.5, top_z - 0.008))]
        pc.tube(pts, [0.0021] * len(pts), sides=3, tip=False)

        # ---- the details (final space through Q)
        pearl(pc, (0, 0, sc), 0.016)             # the pearl set in the star, and its drop: a pearl and a teal crystal
        pearl(pc, (0, -0.058, sc - 0.004), 0.0055)
        pc.mat = "Shaft"
        pc.tube([Q((0, -0.047, sc)), Q((0, -0.052, sc - 0.002))], [0.0012] * 2, sides=3, tip=False, cap=False)
        pc.mat = "Teal"
        loft(pc, [Q((0, -0.064, sc - 0.004)), Q((0, -0.074, sc - 0.004)), Q((0, -0.094, sc - 0.004))], [0.0008, 0.0055, 0.0006], sides=4, tip=False, cap=False, ref=(0, 1, 0))
        pc.mat = "Shaft"                         # gold leaves curling off the star up the shaft, and off the neck
        for s_ in (-1, 1):
            leaf(pc, Q((0, s_ * 0.012, sc + 0.026)), Q((0, s_ * 0.5, 0.86)), 0.065, 0.011, side=Q((0, s_, 0)), curl=-0.012, lobes=(0.4, 1.0, 0.7, 0.2), thick=0.002, sides=4)
            leaf(pc, Q((0, s_ * 0.011, neck - 0.05)), Q((0, s_ * 0.45, 0.9)), 0.065, 0.011, side=Q((0, s_, 0)), curl=-0.014, lobes=(0.4, 1.0, 0.7, 0.2), thick=0.002, sides=4)
        # the filigree: two gold strands wound round the shaft against each other, from the wrap to the neck
        for ph, sgn in ((0.0, 1), (math.pi, -1)):
            pts = [Q((math.cos(ph + sgn * TAU * 3.0 * i / 21) * (R + 0.0012), math.sin(ph + sgn * TAU * 3.0 * i / 21) * (R + 0.0012), 0.035 + (neck - 0.06 - 0.035) * i / 21)) for i in range(22)]
            strip(pc, pts, [0.0052] * 22, lambda q: V((q.x, q.y, 0)).normalized(), lambda q: V((0, 0, q.z)))
        pc.mat = "Pearl"                         # the pearl wave cresting over the reel seat, its edge gold
        rings = []
        for i in range(7):
            u = i / 6
            z = 0.075 + 0.075 * u
            hgt = 0.006 + 0.022 * math.sin(math.pi * u ** 0.8) * (1 - 0.3 * u)
            curl = 0.012 * math.sin(math.pi * u) ** 2
            rings.append([Q((-0.0022, R * 0.6, z)), Q((-0.0018, R + hgt, z + curl)), Q((0.0018, R + hgt, z + curl)), Q((0.0022, R * 0.6, z))])
        sweep(pc, rings, lambda i, k: "Shaft" if k == 1 else "Pearl")
        pc.mat = "Shaft"                         # the guides: gold rings under the shaft
        for z in (0.17, 0.265, 0.35, 0.415):
            gc = (0, -(R + 0.008), z)
            pc.tube([Q(V(gc) + V((0, math.cos(TAU * k / 5) * 0.0068 - 0.002, math.sin(TAU * k / 5) * 0.0068))) for k in range(5)], [0.0018] * 5, sides=3, closed_loop=True)
        pearl(pc, (0, R + 0.006, 0.215), 0.0062)      # pearls along the top, a big one in a gold ring
        pearl(pc, (0, R + 0.007, 0.39), 0.0075)
        pc.tube([Q((0, R + 0.007 + math.cos(TAU * k / 6) * 0.0095, 0.39 + math.sin(TAU * k / 6) * 0.0095)) for k in range(6)], [0.0014] * 6, sides=3, closed_loop=True)
        pearl(pc, (0, R + 0.005, neck - 0.01), 0.0055)
        pearl(pc, (0, -0.03, 0.02), 0.0048)      # the drop behind the reel: two pearls and a crystal
        pearl(pc, (0, -0.041, 0.02), 0.0042)
        pc.mat = "Shaft"
        pc.tube([Q((0, -R, 0.02)), Q((0, -0.025, 0.02))], [0.0011] * 2, sides=3, tip=False, cap=False)
        pc.mat = "Teal"
        loft(pc, [Q((0, -0.046, 0.02)), Q((0, -0.054, 0.02)), Q((0, -0.07, 0.02))], [0.0007, 0.0048, 0.0006], sides=4, tip=False, cap=False, ref=(0, 1, 0))
        for s_ in (-1, 1):                       # a teal diamond on each face of the head
            gem(pc, Q((s_ * (HALF + 0.0004), 0, neck + 0.105)), 0.016, 0.004, Q((s_, 0, 0)))
        pc.mat = "Coral"                         # pink coral branching off the head's shoulders, up and out
        for s_ in (-1, 1):
            for z0, lean in ((neck + 0.2, 0.35), (neck + 0.13, 0.75)):
                base = V((0, s_ * 0.055, z0))
                d = V((0, s_ * lean, 1)).normalized()
                trunk = [base, base + d * 0.035, base + d * 0.07 + V((0, s_ * 0.01, 0))]
                pc.tube([Q(p) for p in trunk], [0.006, 0.005, 0.0025], sides=4, tip=True, cap=False)
                for k, t_ in enumerate((0.3, 0.7)):
                    p0 = trunk[0].lerp(trunk[2], t_)
                    tw = V((0, s_ * (0.7, -0.4)[k], 0.6)).normalized()
                    pc.tube([Q(p0), Q(p0 + tw * 0.026)], [0.004, 0.0018], sides=3, tip=True, cap=False)
    rod = model("rod-5", {"Gold": "#FFFFFF", "Shaft": "#E0C07E", "Teal": "#3DB8B6", "Pearl": "#F3EEF4", "Coral": "#F2B3AA"}, b, grad=(0.85, 1.0))
    me = rod.data                                # the head's colour into its vertices; the pearl's sheen into the shaft
    col = me.color_attributes["Color"]
    names = [m.name.split("_")[-1] for m in me.materials]
    pastel = [kit.lin(c) for c in ("#FFFFFF", "#F0D6EC", "#D6DFFA", "#D3F1E8")]
    for poly in me.polygons:
        for li in poly.loop_indices:
            p = me.vertices[me.loops[li].vertex_index].co
            g = col.data[li].color[0]
            if names[poly.material_index] == "Gold":
                rgb = shade.get((round(p.x, 4), round(p.z, 4)), gold)
            elif names[poly.material_index] == "Pearl":
                k = (math.atan2(p.y, p.x) / TAU * 4 + p.z * 22) % 4
                a_, b_ = pastel[int(k)], pastel[(int(k) + 1) % 4]
                rgb = [x + (y - x) * (k % 1) for x, y in zip(a_, b_)]
            else:
                continue
            col.data[li].color = (rgb[0] * g, rgb[1] * g, rgb[2] * g, 1.0)
    for m in me.materials:
        bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bs.inputs["Roughness"].default_value = 0.3 if m.name.endswith("_Pearl") else 0.45
        bs.inputs["Metallic"].default_value = 0.1 if m.name.endswith(("_Pearl", "_Coral")) else 0.35

    # ---- the effect: the veins as before, sea wisps round the head and along the shaft
    vv, vf = [], []
    for line_ in T["veins"]:
        pts = [(V(at(x, z)).to_3d(), d) for x, z, d in line_]
        for side in (-1, 1):
            k0 = len(vv)
            for i, (p, d) in enumerate(pts):
                a_, b_ = pts[max(i - 1, 0)][0], pts[min(i + 1, len(pts) - 1)][0]
                t = (b_ - a_).normalized() if (b_ - a_).length > 1e-6 else V((0, 1, 0))
                n = V((-t.y, t.x, 0)) * 0.0016 * K * (0.6 if i in (0, len(pts) - 1) else 1.0)
                y = side * (lift(d) + 0.0008)
                vv += [V((p.x + n.x, y, p.y + n.y)), V((p.x - n.x, y, p.y - n.y))]
            vf += [(k0 + 2 * i, k0 + 2 * i + 1, k0 + 2 * i + 3, k0 + 2 * i + 2) for i in range(len(pts) - 1)]
    veins = sheet("Veins", "Glow", "#5FE3D8", vv, vf)
    turn = Matrix.Rotation(math.pi / 2, 4, "Z")
    rod.data.transform(turn)
    veins.data.transform(turn)

    def wisp(pc, pts, w):
        """A ribbon of light through pts, `w` wide at its middle, thin at its ends, facing the camera side."""
        n = len(pts)
        strip(pc, pts, [w * math.sin(math.pi * (i + 0.5) / n) ** 0.7 for i in range(n)], lambda q: V((1, 0, 0)), lambda q: q + V((1, 0, 0)))

    def wisps(pc):                               # curling round the head, out past the prongs
        pc.mat = "Light"
        for s_, z0, amp in ((1, neck + 0.12, 0.09), (-1, neck + 0.18, 0.1), (1, neck + 0.33, 0.07)):
            pts = [V((0.01 * s_ * math.sin(i / 3), s_ * (0.03 + amp * i / 13 + 0.018 * math.sin(i / 13 * TAU * 1.2)), z0 + 0.24 * i / 13)) for i in range(14)]
            wisp(pc, pts, 0.014)

    def drift(pc):                               # along the shaft, by the line
        pc.mat = "Light"
        for z0, z1, y0 in ((0.05, 0.25, -0.02), (0.22, 0.45, 0.022)):
            pts = [V((0.004, y0 + 0.012 * math.sin(TAU * i / 8), z0 + (z1 - z0) * i / 8)) for i in range(9)]
            wisp(pc, pts, 0.016)
    fx = [veins, light("Wisps", "#7FF0E0", wisps, pivot=(0, 0, neck + 0.25), spin=0.35, bob=0.008, rate=0.5),
          light("Drift", "#8FE8F0", drift, pivot=(0, 0, 0.25), bob=0.01, rate=0.7)]
    return rod, fx, {"rodFx": "tidewarden", "fxRoom": 0.04}, particles("#D8FFF8", "sparkle", every=0.12, size=0.04, rise=0.25)


# ================================================================ the Titanium (epic)
TI_A = {"Body": "#B9BDC5", "Steel": "#8C9199", "Dark": "#30343B", "Cyan": "#5FD6EE", "Spool": "#D6E8F2", "Line": "#E6ECF0"}


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
    r_at = lambda x: P(17 - 5.5 * (x - 330) / (978 - 330)) if x <= 978 else P(11.5 - 4.0 * (x - 978) / (1147 - 978))
    rc = at(282, 128)                            # the reel's middle (its axle along the rod)

    def oct_(pc, x0, x1, r0, r1, phase=math.pi / 8):
        revolve(pc, at(x0), [(r0, 0), (r1, at(x1).z - at(x0).z)], n=8, phase=phase)

    def b(pc):
        # the fork: two faceted blades back from the hinge, the upper one deep, the lower one slim, a gap between
        pc.mat = "Body"
        loft(pc, [at(250, 64), at(150, 63), at(95, 67), at(45, 73)], [(P(7), P(14)), (P(6.5), P(12.5)), (P(5), P(7)), (P(0.5), P(0.5))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        loft(pc, [at(245, 100), at(150, 101), at(95, 102), at(45, 102)], [(P(5.5), P(10)), (P(5), P(9)), (P(4), P(5)), (P(0.5), P(0.5))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Dark"                          # the gap's dark web between them
        loft(pc, [at(250, 84), at(175, 85)], [(P(3), P(9)), (P(3), P(6))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Body"                          # the fin rising off the hinge, swept toward the tip
        loft(pc, [at(222, 58), at(256, 34), at(295, 22), at(358, 20)], [(P(5.5), P(14)), (P(5.5), P(12)), (P(4.5), P(7)), (P(0.5), P(0.5))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Steel"                         # the receiver, octagonal, and the hinge's pivot on each face
        oct_(pc, 225, 332, P(17), P(18))
        for s_ in (-1, 1):
            revolve(pc, at(236, 68) + V((s_ * P(17), 0, 0)), [(P(13), 0), (P(13), s_ * P(4)), (P(5), s_ * P(7)), (0.0, s_ * P(7))], n=8, axis=(1, 0, 0))
        pc.mat = "Cyan"                          # the cyan slits: on the fin, on the upper blade, on the receiver
        for s_ in (-1, 1):
            for p0, p1, y_ in ((at(240, 42), at(272, 28), 0), (at(118, 66), at(160, 64), 0), (at(272, 62), at(318, 62), 0)):
                strip(pc, [p0 + V((s_ * P(6.2), 0, 0)), p1 + V((s_ * P(6.2), 0, 0))] if p0.z < at(200).z or p0.y > at(0, 50).y else [p0 + V((s_ * P(18.6), 0, 0)), p1 + V((s_ * P(18.6), 0, 0))],
                      [P(3.5)] * 2, lambda q, s_=s_: V((s_, 0, 0)), lambda q: V((0, q.y, q.z)))
        # the blank: octagonal sections between hex collars
        for x0, x1 in zip(COL, COL[1:] + [1155]):
            pc.mat = "Body"
            oct_(pc, x0 + 6, x1 - 6, r_at(x0 + 6), r_at(x1 - 6))
            if x1 - x0 > 90:                     # its dark slot down each side, low
                pc.mat = "Dark"
                for s_ in (-1, 1):
                    rr = r_at((x0 + x1) / 2)
                    strip(pc, [at(x0 + 40, 70 + rr / P(1) * 0.32) + V((s_ * rr * 0.93, 0, 0)), at(x1 - 18, 70 + rr / P(1) * 0.32) + V((s_ * rr * 0.93, 0, 0))],
                          [P(4)] * 2, lambda q, s_=s_: V((s_, 0, 0)), lambda q: V((0, q.y, q.z)))
            elif x0 < 1140:                      # the slim sections' cyan slots instead
                pc.mat = "Cyan"
                for s_ in (-1, 1):
                    rr = r_at((x0 + x1) / 2)
                    strip(pc, [at(x0 + 18, 70) + V((s_ * rr * 0.95, 0, 0)), at(x1 - 18, 70) + V((s_ * rr * 0.95, 0, 0))],
                          [P(3)] * 2, lambda q, s_=s_: V((s_, 0, 0)), lambda q: V((0, q.y, q.z)))
        for x in COL:                            # the collars: hex, a cyan band round the middle
            r = r_at(x) + P(3.5)
            pc.mat = "Steel"
            revolve(pc, at(x - 7), [(r - P(1.5), 0), (r, P(2.5)), (r, P(4.5))], n=6)
            revolve(pc, at(x + 2.5), [(r, 0), (r, P(2)), (r - P(1.5), P(4.5))], n=6)
            pc.mat = "Cyan"
            revolve(pc, at(x - 2.5), [(r - P(0.6), 0), (r - P(0.6), P(5))], n=6)
        pc.mat = "Steel"                         # the cone point and the ring for the line under the last collar
        revolve(pc, at(1153), [(P(7), 0), (P(6), P(8)), (0.0, P(80))], n=8)
        pc.tube([at(1147, 88) + V((0, math.cos(TAU * k / 6) * P(5), math.sin(TAU * k / 6) * P(5))) for k in range(6)], [P(1.5)] * 6, sides=3, closed_loop=True)
        # the reel: a strut down from the hinge, the spool along the rod, a cyan ring at its front, claws at its back
        pc.tube([at(238, 76), at(232, 104), rc + V((0, P(6), -P(40)))], [P(5), P(5), P(5)], sides=4, tip=False, cap=True)
        pc.tube([at(282, 86), rc + V((0, P(20), 0))], [P(4)] * 2, sides=4, tip=False, cap=True)
        pc.mat = "Steel"
        revolve(pc, rc, [(0.0, -P(40)), (P(20), -P(40)), (P(25), -P(34)), (P(25), -P(26)), (P(21), -P(24))], n=10)
        pc.mat = "Spool"
        revolve(pc, rc, [(P(21), -P(24)), (P(22), P(16))], n=10)
        pc.mat = "Steel"
        revolve(pc, rc, [(P(21), P(16)), (P(26), P(18)), (P(26), P(26)), (P(10), P(28)), (0.0, P(28))], n=10)
        pc.mat = "Cyan"
        revolve(pc, rc, [(P(25.6), -P(33)), (P(25.6), -P(27))], n=10)
        pc.mat = "Body"
        for s_ in (1, -1):                       # the claws: crescents curling out round the reel's back
            pts = [rc + V((0, s_ * P(22), P(14))), rc + V((0, s_ * P(36), P(28))), rc + V((0, s_ * P(40), P(44))), rc + V((0, s_ * P(30), P(54)))]
            loft(pc, pts, [(P(4), P(5)), (P(5), P(6)), (P(3.5), P(4)), (P(0.5), P(0.5))], sides=4, tip=False, cap=True, ref=(1, 0, 0))
        pc.mat = "Steel"                         # the crank: off the reel's front, down and back to its knob
        arm = [rc + V((-P(4), 0, -P(41))), rc + V((-P(10), -P(14), -P(52))), rc + V((-P(12), -P(26), -P(66)))]
        pc.tube(arm, [P(4)] * 3, sides=4, tip=False, cap=True)
        revolve(pc, arm[-1] + V((0, 0, -P(2))), [(P(7), 0), (P(7.5), -P(24)), (P(5), -P(28)), (0.0, -P(28))], n=8)
        pc.mat = "Cyan"
        revolve(pc, arm[-1] + V((0, 0, -P(8))), [(P(7.6), 0), (P(7.8), -P(4))], n=8)
        pc.mat = "Line"                          # the line: the spool to the ring at the tip
        pc.tube([rc + V((0, P(22), P(10))), at(700, 98), at(1147, 92)], [P(0.9)] * 3, sides=3, tip=False, cap=False)
    def colour(p, part, n):
        c = kit.lin(TI_A[part])
        if part in ("Body", "Steel"):            # each flat a touch lighter or darker than the next: ground metal
            flat = math.cos(4 * math.atan2(n.y, n.x)) if abs(n.z) < 0.7 else 0.0
            k = 1.0 + 0.08 * flat + 0.06 * n.z
            return tuple(min(1.0, x * k) for x in c)
        return c
    rod = metal(model("rod-titanium", {k: "#FFFFFF" for k in TI_A}, b), colour)

    # ---- the effect
    def bands(pc):                               # the collars' cyan bands and the slits, glowing
        pc.mat = "Glow"
        for x in COL:
            r = r_at(x) + P(3.5)
            revolve(pc, at(x - 2.8), [(r + P(0.4), 0), (r + P(0.4), P(5.6))], n=6)
        revolve(pc, rc, [(P(26.2), -P(33.5)), (P(26.2), -P(26.5))], n=10)
        for s_ in (-1, 1):
            for p0, p1 in ((at(240, 42), at(272, 28)), (at(118, 66), at(160, 64))):
                strip(pc, [p0 + V((s_ * P(6.6), 0, 0)), p1 + V((s_ * P(6.6), 0, 0))], [P(3)] * 2, lambda q, s_=s_: V((s_, 0, 0)), lambda q: V((0, q.y, q.z)))

    def coil(pc):                                # the coil of line lit, in rings round the spool
        pc.mat = "Glow"
        for k in range(6):
            z = -P(20) + P(34) * k / 5
            pc.tube([rc + V((math.cos(TAU * j / 10) * P(22.6), math.sin(TAU * j / 10) * P(22.6), z)) for j in range(10)], [P(0.9)] * 10, sides=3, closed_loop=True)

    def sparks(pc):                              # sparks crackling off the reel and the fork's root
        pc.mat = "Glow"
        for c0, d in ((rc + V((0, -P(30), -P(30))), V((0, -1, -0.6))), (rc + V((0, P(10), -P(48))), V((0, 0.4, -1))), (at(215, 86), V((0, 0.8, -1)))):
            d = d.normalized()
            side = d.cross(V((1, 0, 0))).normalized()
            pts = [c0 + d * P(9 * i) + side * P(5 * (1 if i % 2 else -1)) for i in range(5)]
            pc.tube(pts, [P(1.1)] * 5, sides=3, tip=True, cap=True)
    fx = [glow("Bands", "#5FE4FF", bands, pulse=0.06),
          glow("Coil", "#8FF0FF", coil, pivot=tuple(rc), spin=1.4),
          glow("Sparks", "#BFF6FF", sparks, flicker=1.0)]
    return rod, fx, {"rodFx": "titanium"}, particles("#7FE8FF", "sparkle", every=0.18, size=0.035, rise=0.15)


# ================================================================ build
FILES = {"riptide": "rod-riptide", "tempest": "rod-tempest", "tidewarden": "rod-5", "titanium": "rod-titanium"}
BUILDERS = {"riptide": riptide, "tempest": tempest, "tidewarden": tidewarden, "titanium": titanium}
BUDGET_A = 1500                                   # the rebuild's triangle budget per rod (the coordinator, 2026-11-20)
for name in (ARGS[ARGS.index("only") + 1].split(",") if "only" in ARGS else list(BUILDERS)):
    rod, fx, rod_extras, fx_extras = BUILDERS[name]()
    export([rod], os.path.join(TOOLS, f"{FILES[name]}.glb"), rod_extras)
    mats = len(rod.data.materials)
    print(f"MODEL tools/{FILES[name]} tris={tris(rod)} materials={mats}")
    if fx:
        export(fx, os.path.join(PROPS, f"rodfx-{name}.glb"), fx_extras)
        print(f"MODEL props/rodfx-{name} tris={sum(tris(o) for o in fx)} meshes={sum(o.type == 'MESH' for o in fx)}")
    assert tris(rod) <= BUDGET_A and mats <= 5, f"{name} over its budget"
    for o in [rod] + list(fx):
        bpy.data.objects.remove(o)
