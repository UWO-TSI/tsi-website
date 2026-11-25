"""Step 3 paint (rod-touchup lane): colour passes on a raw Meshy rod's 2048 base colour, per rod.
python3 -I touch_paint.py <rod> <workdir> <sheetdir>
Reads workdir/base.npy and pos.npy (touch_prep.py), writes workdir/tex.png. Regions are picked by texel colour (HSV)
and by place (pos: x, y, z of the texel on the fitted rod, z along the rod, the reel toward -y). The main tool is
`match`: a region's texels take the mean and spread (Lab) of the same region picked off the concept sheet."""
import sys, numpy as np
from PIL import Image

def to_lin(c): return np.where(c <= 0.04045, c/12.92, ((c+0.055)/1.055)**2.4)
def to_srgb(c): c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c*12.92, 1.055*c**(1/2.4)-0.055)
_M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
_WP = np.array([0.95047, 1.0, 1.08883])
def lab(rgb):
    x = to_lin(rgb) @ _M.T / _WP
    f = np.where(x > 0.008856, np.cbrt(x), 7.787*x + 16/116)
    return np.stack([116*f[..., 1]-16, 500*(f[..., 0]-f[..., 1]), 200*(f[..., 1]-f[..., 2])], -1)
def rgb(L):
    fy = (L[..., 0]+16)/116; fx = fy + L[..., 1]/500; fz = fy - L[..., 2]/200
    f = np.stack([fx, fy, fz], -1); x = np.where(f**3 > 0.008856, f**3, (f-16/116)/7.787) * _WP
    return to_srgb(x @ np.linalg.inv(_M).T)
def hsv(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]; mx = c.max(-1); mn = c.min(-1); d = mx - mn + 1e-9
    h = np.where(mx == r, (g-b)/d % 6, np.where(mx == g, (b-r)/d + 2, (r-g)/d + 4)) * 60
    return np.stack([h, np.where(mx > 0, (mx-mn)/(mx+1e-9), 0), mx], -1)
def hsv2rgb(h):
    H, S, V = h[..., 0] % 360 / 60, np.clip(h[..., 1], 0, 1), np.clip(h[..., 2], 0, 1)
    i = np.floor(H).astype(int) % 6; f = H - np.floor(H); p = V*(1-S); q = V*(1-S*f); t = V*(1-S*(1-f))
    out = np.zeros(H.shape + (3,))
    for k, (a, b, c) in enumerate([(V, t, p), (q, V, p), (p, V, t), (p, q, V), (t, p, V), (V, p, q)]):
        m = i == k; out[m] = np.stack([a[m], b[m], c[m]], -1)
    return out

def hue_in(h, lo, hi): return (h >= lo) & (h <= hi) if lo <= hi else (h >= lo) | (h <= hi)
def pick(c, hue=None, sat=(0, 1.01), val=(0, 1.01)):
    """mask of colours c (N,3 or HxWx3) by hue range (deg), saturation and value ranges."""
    h = hsv(c); m = (h[..., 1] >= sat[0]) & (h[..., 1] < sat[1]) & (h[..., 2] >= val[0]) & (h[..., 2] < val[1])
    if hue: m &= hue_in(h[..., 0], *hue)
    return m

