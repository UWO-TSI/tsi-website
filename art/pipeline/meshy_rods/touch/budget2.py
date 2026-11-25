import re, sys
p=sys.argv[1]; s=open(p).read()
W='game copy cut down from the Blender-touched raw Meshy model, colour baked on 1024 (rod-touchup round 2, 2026-11-25)'
rows={
 "game/tools/rod-5.glb": (10000, "Tidewarden: "+W),
 "game/props/rodfx-cedar-boughs.glb": (10000, "the Cedar's swaying leaves, cut down with the rod (rod-touchup round 2)"),
 "game/tools/rod-cedar.glb": (7000, W), "game/tools/rod-glass.glb": (8000, W), "game/tools/rod-lighthouse.glb": (9000, W),
 "game/tools/rod-riptide.glb": (10000, W), "game/tools/rod-tempest.glb": (8000, W), "game/tools/rod-titanium.glb": (8000, W),
 "game/tools/rod-training-2.glb": (8000, W),
}
for k,(t,why) in rows.items():
    pat=re.compile(r'  "'+re.escape(k)+r'": \{[^\n]*\},\n'); assert pat.search(s), k
    s=pat.sub(lambda m: f'  "{k}": {{ triangles: {t}, texture: 1024, why: "{why}" }},\n', s)
open(p,"w").write(s)
