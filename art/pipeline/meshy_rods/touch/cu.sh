#!/bin/bash
# cu.sh <src> <out.jpg> <z0> <z1> <cy> : side and 3/4 close-ups stacked
cd /private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/touch
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b --factory-startup -P scripts/closeup.py -- $1 $PWD/cu-a.png $3 $4 1,0,0 1000 $5 2>&1 | grep Error
$B -b --factory-startup -P scripts/closeup.py -- $1 $PWD/cu-b.png $3 $4 0.825,0.565,-0.15 1000 $5 2>&1 | grep Error
magick $PWD/cu-a.png $PWD/cu-b.png -background white -flatten -append -resize 70% $2