class Rod:
    def __init__(s, work, sheetdir, sheets=("side", "top", "threequarter")):
        s.work = work; b = np.load(f"{work}/base.npy"); s.alpha = b[..., 3:4]
        s.c = b[..., :3].astype(np.float64).copy(); s.c0 = s.c.copy(); s.p = np.load(f"{work}/pos.npy").astype(np.float64)
        s.z, s.r = s.p[..., 2], np.hypot(s.p[..., 0], s.p[..., 1]); s.ang = np.degrees(np.arctan2(s.p[..., 1], s.p[..., 0]))
        px = []
        for n in sheets:
            im = np.asarray(Image.open(f"{sheetdir}/{n}.png").convert("RGBA"), dtype=np.float64)/255
            a = im[..., 3] > 0.9; c = im[..., :3][a]; px.append(c[(c.min(-1) < 0.93)])     # drop the white ground
        s.sheet = np.concatenate(px) if px else np.zeros((0, 3))
    def match(s, mask, sheet_mask, amount=1.0, keep_detail=1.0, lshift=0.0):
        """region `mask` (texels) takes the Lab mean and spread of the sheet pixels in `sheet_mask`."""
        src = lab(s.c[mask]); ref = lab(s.sheet[sheet_mask])
        ms, ss = src.mean(0), src.std(0)+1e-6; mr, sr = ref.mean(0), ref.std(0)
        out = (src-ms)/ss*(sr*keep_detail + ss*(1-keep_detail)) + mr; out[:, 0] += lshift
        s.c[mask] = s.c[mask]*(1-amount) + rgb(out)*amount
        print(f"MATCH n={mask.sum()} src L{ms[0]:.0f} a{ms[1]:.0f} b{ms[2]:.0f} -> sheet L{mr[0]:.0f} a{mr[1]:.0f} b{mr[2]:.0f} (n={sheet_mask.sum()})")
    def tint(s, mask, target, amount=1.0, keep_l=True, lscale=1.0, loff=0.0):
        """recolour `mask` toward an sRGB target, keeping the texel's lightness detail."""
        src = lab(s.c[mask]); t = lab(np.array(target, dtype=np.float64)[None])[0]
        out = src.copy(); out[:, 1:] = t[1:]
        out[:, 0] = (src[:, 0]-src[:, 0].mean())*lscale + (src[:, 0].mean() if keep_l else t[0]) + loff
        s.c[mask] = s.c[mask]*(1-amount) + rgb(out)*amount
    def adjust(s, mask, hue=0.0, sat=1.0, val=1.0, contrast=1.0, pivot=None):
        h = hsv(s.c[mask]); h[:, 0] += hue; h[:, 1] *= sat
        v = h[:, 2]*val; pv = v.mean() if pivot is None else pivot; h[:, 2] = pv + (v-pv)*contrast
        s.c[mask] = hsv2rgb(h)
    def save(s, name="tex.png"):
        im = np.concatenate([np.clip(s.c, 0, 1), s.alpha], -1)[::-1]
        Image.fromarray((im[..., :3]*255+0.5).astype(np.uint8)).save(f"{s.work}/{name}"); print("PAINT_OK", f"{s.work}/{name}")

def soft(m, n=2):
    """grow a texel mask by n texels (closes speckle at region edges)."""
    m = m.copy()
    for _ in range(n): m[1:] |= m[:-1]; m[:-1] |= m[1:]; m[:, 1:] |= m[:, :-1]; m[:, :-1] |= m[:, 1:]
    return m

# ---------------------------------------------------------------- per rod
def cedar(R):
    """leaves: the sheet's deeper green, dark at the twig and light yellow-green at the frond tips."""
    leaf_t = pick(R.c0, hue=(45, 170), sat=(0.12, 1.01))
    leaf_s = pick(R.sheet, hue=(65, 140), sat=(0.35, 1.01), val=(0.2, 1.01))
    R.match(leaf_t, leaf_s, amount=1.0, keep_detail=0.35)
    t = np.clip((R.r[leaf_t] - 0.012) / 0.05, 0, 1)                      # 0 at the twig, 1 at the tips
    L = lab(R.c[leaf_t]); L[:, 0] += 34*(t - 0.45); L[:, 2] += 18*(t - 0.4); L[:, 1] -= 6*t
    R.c[leaf_t] = rgb(L)

def facets(R, mask, twist=9.0, rings=55.0, ribs=6):
    """0..1 shading of a faceted crystal twisted along the rod: a diamond grid on (angle - twist*z, z)."""
    th = np.radians(R.ang[mask]) - twist*R.z[mask]; z = R.z[mask]
    u = th*ribs/(2*np.pi); v = z*rings
    a = np.abs((u+v) % 1 - 0.5); b = np.abs((u-v) % 1 - 0.5)
    return np.clip(a + b, 0, 1)            # 0 at the facet centres, 1 on the ridges

