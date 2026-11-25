"""Step 3 build (rod-touchup lane): the hand edits on a fitted raw Meshy rod, then the game GLB.
blender -b --factory-startup -P touch_build.py -- <rod> <workdir> <out.glb> [fx_out.glb]
Opens workdir/fit.blend (touch_prep.py), runs the rod's edits below (faces picked by their texel in the ORIGINAL
Meshy texture and by place), puts workdir/tex.png (touch_paint.py) on one material and exports with JPEG textures.
Frame: Blender Z along the rod (glTF +Y), the reel toward Blender -Y (glTF +Z)."""
import bpy, bmesh, sys, math, json
import numpy as np
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index("--")+1:]
ROD, WORK, OUT = a[0], a[1], a[2]; FXOUT = a[3] if len(a) > 3 else None
bpy.ops.wm.open_mainfile(filepath=f"{WORK}/fit.blend")
sc = bpy.context.scene
rod = next(o for o in sc.objects if o.type == "MESH"); me = rod.data
img0 = next(n.image for n in me.materials[0].node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
W, H = img0.size; PX = np.array(img0.pixels[:], dtype=np.float32).reshape(H, W, 4)[..., :3]

def faces():
    """per face: original texel colour at its UV centre, centre position."""
    nf = len(me.polygons); uv = np.zeros(len(me.loops)*2); me.uv_layers.active.data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
    ls = np.zeros(nf, dtype=int); me.polygons.foreach_get("loop_start", ls); lt = np.zeros(nf, dtype=int); me.polygons.foreach_get("loop_total", lt)
    fu = np.add.reduceat(uv, ls) / lt[:, None]
    col = PX[np.clip((fu[:, 1]*H).astype(int), 0, H-1), np.clip((fu[:, 0]*W).astype(int), 0, W-1)]
    cen = np.zeros(nf*3); me.polygons.foreach_get("center", cen)
    return col, cen.reshape(-1, 3)
def hsv(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]; mx = c.max(-1); mn = c.min(-1); d = mx-mn+1e-9
    h = np.where(mx == r, (g-b)/d % 6, np.where(mx == g, (b-r)/d+2, (r-g)/d+4))*60
    return np.stack([h, np.where(mx > 0, (mx-mn)/(mx+1e-9), 0), mx], -1)
def weld():
    """Meshy's GLB splits vertices at UV seams; weld them so connected parts are real."""
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(me); bm.free(); me.update()
def components(mask):
    """connected groups (shared vertices) of the faces in mask: a label per face, -1 outside."""
    nf = len(me.polygons); fv = np.zeros(len(me.loops), dtype=int); me.polygons.foreach_get("vertices", fv)
    ls = np.zeros(nf, dtype=int); me.polygons.foreach_get("loop_start", ls); lt = np.zeros(nf, dtype=int); me.polygons.foreach_get("loop_total", lt)
    par = list(range(len(me.vertices)))
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for f in np.where(mask)[0]:
        r0 = find(fv[ls[f]])
        for k in range(1, lt[f]):
            r = find(fv[ls[f]+k])
            if r != r0: par[r] = r0
    lab = np.full(nf, -1)
    for f in np.where(mask)[0]: lab[f] = find(fv[ls[f]])
    return lab
def drop_small(mask, keep_min):
    """faces of mask in groups smaller than keep_min faces."""
    lab = components(mask); u, inv, cnt = np.unique(lab[mask], return_inverse=True, return_counts=True)
    small = np.zeros(len(mask), bool); small[np.where(mask)[0]] = cnt[inv] < keep_min; return small
def select(mask):
    for v in me.vertices: v.select = False
    for e in me.edges: e.select = False
    me.polygons.foreach_set("select", mask)
    me.update()
def delete(mask):
    global me
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in np.where(mask)[0]], context="FACES")
    bm.to_mesh(me); bm.free(); me.update(); print("DELETED", int(mask.sum()))
