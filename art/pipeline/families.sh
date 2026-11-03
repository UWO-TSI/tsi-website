#!/bin/sh
# The Round 1 families (art/pipeline/tools.md, steps 1 and 2): `families.sh profile` renders and measures them in
# headless Blender (under the Blender lock; exit 75 means retry), then every run rebuilds the four collages.
cd "$(dirname "$0")/../.." || exit 1
if [ "$1" = profile ]; then
  B="/Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/pipeline/profile.py --"
  T=web/public/assets/game/tools W=web/public/assets/game/weapons F=web/public/assets/acnh/fish
  $B --out art/pipeline/out/rods --px 800 $T/rod-1.glb $T/rod-2.glb $T/rod-3.glb $T/rod-4.glb $T/rod-5.glb || exit $?
  $B --out art/pipeline/out/fish --px 420 --fit --scale 1 $F/neon-tetra.glb $F/dace.glb@x90 $F/bluegill.glb@x90 $F/salmon.glb \
    $F/pike.glb $F/ray.glb $F/golden-trout.glb $F/whale-shark.glb || exit $?
  $B --out art/pipeline/out/gear/tools --px 640 $T/net-1.glb $T/net-3.glb $T/net-5.glb $T/shovel-1.glb $T/shovel-3.glb \
    $T/shovel-5.glb $T/pickaxe-1.glb $T/broom.glb $T/sushi-knife.glb || exit $?
  $B --out art/pipeline/out/gear/weapons --px 640 $W/sword-iron.glb $W/warhammer-rune.glb $W/tanto-lotus.glb $W/aegis-gilt.glb \
    $W/bow-yew.glb $W/rifle-3.glb $W/harpoon-5.glb $W/living-staff-5.glb $W/prism-staff-5.glb $W/bone-tome-3.glb \
    $W/seal-gloves-3.glb $W/kunai.glb || exit $?
fi
C="python3 art/pipeline/collage.py"
$C art/pipeline/out/rods --title "Rods (tools/rod-1 to rod-5, one scale)" --parts Grip,Reel --cols 5 \
  --labels 'rod-1=Flimsy rod (T1 common),rod-2=Cedar rod (T2 uncommon),rod-3=Glass rod (T3 rare),rod-4=Lighthouse rod (T4 rare),rod-5=Tidewarden rod (T5 epic)'
$C art/pipeline/out/fish --title "Fish (acnh/fish, each framed on its own)" --unit "GLB units" --cols 2 \
  --labels 'neon-tetra=Neon Tetra (common; 3-4 cm),dace=Dace (common; 10-18 cm),bluegill=Bluegill (uncommon; 12-22 cm),salmon=Salmon (uncommon; 50-80 cm),pike=Pike (rare; 50-90 cm),ray=Ray (rare; 100-200 cm),golden-trout=Golden Trout (epic; 40-60 cm),whale-shark=Whale Shark (epic; 400-800 cm)'
$C art/pipeline/out/gear/tools --title "Gear: peaceful tools (tools/, one scale)" \
  --labels 'net-1=Net T1,net-3=Net T3,net-5=Net T5,shovel-1=Shovel T1,shovel-3=Shovel T3,shovel-5=Shovel T5,pickaxe-1=Pickaxe,broom=Broom,sushi-knife=Sushi knife'
$C art/pipeline/out/gear/weapons --title "Gear: weapons (weapons/, one scale)"