def glass(R):
    """whites: the grip pearl white as the sheet; crystal redone: cool teal to pale aqua facets, white glints."""
    cream = pick(R.c0, hue=(25, 70), sat=(0.05, 0.5), val=(0.5, 1.01)) & (R.z < 0.09) & (R.r < 0.03) & (R.p[..., 1] > -0.024)
    Lc = lab(R.c0[cream])[:, 0]; swirl = np.zeros_like(cream); swirl[cream] = Lc < Lc.mean() - 1.3*Lc.std()
    R.tint(cream, (0.95, 0.94, 0.90), amount=1.0, lscale=0.8, loff=6)
    R.tint(soft(swirl, 1) & cream, (0.20, 0.70, 0.64), amount=0.85, keep_l=False, lscale=0.5)   # the carved swirls teal
    rings = cream & ((R.z < -0.112) | (R.z > 0.042))                      # butt rings and the seat collar: gold
    R.tint(rings, (0.86, 0.69, 0.38), amount=1.0, lscale=1.0, loff=-4)
    teal = pick(R.c0, hue=(130, 210), sat=(0.15, 1.01))
    lantern = (R.p[..., 1] < -0.03) & (R.z < 0.12)                       # the net float hangs toward -y
    cr = teal & ~lantern & (R.z > 0.02)
    f = facets(R, cr, twist=26.0, rings=16.0, ribs=4)
    strand = np.cos(2*(np.radians(R.ang[cr]) - 26.0*R.z[cr]))             # two ribbons twisting round each other
    L0 = lab(R.c0[cr])[:, 0]; d = (L0 - L0.mean())/(L0.std()+1e-6)        # Meshy's own ribbon shading
    deep, mid, pale = np.array([0.05, 0.58, 0.54]), np.array([0.32, 0.82, 0.76]), np.array([0.80, 0.97, 0.95])
    t = np.clip(0.5 + 0.3*np.tanh(2.5*strand) + 0.12*d - 0.25*(f - 0.5), 0, 1)
    col = np.where((t < 0.5)[:, None], deep + (mid-deep)*(t/0.5)[:, None], mid + (pale-mid)*((t-0.5)/0.5)[:, None])
    edge = np.clip(1 - np.abs(strand)/0.18, 0, 1)                        # white where the ribbons meet
    glint = np.clip(np.maximum(edge*0.85, (f - 0.82)/0.18*0.6), 0, 1)[:, None]
    R.c[cr] = col*(1-glint) + np.array([0.96, 1.0, 0.99])*glint
    R.c[lantern & teal] = R.c0[lantern & teal]

def riptide(R):
    """colour correction to the sheet: softer mint grip, navy blank cleared of the old ribbon's smears,
    the reel's pale ring navy and silver, the breaker at the tip teal and blue under white foam."""
    mint = pick(R.c0, hue=(150, 188), sat=(0.25, 1.01), val=(0.55, 1.01)) & (R.z < 0.1)
    R.match(mint, pick(R.sheet, hue=(150, 185), sat=(0.25, 1.01), val=(0.6, 1.01)), keep_detail=0.6)
    navy = pick(R.c0, hue=(195, 240), sat=(0.4, 1.01), val=(0, 0.55))
    zb = np.arange(0.1, 0.86, 0.01); rb = []
    for z in zb:
        m = navy & (np.abs(R.z - z) < 0.015); rb.append(np.median(R.r[m]) if m.sum() > 50 else np.nan)
    rb = np.array(rb); ok = ~np.isnan(rb); rb = np.interp(zb, zb[ok], rb[ok]); rbz = np.interp(R.z, zb, rb)
    smear = ~navy & (R.z > 0.135) & (R.z < 0.83) & (R.r <= rbz + 0.0025)
    nv = R.c0[navy & (R.z > 0.2) & (R.z < 0.8)].mean(0)
    L = lab(R.c0[smear]); t = lab(nv[None])[0]; L[:, 1:] = t[1:]; L[:, 0] = t[0] + (L[:, 0]-L[:, 0].mean())*0.15
    R.c[smear] = rgb(L)
    reel = (R.p[..., 1] < -0.03) & (R.z < 0.1) & (R.z > -0.1)
    pale = reel & pick(R.c0, sat=(0, 0.25), val=(0.55, 1.01))
    R.tint(pale, (0.20, 0.33, 0.56), keep_l=False, lscale=0.9)
    tip = R.z > 0.835
    tw = tip & pick(R.c0, sat=(0, 0.3), val=(0.4, 1.01))
    rr = R.r[tw]; q = np.clip((rr - np.percentile(rr, 30))/(np.percentile(rr, 92) - np.percentile(rr, 30)), 0, 1)
    L = lab(R.c0[tw]); d = (L[:, 0]-L[:, 0].mean())/(L[:, 0].std()+1e-6)
    deep, mid, white = np.array([0.16, 0.50, 0.72]), np.array([0.33, 0.78, 0.80]), np.array([0.96, 0.98, 1.0])
    g = np.clip(q + 0.2*d, 0, 1)[:, None]
    col = np.where(g < 0.4, deep + (mid-deep)*(g/0.4), mid + (white-mid)*np.clip((g-0.4)/0.2, 0, 1))
    R.c[tw] = col