def split(mask, name):
    """move the faces in mask to their own object."""
    select(mask); bpy.context.view_layer.objects.active = rod; rod.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
    ob = next(o for o in sc.objects if o.type == "MESH" and o != rod); ob.name = ob.data.name = name; return ob
def smooth(vmask, factor=0.5, iters=5):
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    vs = [bm.verts[i] for i in np.where(vmask)[0]]
    for _ in range(iters): bmesh.ops.smooth_vert(bm, verts=vs, factor=factor, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(me); bm.free(); me.update()
def tame(vm, q=70, keep=0.3, dz=0.004, win=9, exact=False):
    """pull the lumps of a blank back to a smooth taper: per slice along the rod, radius over the slice's q-th
    percentile (smoothed along the rod) is cut to `keep` of its excess, about the slice's smoothed centre."""
    co = np.zeros(len(me.vertices)*3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    idx = np.where(vm)[0]; p = co[idx]; zb = np.floor(p[:, 2]/dz).astype(int); bins = np.unique(zb)
    cx = {}; cap = {}
    for b in bins:
        m = zb == b; cx[b] = np.median(p[m, :2], 0); cap[b] = np.percentile(np.linalg.norm(p[m, :2]-cx[b], axis=1), q)
    k = win//2; sc_, sx = {}, {}
    for b in bins:
        nb = [x for x in range(b-k, b+k+1) if x in cap]
        sc_[b] = np.mean([cap[x] for x in nb]); sx[b] = np.mean([cx[x] for x in nb], 0)
    c = np.array([sx[b] for b in zb]); cp = np.array([sc_[b] for b in zb])
    d = p[:, :2] - c; r = np.linalg.norm(d, axis=1) + 1e-9
    rn = np.where(r > cp, cp + (r-cp)*keep, r) if not exact else cp
    p[:, :2] = c + d*(rn/r)[:, None]; co[idx] = p
    me.vertices.foreach_set("co", co.ravel()); me.update(); print("TAMED", int((r > cp).sum()), "of", len(idx))
def tris(ob): return sum(len(p.vertices)-2 for p in ob.data.polygons)

# ---------------------------------------------------------------- per rod edits
EXTRA = []          # extra objects exported with the rod
FX = None           # object exported to FXOUT
def leafy(col):
    h = hsv(col); return (h[:, 0] > 45) & (h[:, 0] < 170) & (h[:, 1] > 0.12)
def cedar():
    """the leaves stay as Meshy made them (David: looks good); they move to the swaying boughs effect as before."""
    global FX
    col, cen = faces(); green = (col[:, 1] > col[:, 0]*1.12) & (col[:, 1] > col[:, 2]*1.25)
    FX = split(green, "Boughs"); FX["sway"] = 1
    for k in ("rodFx", "fxRoom"):
        if k in FX.keys(): del FX[k]                                    # the rod's scene extras stay on the rod
    print("LEAVES", tris(FX))

def glass():
    """clean-up: the crystal blank's lumps relaxed (Laplacian smooth of the teal shaft between grip and tip)."""
    weld(); col, cen = faces(); h = hsv(col)
    teal = (h[:, 0] > 130) & (h[:, 0] < 210) & (h[:, 1] > 0.15)
    shaft = teal & (cen[:, 2] > 0.1) & (cen[:, 2] < 0.86) & (np.hypot(cen[:, 0], cen[:, 1]) < 0.03)
    vm = np.zeros(len(me.vertices), bool); fv = np.zeros(len(me.loops), dtype=int); me.polygons.foreach_get("vertices", fv)
    ls = np.zeros(len(me.polygons), dtype=int); me.polygons.foreach_get("loop_start", ls)
    for k in range(3): vm[fv[ls[shaft]+k]] = True
    other = np.zeros(len(me.vertices), bool)
    for k in range(3): other[fv[ls[~shaft]+k]] = True
    vm &= ~other                                                       # keep the seams to bands and tip fixed
    tame(vm, q=70, keep=0.25)
    smooth(vm, factor=0.5, iters=4); print("SMOOTHED", int(vm.sum()))

def blank_radius(col, cen, is_blank, z0, z1, dz=0.01):
    """the blank's radius along the rod: median distance of its faces from the axis, per slice, smoothed."""
    zs = np.arange(z0, z1+dz, dz); r = np.hypot(cen[:, 0], cen[:, 1]); out = []
    for z in zs:
        m = is_blank & (np.abs(cen[:, 2]-z) < dz*1.5); out.append(np.median(r[m]) if m.sum() > 20 else np.nan)
    out = np.array(out); ok = ~np.isnan(out); out = np.interp(zs, zs[ok], out[ok])
    out = np.convolve(np.pad(out, 3, mode="edge"), np.ones(7)/7, mode="valid")
    return lambda z: np.interp(z, zs, out)

def wave_ribbon(rb, z0, z1, crest_z, pitch, hand, name="Wave"):
    """the wave that wraps the Riptide: a band spiralling the blank (crests on +y, the sheet's top side) whose
    trailing edge stands up into a foaming lip; its own small painted texture (deep teal, teal, white foam)."""
    N, M = 900, 14
    t = np.linspace(0, 1, N); zc = z0 + (z1-z0)*t
    phi = np.pi/2 + hand*2*np.pi*(zc - crest_z)/pitch
    crest = (0.5 + 0.5*np.sin(phi))**2.2
    taper = np.clip(t/0.06, 0, 1)*np.clip((1-t)/0.05, 0, 1); taper = taper*taper*(3-2*taper)
    w = (0.022 + 0.016*crest)*taper
    s = np.linspace(-1, 1, M)
    V = []; UV = []
    dphi = hand*2*np.pi/pitch                                            # turn per unit length
    for i in range(N):
        rc = rb(zc[i]) + 0.0022 + 0.026*crest[i]*taper[i]
        na, nz = 1.0, -dphi*rc; nn = math.hypot(na, nz); na, nz = na/nn, nz/nn     # across the band, in the surface
        for j in range(M):
            sj = s[j]; e = (sj+1)/2
            lift = (0.002 + 0.010*crest[i])*e**2 - 0.001*(1-e)**2             # the lip stands up, the foot hugs
            foam = 0.0015*crest[i]*e**3*(0.6+0.4*math.sin(zc[i]*900))
            rr = rc + (lift + foam)*taper[i]
            a_ = sj*w[i]/2*na; z = zc[i] + sj*w[i]/2*nz; ph = phi[i] + a_/rc
            V.append((rr*math.cos(ph), rr*math.sin(ph), z)); UV.append((e, t[i]))
    F = [(i*M+j, i*M+j+1, (i+1)*M+j+1, (i+1)*M+j) for i in range(N-1) for j in range(M-1)]
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(V, [], F); mesh.update()
    uvl = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices): uvl.data[li].uv = UV[vi]
    ob = bpy.data.objects.new(name, mesh); sc.collection.objects.link(ob)
    for poly in mesh.polygons: poly.use_smooth = True
    m = ob.modifiers.new("solid", "SOLIDIFY"); m.thickness = 0.0024; m.offset = -1
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier="solid")
    # its texture: across the band deep teal at the blank, teal, white foam on the lip (wider on the crests)
    TW, TH = 128, 1024; img = bpy.data.images.new(name+"-tex", TW, TH)
    u = (np.arange(TW)+0.5)/TW; v = (np.arange(TH)+0.5)/TH
    zv = z0 + (z1-z0)*v; cv = (0.5 + 0.5*np.sin(np.pi/2 + hand*2*np.pi*(zv - crest_z)/pitch))**2.2
    deep, mid, light, white = [np.array(c) for c in ((0.16, 0.56, 0.66), (0.33, 0.78, 0.78), (0.62, 0.93, 0.90), (0.97, 0.99, 1.0))]
    U, Cv = np.meshgrid(u, cv); Vv = np.meshgrid(u, v)[1]
    foam_line = 1 - (0.24 + 0.36*Cv) + 0.05*np.sin(Vv*2*np.pi*140) + 0.03*np.sin(Vv*2*np.pi*57)
    g = np.clip(U/np.maximum(foam_line, 0.1), 0, 1)[..., None]
    col = np.where(g < 0.5, deep + (mid-deep)*(g/0.5), mid + (light-mid)*((g-0.5)/0.5))
    f = np.clip((U - foam_line)/0.04, 0, 1)[..., None]; col = col*(1-f) + white*f
    px = np.concatenate([col, np.ones((TH, TW, 1))], -1).astype(np.float32)
    img.pixels.foreach_set(px.ravel()); img.pack()
    mat = bpy.data.materials.new("P_Paint"); mat.use_nodes = True; nt = mat.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"); tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = img
    nt.links.new(tn.outputs[0], bs.inputs["Base Color"]); bs.inputs["Roughness"].default_value = 0.45
    ob.data.materials.append(mat); print("WAVE", len(ob.data.polygons)); return ob

