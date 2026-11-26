#!/bin/bash
# views.sh <src(.blend|.glb)> <outprefix> [fx.glb] : default side/top/threequarter renders
S=~/Developer/uwotsi/.claude/worktrees/rod-touchup/art/pipeline/meshy_rods
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P $S/touch_view.py -- $1 $2 - ${3:--} 2>&1 | grep -E "Error|Traceback"
