#!/bin/bash
# compose.sh <rod> <out.jpg> <prefix1> [prefix2] : rows side, top, threequarter; columns sheet | prefix1 | prefix2 renders
cd /private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/touch
r=$1; out=$2; shift 2; W=${CW:-1000}; rows=()
sheet(){ if [ -f $r/sheet-$1.png ]; then echo $r/sheet-$1.png; elif [ $r = training-2 ]; then case $1 in side) echo ../meshy/training-2/w-a.png;; threequarter) echo ../meshy/training-2/w-b.png;; *) echo none;; esac; else echo ../meshy/$r/$1.png; fi; }
rot(){ if [ $r = training-2 ] && [ $1 != top ]; then echo 63; else echo 90; fi; }
for v in side top threequarter; do
  cells=(); s=$(sheet $v)
  if [ $s = none ]; then magick -size ${W}x200 xc:white -gravity center -font /System/Library/Fonts/Helvetica.ttc -pointsize 28 -annotate 0 "no top view in the refs" c-0.png
  else magick $s -background white -flatten -trim +repage -resize ${W}x${W} c-0.png; fi
  cells+=(c-0.png); i=1
  for p in "$@"; do magick $p-$v.png -background white -flatten -rotate $(rot $v) -trim +repage -resize ${W}x${W} c-$i.png; cells+=(c-$i.png); i=$((i+1)); done
  H=$(magick "${cells[@]}" -format "%h\n" info: | sort -n | tail -1); H=$((H+30))
  for c in "${cells[@]}"; do magick $c -background white -gravity center -extent $((W+30))x$H $c; done
  row=(); for c in "${cells[@]}"; do row+=($c); row+=(-size 6x$H xc:"#999"); done; unset 'row[${#row[@]}-1]'
  magick "${row[@]}" +append -bordercolor "#999" -border 0x3 row-$v.png; rows+=(row-$v.png)
done
magick "${rows[@]}" -append -quality 86 $out
