#!/bin/bash
# hz.sh <src> <outprefix> <rod-for-crop> : 3x renders, crop grip/reel end (bottom 30%) of side, top, 3/4, stacked
cd /private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/touch
S=~/Developer/uwotsi/.claude/worktrees/rod-touchup/art/pipeline/meshy_rods
RES=3 /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P $S/touch_view.py -- $1 $PWD/$2 - 2>&1 | grep -E "Error"
Y0=${Y0:-3200}; H=${H:-1600}
for v in side top threequarter; do magick $2-$v.png -background white -flatten -crop 1200x$H+0+$Y0 +repage -rotate 90 $2-h-$v.png; done
magick $2-h-side.png $2-h-top.png $2-h-threequarter.png -append -resize 50% $2-h.jpg
