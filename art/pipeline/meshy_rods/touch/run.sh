#!/bin/bash
# run.sh <rod> : paint, build (blender), views of the build, compose sheet | raw | touched
cd /private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/touch
S=~/Developer/uwotsi/.claude/worktrees/rod-touchup/art/pipeline/meshy_rods; r=$1
sd=../meshy/$r; [ $r = training-2 ] && sd=../meshy/training-2
python3 -I $S/touch_paint.py $r $r $sd 2>&1 | grep -E "MATCH|WINDOWS|GLOBE|PAINT_OK|Error|Trace" | cut -c1-200 || exit 1
FX=-; FXJ='{}'
[ $r = cedar ] && FX=$r/fx.glb && FXJ='{"spark":"#CFF3A6","sparkSprite":"glow","sparkEvery":0.5,"sparkSize":0.035,"sparkRise":0.18}'
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P $S/touch_build.py -- $r $r $r/out.glb $FX "$FXJ" 2>&1 | grep -E "^(REEL|PRONG|CRESTS|PORTHOLE|ROUNDED|GLOBE|CUT|FRONDS|WAVE|BLANK_R|TAMED|SMOOTHED|DELETED|LEAVES|FX|ROD|BUILD_OK|NOTE)|Error|Traceback|line [0-9]" | cut -c1-300
[ $r = titanium ] && python3 -I $S/patch_ir.py $r/out.glb
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P $S/touch_view.py -- $r/out.glb $r/t - $FX 2>&1 | grep -E "Error|Traceback"
./compose.sh $r $r/c.jpg $r/raw $r/t
