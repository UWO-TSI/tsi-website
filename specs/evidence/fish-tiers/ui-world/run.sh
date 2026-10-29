#!/bin/bash
# run.sh <out_dir> <tag>: one landed cast (shoot.mjs again while the bot loses the fish), then its strips.
OUT=$1; TAG=$2; D=$(dirname "$0")
for i in 1 2 3 4 5 6; do
  rm -rf "$OUT/frames-$TAG"
  node "$D/shoot.mjs" "$OUT" "$TAG" run && break
done
python3 "$D/cut.py" "$OUT/frames-$TAG" "$OUT" "$TAG"
