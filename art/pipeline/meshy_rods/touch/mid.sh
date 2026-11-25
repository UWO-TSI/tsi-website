#!/bin/bash
# mid.sh <src> <out.jpg> [views]: 3x renders, crop the middle 45% of the rod for side and 3/4
cd /private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/touch
S=~/Developer/uwotsi/.claude/worktrees/rod-touchup/art/pipeline/meshy_rods
RES=3 /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P $S/touch_view.py -- $1 $PWD/mid-r - 2>&1 | grep -E "Error"
for v in side top threequarter; do magick mid-r-$v.png -background white -flatten -crop 1200x2200+0+${Y0:-1100} +repage -rotate 90 -resize 50% mid-$v.png; done
magick mid-side.png mid-top.png mid-threequarter.png -append $2
