import re, sys
p=sys.argv[1]; s=open(p).read()
W='raw Meshy model hand-edited in Blender (rod-touchup, David 2026-11-25; no triangle limit while the look is settled)'
rows={
 "game/tools/rod-5.glb": ("triangles: 251000, primitives: 5, texture: 2048", "Tidewarden: "+W+", the nautilus reel modelled"),
 "game/props/rodfx-cedar-boughs.glb": ("triangles: 483000, texture: 2048", "the Cedar's swaying leaves, cut from its raw Meshy model with its texture (rod-touchup)"),
 "game/tools/rod-cedar.glb": ("triangles: 287000, texture: 2048", W),
 "game/tools/rod-glass.glb": ("triangles: 166000, texture: 2048", W),
 "game/tools/rod-lighthouse.glb": ("triangles: 250000, texture: 2048", W),
 "game/tools/rod-riptide.glb": ("triangles: 223000, texture: 2048", W+", the wrapping wave remodelled"),
 "game/tools/rod-tempest.glb": ("triangles: 206000, texture: 2048", W),
 "game/tools/rod-titanium.glb": ("triangles: 181000, texture: 2048", W),
 "game/tools/rod-training-2.glb": ("triangles: 332000, texture: 2048", "raw Meshy model fitted as is (rod-touchup, David 2026-11-25: looks good)"),
}
for k,(v,why) in rows.items():
    pat=re.compile(r'  "'+re.escape(k)+r'": \{[^\n]*\},\n')
    assert pat.search(s), k
    s=pat.sub(lambda m: f'  "{k}": {{ {v}, why: "{why}" }},\n', s)
open(p,"w").write(s)
