#!/bin/bash
# zoom.sh <rod> <prefixA> <prefixB> <out> [frac]: grip ends of side/top/3q, A above B
cd /private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/touch
r=$1; f=${5:-700}; im=()
for v in side top threequarter; do for p in $2 $3; do magick $p-$v.png -background white -flatten -gravity south -crop 400x$f+0+0 +repage -rotate 90 zz-$(basename $p)-$v.png; im+=(zz-$(basename $p)-$v.png); done; done
magick "${im[@]}" -append $4
