#!/bin/bash
# lowall.sh <rod:tris>... : cut-down game copies (touch_low.py), renders, compose high | low
cd /private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/touch
S=~/Developer/uwotsi/.claude/worktrees/rod-touchup/art/pipeline/meshy_rods; B=/Applications/Blender.app/Contents/MacOS/Blender
for job in "$@"; do r=${job%%:*}; n=${job##*:}
  src=$r/out.glb; out=$r/low.glb
  [ $r = cedar-fx ] && src=cedar/fx.glb && out=cedar/fxlow.glb
  $B -b --factory-startup -P $S/touch_low.py -- $PWD/$src $PWD/$out $n 2>&1 | grep -E "^LOW|Error|Traceback"
  [ $r = titanium ] && python3 -I $S/patch_ir.py $out
  [ $r = cedar-fx ] && continue
  fx=-; [ $r = cedar ] && fx=$PWD/cedar/fxlow.glb
  ./views.sh $out $PWD/$r/lo $fx
  hfx=-; [ $r = cedar ] && hfx=$PWD/cedar/fx.glb
  ./compose.sh $r $r/cl.jpg $r/t $r/lo
done
