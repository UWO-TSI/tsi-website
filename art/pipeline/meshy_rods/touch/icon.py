"""blender -b --factory-startup -P icon.py -- <key>...  (ASSETS=web/public/assets/, OUT=dir): 256 px rod icons as rod-meshy rendered them (scratchpad icon_fx.py)."""
import bpy, sys, math
from mathutils import Vector, Matrix
import os
W=os.environ["ASSETS"]
for key in sys.argv[sys.argv.index("--")+1:]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=W+f"game/tools/rod-{key}.glb")
    if key == "cedar": bpy.ops.import_scene.gltf(filepath=W+"game/props/rodfx-cedar-boughs.glb")
    obs=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    root=bpy.data.objects.new("r",None); bpy.context.scene.collection.objects.link(root)
    for o in bpy.context.scene.objects:
        if o.parent is None and o!=root: o.parent=root
    bpy.context.view_layer.update()
    pts=[o.matrix_world@Vector(c) for o in obs for c in o.bound_box]
    mn=Vector([min(p[i] for p in pts) for i in range(3)]); mx=Vector([max(p[i] for p in pts) for i in range(3)])
    ax=max(range(3),key=lambda i:mx[i]-mn[i]); c=(mn+mx)/2
    root.location=-c; bpy.context.view_layer.update()
    spin=float(os.environ.get('SPIN_'+key.replace('-','_'), 0))      # turn the rod about its own axis (Tidewarden: its shell reel to the camera)
    if spin:
        for o in obs: o.matrix_world = Matrix.Rotation(math.radians(spin), 4, 'Z') @ o.matrix_world
        bpy.context.view_layer.update()
    # lay long axis along view diagonal
    if ax==1: root.rotation_euler=(0,0,0)
    cam=bpy.data.cameras.new("c"); cam.type="ORTHO"; cam.ortho_scale=(mx[ax]-mn[ax])*0.78
    co=bpy.data.objects.new("c",cam); bpy.context.scene.collection.objects.link(co)
    # camera looking along +X axis toward origin, rolled so long axis (Y or Z) is diagonal
    co.location=(6,0,0); co.rotation_euler=(math.radians(90),0,math.radians(90))
    if ax==2: co.rotation_euler.rotate_axis("Z",0)
    co.rotation_euler=(co.rotation_euler.to_matrix()@Matrix.Rotation(math.radians(-45 if ax==2 else 45),3,"Z")).to_euler()
    bpy.context.scene.camera=co
    l=bpy.data.lights.new("s","SUN"); l.energy=3.5; lo=bpy.data.objects.new("s",l); lo.rotation_euler=(0.6,0.3,0.8); bpy.context.scene.collection.objects.link(lo)
    w=bpy.data.worlds.new("w"); w.color=(0.6,0.6,0.6); bpy.context.scene.world=w
    r=bpy.context.scene.render; r.resolution_x=r.resolution_y=256; r.film_transparent=True
    try: r.engine="BLENDER_EEVEE_NEXT"
    except TypeError: r.engine="BLENDER_EEVEE"
    r.filepath=os.environ["OUT"]+f"/icon-{key}.png"
    bpy.ops.render.render(write_still=True)
