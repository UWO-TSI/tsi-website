"""avatar v8: the milestone-1 accessories in one review file (art/characters/v8/accessories_v8.blend).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/v8/review_blend.py

Builds, from the same code as the export (accessories/acc_v8.py, accessories/hair_acc.py, v7/hair_build.py), static
meshes on copies of the v7 head and the v6 body: the beanie (with its hair tuck) over the straight fringe, the backpack
on a bob, the claw clip and the bow on the bob's anchors, the scrunchie on the high pony's, and each hair accessory
alone in anchor space (x across, y along the hair toward its root, z out). Review only; the GLBs come from
build_accessories.py.
"""
import bpy, os, sys
from mathutils import Matrix

V8 = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(V8)
for p in (V8, os.path.join(ART, "v7"), ART, os.path.join(ART, "base"), os.path.join(ART, "accessories")):
    sys.path.insert(0, p)
bpy.ops.wm.read_factory_settings(use_empty=True)
import kit, locks, hair_styles as hs, hair_build, anchors, acc_v8, hair_acc  # noqa: E402

sc = bpy.context.scene
with bpy.data.libraries.load(os.path.join(ART, "base", "v6.blend"), link=False) as (src, dst):
    dst.objects = [n for n in src.objects if n in ("V6_Body", "V6_Top", "V6_Bottom")]
with bpy.data.libraries.load(os.path.join(ART, "v7", "head.blend"), link=False) as (src, dst2):
    dst2.objects = ["V7_Head"]
head = dst2.objects[0]
body = list(dst.objects)
PAL = kit.PAL["outfit"]
mats = {"M_Main": kit.material("M_Main", PAL[7]), "M_Accent": kit.material("M_Accent", PAL[0]), "M_Trim": kit.material("M_Trim", PAL[5]),
        "M_Hair": kit.material("M_Hair", kit.PAL["hair"][2])}
surf = locks.Surface(head)


def figure(name, x, with_body=True):
    coll = bpy.data.collections.new(name)
    sc.collection.children.link(coll)
    for ob in [head] + (body if with_body else []):
        c = bpy.data.objects.new(f"{name}_{ob.name}", ob.data)
        c.location.x = x
        coll.objects.link(c)
    return coll


def put(coll, ob, m):
    for c in ob.users_collection:
        c.objects.unlink(ob)
    coll.objects.link(ob)
    ob.matrix_world = m


def hair(coll, pid, x):
    ob = hair_build.piece(pid, None, mats["M_Hair"], name=f"{coll.name}_{pid}", head=head)
    frames = anchors.frames_of(pid, ob)
    put(coll, ob, Matrix.Translation((x, 0, 0)))
    return frames


def part(coll, fn, m, mat="M_Main"):
    pc = kit.Piece(region="head", mat=mat)
    fn(pc)
    ob = pc.finish(f"{coll.name}_{fn.__name__}", None, mats, sharp=50, grad=(0.85, 1.0), **acc_v8.organic_hooks(pc, head))
    put(coll, ob, m)


def tuck(pc, edge):
    t, _, _ = kit.hair_cap(lambda lon: -40 if abs(lon) >= 100 else -30, top=lambda lon: edge(lon) + 16, outer=hs.cap_outer,
                           hem=hs.CAP_FLOOR, lons=[24 * k - 180 for k in range(15)])
    for f in t.since(0):
        t.fuv[f] = {v: (0.0, 0.5) for v in f.verts}
    for lk in hs.tuck(edge):
        locks.sweep(t, locks.lock_of_seed(lk), surf)
    for f in t.fmat:
        t.fmat[f] = "M_Hair"
    keep, pc.mat = pc.mat, "M_Hair"
    kit.merge_piece(pc, t)
    pc.mat = keep


c = figure("beanie", 0.0)
hair(c, "bangs_straight", 0.0)
part(c, lambda pc: acc_v8.beanie(pc, lambda e: tuck(pc, e)), Matrix.Translation((0, 0, 0)))
c = figure("backpack_bow_clip", 0.8)
fr = {**hair(c, "bangs_straight", 0.8), **hair(c, "back_bob", 0.8)}
part(c, acc_v8.backpack, Matrix.Translation((0.8, 0, 0)))
for fn, name in ((hair_acc.bow, "side"), (hair_acc.claw_clip, "crown")):
    for m, r, h in fr[name]:
        part(c, fn, Matrix.Translation((0.8, 0, 0)) @ m @ Matrix.Translation((0, 0, h)))
c = figure("scrunchie_pony", 1.6, with_body=False)
fr = {**hair(c, "bangs_swept_l", 1.6), **hair(c, "back_high_pony", 1.6)}
for m, r, h in fr["pony"]:
    part(c, hair_acc.scrunchie, Matrix.Translation((1.6, 0, 0)) @ m @ Matrix.Scale(r / hair_acc.RING, 4))
c = bpy.data.collections.new("anchor_space")
sc.collection.children.link(c)
for i, fn in enumerate((hair_acc.claw_clip, hair_acc.bow, hair_acc.scrunchie)):
    part(c, fn, Matrix.Translation((2.4 + 0.25 * i, 0, 1.0)))
out = os.path.join(V8, "accessories_v8.blend")
bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
print("WROTE", out, len(bpy.data.objects))