def fit_sphere(P, iters=4, tol=0.006):
    keep = np.ones(len(P), bool)
    for _ in range(iters):
        q = P[keep]; A = np.c_[2*q, np.ones(len(q))]; x = np.linalg.lstsq(A, (q**2).sum(1), rcond=None)[0]
        c = x[:3]; r = float(np.sqrt(x[3] + c @ c)); keep = np.abs(np.linalg.norm(P - c, axis=1) - r) < tol
    return c, r, keep

def tempest(R):
    """the storm-globe reel deep blue with a bright swirl and white clouds; the crank and bands silver; the grip
    charcoal violet; the ice chain the sheet's stronger blue."""
    import json
    ice = pick(R.c0, hue=(190, 225), sat=(0.2, 1.01), val=(0.3, 1.01)) & (R.z > 0.02)
    R.match(ice, pick(R.sheet, hue=(190, 225), sat=(0.25, 1.01), val=(0.3, 1.01)), keep_detail=0.8)
    near = (R.p[..., 1] < -0.035) & (R.z > -0.035) & (R.z < 0.105) & (np.abs(R.p[..., 0]) < 0.06)
    blue = pick(R.c0, hue=(195, 235), sat=(0.3, 1.01))
    c, r, k = fit_sphere(R.p[near & blue][::5], tol=0.004)
    d = np.linalg.norm(R.p - c, axis=-1); globe = near & (np.abs(d - r) < 0.012) & ~pick(R.c0, sat=(0, 0.12), val=(0.85, 1.01)) | (near & blue & (np.abs(d - r) < 0.012))
    json.dump({"c": c.tolist(), "r": r}, open(f"{R.work}/globe.json", "w")); print("GLOBE", c.round(4), round(r, 4), globe.sum())
    P = (R.p[globe] - c)/r                                                # on the unit globe; its face looks along -x
    th = np.arctan2(P[:, 1], -P[:, 2]); rho = np.clip(np.hypot(P[:, 1], P[:, 2]), 0, 1)
    face = np.clip(-P[:, 0], 0, 1)                                         # 1 at the face centre
    spiral = 0.5 + 0.5*np.sin(th*2 + rho*9.0)
    t = np.clip(0.12 + 0.9*face**1.5*(0.35 + 0.65*spiral) - 0.2*rho**3, 0, 1)[:, None]
    deep, bright, glow = np.array([0.10, 0.26, 0.66]), np.array([0.24, 0.60, 0.98]), np.array([0.72, 0.92, 1.0])
    col = np.where(t < 0.6, deep + (bright-deep)*(t/0.6), bright + (glow-bright)*((t-0.6)/0.4))
    L = lab(R.c0[globe])[:, 0]; q = np.clip((L - np.percentile(L, 5))/(np.percentile(L, 97) - np.percentile(L, 5)), 0, 1)
    up = (P @ np.array([0, 0.8, -0.6]))                                    # the rod side and the grip side: clouds
    cl = np.clip((q - 0.6)/0.12, 0, 1)*np.clip((up + 0.1)/0.25, 0, 1)
    R.c[globe] = col*(1-cl[:, None]) + np.array([0.96, 0.97, 1.0])*cl[:, None]
    white_t = pick(R.c0, sat=(0, 0.18), val=(0.62, 1.01)) & ~globe & (R.z < 0.12)
    R.tint(white_t, (0.80, 0.83, 0.89), lscale=1.8, loff=-12)               # bands, guard and crank: silver
    grip = pick(R.c0, val=(0, 0.32)) & (R.z < 0.06) & (R.r < 0.03)
    R.tint(grip, (0.24, 0.22, 0.31), keep_l=False, lscale=1.3)