def flat_mat(name, rgb, rough=0.5, met=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bs.inputs["Base Color"].default_value = (*[c**2.2 for c in rgb], 1); bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = met; return m

def tube(z0, z1, c0, c1, r0, r1, name, mat, seg=48, rings=240):
    """a straight round blank from (c0, z0) to (c1, z1), radius r0 to r1, open ends."""
    V = []; F = []
    for i in range(rings+1):
        t = i/rings; z = z0 + (z1-z0)*t; c = c0 + (c1-c0)*t; r = r0 + (r1-r0)*t
        for j in range(seg):
            a_ = 2*math.pi*j/seg; V.append((c[0] + r*math.cos(a_), c[1] + r*math.sin(a_), z))
    for i in range(rings):
        for j in range(seg): F.append((i*seg+j, i*seg+(j+1) % seg, (i+1)*seg+(j+1) % seg, (i+1)*seg+j))
    me_ = bpy.data.meshes.new(name); me_.from_pydata(V, [], F); me_.update()
    for p_ in me_.polygons: p_.use_smooth = True
    ob = bpy.data.objects.new(name, me_); sc.collection.objects.link(ob); me_.materials.append(mat); return ob

def riptide():
    """the wrapping wave remodelled: between the reel seat and the breaker, Meshy's lumpy blank with its thin
    broken ribbon and loose foam is cut away; a clean navy blank and a continuous wave band with a foaming
    lip go in its place (Meshy's crests kept)."""
    weld(); col, cen = faces()
    h = hsv(col); crescent = (h[:, 0] > 150) & (h[:, 0] < 190) & (h[:, 1] > 0.25)
    zone = ((cen[:, 2] > Z0) & (cen[:, 2] < Z1)) | ((cen[:, 2] > 0.095) & (cen[:, 2] <= Z0) & ~crescent)
    delete(zone)
    co = np.zeros(len(me.vertices)*3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    bnd = np.array([v.index for v in bm.verts if v.is_boundary]); bm.free()
    ends = []
    for z in (Z0, Z1):
        p = co[bnd[np.abs(co[bnd, 2] - z) < 0.004]]
        if len(p) == 0: ends.append((np.zeros(2), 0.01)); continue
        c = np.median(p[:, :2], 0); r = np.percentile(np.linalg.norm(p[:, :2]-c, axis=1), 60); ends.append((c, r))
        print("CUT", z, "centre", c.round(4), "r", round(float(r), 4), "verts", len(p))
    (c0, r0), (c1, r1) = ends
    r0, r1 = 0.0138, max(min(r1, 0.0095), 0.0075); c0 = c1                 # the seat end is cut through the crescent
    blank = tube(Z0 - 0.05, Z1 + 0.006, c0, c1, r0, r1 + 0.0002, "Blank", flat_mat("P_Paint", (0.09, 0.20, 0.38), 0.35))
    EXTRA.append(blank)
    rb = lambda z: np.interp(z, [Z0, Z1], [r0, r1])
    EXTRA.append(wave_ribbon(rb, Z0 - 0.002, Z1 + 0.002, CREST, PITCH, HAND))
Z0, Z1, CREST, PITCH, HAND = 0.135, 0.83, 0.30, 0.21, 1

def arc(c, R_, r_, a0, a1, axis_u, axis_v, name, mat, seg=64, ring=16):
    """a partial torus: centre c, in the plane of unit vectors axis_u, axis_v, from angle a0 to a1 (radians)."""
    u, v = np.array(axis_u, float), np.array(axis_v, float); n = np.cross(u, v)
    V = []; F = []
    for i in range(seg+1):
        a_ = a0 + (a1-a0)*i/seg; d = math.cos(a_)*u + math.sin(a_)*v
        rr = r_*(0.55 + 0.45*math.sin(math.pi*i/seg))                   # thicker mid-arc, thin tips
        for j in range(ring):
            b_ = 2*math.pi*j/ring; V.append(tuple(c + d*(R_ + rr*math.cos(b_)) + n*rr*math.sin(b_)))
    for i in range(seg):
        for j in range(ring): F.append((i*ring+j, i*ring+(j+1) % ring, (i+1)*ring+(j+1) % ring, (i+1)*ring+j))
    me_ = bpy.data.meshes.new(name); me_.from_pydata(V, [], F); me_.update()
    for p_ in me_.polygons: p_.use_smooth = True
    ob = bpy.data.objects.new(name, me_); sc.collection.objects.link(ob); me_.materials.append(mat); return ob

def tempest():
    """the reel: Meshy's lumpy storm globe rounded into a true sphere, and the sheet's silver frame arc round
    its grip side."""
    g = json.load(open(f"{WORK}/globe.json")); c = np.array(g["c"]); r = g["r"]
    co = np.zeros(len(me.vertices)*3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    d = co - c; dist = np.linalg.norm(d, axis=1)
    weld(); col, cen = faces(); h = hsv(col)
    gf = (h[:, 0] > 195) & (h[:, 0] < 235) & (h[:, 1] > 0.3) & (np.abs(np.linalg.norm(cen - c, axis=1) - r) < 0.016)
    fv = np.zeros(len(me.loops), dtype=int); me.polygons.foreach_get("vertices", fv)
    ls = np.zeros(len(me.polygons), dtype=int); me.polygons.foreach_get("loop_start", ls)
    m = np.zeros(len(me.vertices), bool)
    for k in range(3): m[fv[ls[gf]+k]] = True
    co = np.zeros(len(me.vertices)*3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    d = co - c; dist = np.linalg.norm(d, axis=1)
    w = np.full(len(co), 0.8)
    new = c + d/dist[:, None]*(dist + (r - dist)*w)[:, None]
    co[m] = new[m]; me.vertices.foreach_set("co", co.ravel()); me.update(); print("ROUNDED", int(m.sum()))
    smooth(m, factor=0.5, iters=2)
    silver = flat_mat("P_Metal", (0.82, 0.85, 0.9), 0.35, 0.75)
    EXTRA.append(arc(c, r*1.07, 0.0042, math.radians(35), math.radians(215), (0, 1, 0), (0, 0, -1), "ReelFrame", silver))

def mesh_obj(name, V, F, mat, uv=None, smooth_=True):
    me_ = bpy.data.meshes.new(name); me_.from_pydata([tuple(map(float, v)) for v in V], [], F); me_.update()
    if uv is not None:
        l = me_.uv_layers.new(name="UVMap")
        for poly in me_.polygons:
            for li, vi in zip(poly.loop_indices, poly.vertices): l.data[li].uv = uv[vi]
    for p_ in me_.polygons: p_.use_smooth = smooth_
    ob = bpy.data.objects.new(name, me_); sc.collection.objects.link(ob); me_.materials.append(mat); return ob

def cyl(name, a, b, r, mat, seg=24, caps=True):
    a, b = np.array(a, float), np.array(b, float); ax = b - a; ax /= np.linalg.norm(ax)
    u = np.cross(ax, [0, 0, 1] if abs(ax[2]) < 0.9 else [1, 0, 0]); u /= np.linalg.norm(u); v = np.cross(ax, u)
    V = [p + r*(math.cos(2*math.pi*j/seg)*u + math.sin(2*math.pi*j/seg)*v) for p in (a, b) for j in range(seg)]
    F = [(j, (j+1) % seg, seg+(j+1) % seg, seg+j) for j in range(seg)]
    if caps: V += [a, b]; F += [(2*seg, (j+1) % seg, j) for j in range(seg)] + [(2*seg+1, seg+j, seg+(j+1) % seg) for j in range(seg)]
    return mesh_obj(name, V, F, mat)

def sphere(name, c, r, mat, seg=24):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg//2, radius=r)
    for v in bm.verts: v.co += Vector(c)
    me_ = bpy.data.meshes.new(name); bm.to_mesh(me_); bm.free()
    for p_ in me_.polygons: p_.use_smooth = True
    ob = bpy.data.objects.new(name, me_); sc.collection.objects.link(ob); me_.materials.append(mat); return ob

def nautilus(c, R_end, ax_out, e1, e2, name="Nautilus", k=0.19, turns=3.2, NU=420, NV=36):
    """a nautilus shell: a tube along a log spiral r = R_end*exp(k*(th - th_end)) in the plane (e1, e2), its
    section growing with the spiral so the whorls nest; the face toward ax_out. Its own pearl texture with the
    sheet's gold septa bands and gold rim."""
    c, ax_out, e1, e2 = [np.array(x, float) for x in (c, ax_out, e1, e2)]
    th_end = 0.0; th0 = -2*math.pi*turns
    V = []; UV = []
    for i in range(NU+1):
        t = i/NU; th = th0 + (th_end-th0)*t
        R_ = R_end*math.exp(k*(th - th_end)); rho = 0.5*R_
        dirc = math.cos(th)*e1 + math.sin(th)*e2                       # outward from the spiral's eye
        for j in range(NV):
            a_ = 2*math.pi*j/NV
            p = c + dirc*(R_ + rho*math.cos(a_)) + ax_out*(rho*0.95*math.sin(a_))
            V.append(p); UV.append((j/NV, t))
    F = [(i*NV+j, i*NV+(j+1) % NV, (i+1)*NV+(j+1) % NV, (i+1)*NV+j) for i in range(NU) for j in range(NV)]
    # the aperture: a lip disc closing the mouth (its texture row is the rim's gold)
    last = NU*NV; cen_ = np.mean(V[last:last+NV], 0); V.append(cen_); UV.append((0.5, 0.97))
    F += [(len(V)-1, last+j, last+(j+1) % NV) for j in range(NV)]
    # pearl texture: u around the section, v along the spiral; gold bands every 1/14 turn, curved like septa
    TW, TH = 256, 2048; img = bpy.data.images.new(name+"-tex", TW, TH)
    u = (np.arange(TW)+0.5)/TW; v = (np.arange(TH)+0.5)/TH; U, Vv = np.meshgrid(u, v)
    th = th0 + (th_end-th0)*Vv
    sheen = np.stack([np.cos(th*0.9 + U*6), np.cos(th*0.9 + U*6 + 2.1), np.cos(th*0.9 + U*6 + 4.2)], -1)
    pear = np.array([0.95, 0.94, 0.96]) + 0.05*sheen*np.array([[[1, -0.3, 0.8]]]) + 0.04*np.cos(U*2*np.pi)[..., None]
    pear = pear + np.array([-0.06, 0.02, 0.03])*np.clip(np.cos(th*0.9 + U*6 + 2.1), 0, 1)[..., None]
    ph = th*14/(2*math.pi) + 0.35*np.sin(U*2*np.pi)
    band = np.clip(1 - np.abs((ph % 1) - 0.5)/0.06, 0, 1) * (Vv > 0.35)
    gold = np.array([0.86, 0.66, 0.30]) + 0.1*np.cos(U*2*np.pi*2)[..., None]
    col = pear*(1-band[..., None]) + gold*band[..., None]
    rim = (Vv > 0.993); col[rim] = np.array([0.86, 0.66, 0.30])
    px = np.concatenate([np.clip(col, 0, 1), np.ones((TH, TW, 1))], -1).astype(np.float32)
    img.pixels.foreach_set(px.ravel()); img.pack()
    mat = bpy.data.materials.new("P_Paint"); mat.use_nodes = True; nt = mat.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"); tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = img
    nt.links.new(tn.outputs[0], bs.inputs["Base Color"]); bs.inputs["Roughness"].default_value = 0.35
    return mesh_obj(name, V, F, mat, uv=UV)

def tidewarden():
    """Meshy's flat disc reel cut off; a nautilus-shell reel modelled in its place as in the sheet: pearl shell with
    gold septa and rim facing out, a teal line spool behind it between gold flanges, a gold neck to the rod and a
    gold crank with a pearl knob."""
    weld(); col, cen = faces()
    h = hsv(col); goldf = (h[:, 0] > 25) & (h[:, 0] < 60) & (h[:, 1] > 0.35)
    reel = ((cen[:, 1] < -0.027) | (goldf & (cen[:, 1] < -0.014))) & (cen[:, 2] > 0.004) & (cen[:, 2] < 0.168)
    delete(reel); delete(drop_small(np.ones(len(me.polygons), bool), 300))
    C = np.array([-0.002, -0.078, 0.066])                               # Meshy's reel centre
    gold = flat_mat("P_Metal", (0.88, 0.68, 0.33), 0.32, 0.8)
    teal = flat_mat("P_Paint", (0.36, 0.78, 0.80), 0.5)
    pearl = flat_mat("P_Paint", (0.96, 0.95, 0.97), 0.25)
    # shell in the plane facing -x (the side view), mouth opening down and toward the grip like the sheet
    A = SHELL_ANG; e1 = np.array([0, math.sin(A), math.cos(A)]); e2 = np.array([0, math.cos(A), -math.sin(A)])
    sh = nautilus(C + np.array([-0.011, 0.0, 0.0]) - SHELL_SHIFT*SHELL_R*e1 + 0.24*SHELL_R*e2, SHELL_R, (-1, 0, 0), e1, e2)
    # spool behind: teal line wound (grooved) between gold flanges
    NS, NA = 48, 40; V = []; F = []
    for i in range(NA+1):
        x = 0.0 + 0.022*i/NA; rr = 0.033 + 0.0008*math.sin(i*math.pi*1.0)
        for j in range(NS): a_ = 2*math.pi*j/NS; V.append((x, C[1] + rr*math.cos(a_), C[2] + rr*math.sin(a_)))
    F = [(i*NS+j, i*NS+(j+1) % NS, (i+1)*NS+(j+1) % NS, (i+1)*NS+j) for i in range(NA) for j in range(NS)]
    sp = mesh_obj("Spool", V, F, teal)
    f1 = cyl("FlangeBack", (0.022, C[1], C[2]), (0.026, C[1], C[2]), 0.036, gold, seg=48)
    neck = cyl("Neck", (0.004, -0.006, 0.050), (0.006, C[1] + 0.036, C[2] - 0.004), 0.0055, gold)
    foot = cyl("Foot", (0.004, -0.010, 0.020), (0.004, -0.010, 0.095), 0.004, gold)
    arm0 = np.array([-0.030, C[1], C[2]]); arm1 = arm0 + np.array([0, -0.026, 0.030])
    hub = sphere("CrankHub", arm0, 0.006, gold); arm = cyl("CrankArm", arm0, arm1, 0.0032, gold)
    stem = cyl("KnobStem", arm1, arm1 + np.array([-0.010, 0, 0]), 0.0028, gold)
    knob = sphere("Knob", arm1 + np.array([-0.015, 0, 0]), 0.0075, pearl)
    EXTRA.extend([sh, sp, f1, neck, foot, hub, arm, stem, knob])

def lighthouse():
    """the extra porthole on the far side of the reel seat (+y, z 0.165 to 0.23) pressed back flush with the seat."""
    co = np.zeros(len(me.vertices)*3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    r = np.hypot(co[:, 0], co[:, 1]); ang = np.degrees(np.arctan2(co[:, 1], co[:, 0]))
    m = (co[:, 2] > 0.163) & (co[:, 2] < 0.232) & (np.abs(ang - 90) < 75) & (r > 0.0215)
    k = np.where(m, 0.0215/np.maximum(r, 1e-9), 1.0)
    co[:, 0] *= k; co[:, 1] *= k; me.vertices.foreach_set("co", co.ravel()); me.update()
    print("PORTHOLE flattened", int(m.sum()))
    sel = np.zeros(len(me.vertices), bool); sel[m] = True
    smooth(sel, factor=0.4, iters=2)

SHELL_R, SHELL_ANG, SHELL_SHIFT = 0.043, -2.4, 0.33
SM = {}
SM = {}
EDITS = {"cedar": cedar, "glass": glass, "riptide": riptide, "tempest": tempest, "tidewarden": tidewarden, "lighthouse": lighthouse}
SET = {  # material per rod: name, metallic, roughness
    "cedar": ("P_Wood", 0.0, 0.8), "glass": ("P_Paint", 0.0, 0.45), "riptide": ("P_Paint", 0.0, 0.45), "tempest": ("P_Paint", 0.0, 0.45), "tidewarden": ("P_Paint", 0.0, 0.4), "titanium": ("P_Polished", 0.85, 0.26), "lighthouse": ("P_Paint", 0.0, 0.45),
}
EDITS.get(ROD, lambda: None)()
# ---------------------------------------------------------------- material, export
tex = bpy.data.images.load(f"{WORK}/tex.png"); tex.name = f"{ROD}-tex"; tex.pack()
name, met, rough = SET.get(ROD, ("P_Paint", 0.0, 0.8))
mat = bpy.data.materials.new(name); mat.use_nodes = True; nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
t = nt.nodes.new("ShaderNodeTexImage"); t.image = tex; nt.links.new(t.outputs[0], bsdf.inputs["Base Color"])
bsdf.inputs["Metallic"].default_value = met; bsdf.inputs["Roughness"].default_value = rough
for ob in [rod, FX] + EXTRA:
    if ob is None or ob.type != "MESH": continue
    if ob in EXTRA and len(ob.data.materials): continue      # extra parts keep their own materials
    ob.data.materials.clear(); ob.data.materials.append(mat)
gname = "5" if ROD == "tidewarden" else ROD
rod.name = rod.data.name = f"rod-{gname}"
for k in ("rodFx", "fxRoom"):
    if k in rod.keys(): sc[k] = rod[k]; del rod[k]
def join_by_material(obs):
    """one object per material among the added parts (the budget counts primitives)."""
    groups = {}
    for o in obs: groups.setdefault(o.data.materials[0].name, []).append(o)
    out = []
    for name, g in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in g: o.select_set(True)
        bpy.context.view_layer.objects.active = g[0]
        if len(g) > 1: bpy.ops.object.join()
        g[0].name = g[0].data.name = f"rod-part-{len(out)}"; out.append(g[0])
    return out
EXTRA[:] = join_by_material([o for o in EXTRA if o.type == "MESH"])
def export(obs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_extras=True,
                              export_image_format="JPEG", export_jpeg_quality=90)
if FX is not None and FXOUT:
    keep = {k: sc[k] for k in ("rodFx", "fxRoom") if k in sc.keys()}
    for k in keep: del sc[k]
    for k, v in json.loads(a[4]).items() if len(a) > 4 else []: sc[k] = v
    export([FX], FXOUT); print("FX", FXOUT, tris(FX))
    for k in list(sc.keys()):
        if k not in ("cycles",):
            try: del sc[k]
            except Exception: pass
    for k, v in keep.items(): sc[k] = v
    FX.hide_render = True
export([rod] + EXTRA, OUT)
print("ROD", OUT, "tris", tris(rod) + sum(tris(o) for o in EXTRA if o.type == "MESH"))
bpy.ops.wm.save_as_mainfile(filepath=f"{WORK}/built.blend")
print("BUILD_OK")