def tidewarden(R):
    """whites to the sheet's pearl (near white, a faint lilac, aqua and pink sheen instead of Meshy's flat pink),
    the gold deeper, the gems the sheet's teal, the coral pale coral pink, the prongs aqua to blue crystal."""
    gold = pick(R.c0, hue=(25, 60), sat=(0.38, 1.01), val=(0.3, 1.01))
    teal = pick(R.c0, hue=(160, 215), sat=(0.25, 1.01), val=(0.3, 1.01))
    pearl = pick(R.c0, sat=(0, 0.38), val=(0.6, 1.01)) & ~gold & ~teal
    coral = (R.z > 0.79) & (R.r > 0.013) & pick(R.c0, hue=(10, 60), sat=(0.08, 0.62), val=(0.55, 1.01)) & ~teal
    pearl &= ~coral; gold &= ~coral
    h = hsv(R.c0[pearl]); L = lab(R.c0[pearl]); Lm = L[:, 0]
    ph = 3*R.z[pearl]*14 + np.radians(R.ang[pearl])                     # a slow sheen round and along the rod
    tint = np.stack([np.cos(ph), np.cos(ph + 2.1), np.cos(ph + 4.2)], -1)  # lilac, aqua, pink in turn
    a_b = np.array([[10, -9], [-4, -3], [9, 3]])                           # Lab a, b of each sheen
    w = np.clip(tint, 0, None); w /= w.sum(1, keepdims=True) + 1e-6
    out = np.stack([np.clip(Lm*0.75 + 25, 0, 100), (w @ a_b)[:, 0]*0.9, (w @ a_b)[:, 1]*0.9], -1)
    R.c[pearl] = rgb(out)
    R.match(gold, pick(R.sheet, hue=(25, 55), sat=(0.38, 1.01), val=(0.35, 1.01)), keep_detail=0.75, lshift=9)
    R.match(teal & (R.z < 0.815), pick(R.sheet, hue=(165, 210), sat=(0.3, 1.01), val=(0.35, 1.01)), keep_detail=0.7)
    R.tint(coral, (0.97, 0.78, 0.74), lscale=0.9)
    prong = teal & (R.z >= 0.815)
    t = np.clip((R.z[prong] - 0.83)/0.11, 0, 1)[:, None]; d = lab(R.c0[prong])[:, 0]; d = ((d - d.mean())/(d.std()+1e-6))[:, None]
    base, tip = np.array([0.45, 0.92, 0.86]), np.array([0.16, 0.46, 0.95])
    col = base*(1-t) + tip*t; col = np.clip(col + 0.08*d, 0, 1)
    R.c[prong] = col

def titanium(R):
    """the old Titanium's anodised purple (744ce9008: blue-violet to purple under a thin film; 866c3dbce's lilac):
    the steel keeps Meshy's light and shade, its colour becomes violet, bluer at the fork and reel, lilac toward
    the tip; the cyan collars stay."""
    cyan = pick(R.c0, hue=(160, 210), sat=(0.15, 1.01), val=(0.3, 1.01))
    metal = ~cyan
    L = lab(R.c0[metal]); t = np.clip((R.z[metal] + 0.05)/0.9, 0, 1)        # 0 at the fork and reel, 1 at the tip
    l = np.clip((L[:, 0] - 20)/75, 0, 1)                                    # shade 0 .. highlight 1
    a = 22 + 8*t - 9*l; b = -42 + 12*t + 16*l                                # blue-violet shade, lilac light
    out = np.stack([L[:, 0]*0.92 + 2, a, b], -1)
    R.c[metal] = rgb(out)
    R.adjust(cyan, sat=1.25, val=1.05)

def lighthouse(R):
    """colour back to the approved colour views (brass, red, cream); the side profile's smeared ghost windows (+y,
    and -y behind the reel) replaced by the front's crisp windows (copied round the tower at the same height); the
    far-side seat porthole painted over in the seat's brass (its bulge is pressed flush in touch_build)."""
    from PIL import Image
    ref = []
    for n in ("colour-front", "colour-side"):
        im = np.asarray(Image.open(f"{REFS}/{n}.jpg").convert("RGB"), dtype=np.float64)/255
        c = im.reshape(-1, 3); h = hsv(c); ref.append(c[~((h[:, 1] < 0.15) & (h[:, 2] < 0.35))])
    R.sheet = np.concatenate(ref)
    tower = (R.z > 0.27) & (R.z < 0.98) & (R.r < 0.03)
    # side windows first, from the untouched colours: the front's (-x, angle 180) copied to +y and -y
    front = tower & (np.abs(((R.ang - 180 + 180) % 360) - 180) < 42)
    dz, da = 0.0009, 0.9
    fz = np.round(R.z[front]/dz).astype(int); fa = np.round((((R.ang[front] - 180 + 180) % 360) - 180)/da).astype(int)
    key = fz*1000 + fa + 500; order = np.argsort(key); ks = key[order]; cs = R.c0[front][order]
    u, st = np.unique(ks, return_index=True); en = np.r_[st[1:], len(ks)]
    table = {int(k): np.median(cs[a_:b_], 0) for k, a_, b_ in zip(u, st, en)}
    src = R.c0.copy()
    for face in (90, -90):                                  # +y is the colour views' side profile, -y behind the reel
        side = tower & (np.abs(((R.ang - face + 180) % 360) - 180) < 38)
        sz = np.round(R.z[side]/dz).astype(int); sa = np.round((((R.ang[side] - face + 180) % 360) - 180)/da).astype(int)
        out = src[side].copy(); hit = 0
        for i, (z_, a_) in enumerate(zip(sz, sa)):
            for dz_ in (0, 1, -1):
                v = table.get(int((z_+dz_)*1000 + a_ + 500))
                if v is not None: out[i] = v; hit += 1; break
        R.c[side] = out; print("WINDOWS copied to", face, hit, "of", side.sum())
    both = tower & (np.abs(np.abs(R.ang) - 90) < 40)                      # a 3x3 median in the texture: no speckle
    st_ = np.stack([np.roll(np.roll(R.c, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
    R.c[both] = np.median(st_, 0)[both]
    R.c0 = R.c.copy()
    red = pick(R.c0, hue=(335, 20), sat=(0.3, 1.01), val=(0.15, 1.01))
    brass = pick(R.c0, hue=(25, 58), sat=(0.28, 1.01), val=(0.45, 1.01))
    cream = (pick(R.c0, hue=(20, 70), sat=(0.0, 0.28), val=(0.72, 1.01)) | pick(R.c0, sat=(0, 0.08), val=(0.8, 1.01))) & ~brass
    port = (R.z > 0.16) & (R.z < 0.232) & (R.p[..., 1] > 0.012) & (np.abs(((R.ang - 90 + 180) % 360) - 180) < 70)
    R.match(red, pick(R.sheet, hue=(340, 15), sat=(0.45, 1.01), val=(0.3, 1.01)), keep_detail=0.7)
    R.match(brass | port, pick(R.sheet, hue=(28, 50), sat=(0.45, 1.01), val=(0.45, 1.01)), keep_detail=0.7)
    R.match(cream & ~port, pick(R.sheet, hue=(25, 60), sat=(0.05, 0.3), val=(0.75, 1.01)), keep_detail=0.8)
REFS = "/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/fishing/specs/evidence/style-anchor/lighthouse-views"

ROD = {"cedar": cedar, "glass": glass, "riptide": riptide, "tempest": tempest, "tidewarden": tidewarden, "titanium": titanium, "lighthouse": lighthouse}
if __name__ == "__main__":
    rod, work, sheetdir = sys.argv[1:4]
    R = Rod(work, sheetdir, ("w-a", "w-b") if rod == "training-2" else ("side", "top", "threequarter")) if rod != "lighthouse" else Rod(work, sheetdir, ())
    ROD.get(rod, lambda R: None)(R); R.save()
