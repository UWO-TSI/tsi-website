#!/bin/sh
# PNG captures -> WebP evidence (q 80), skipping the pair duplicates, plus the measurement JSON.
#   sh specs/evidence/look/towebp.sh /tmp/look/baseline specs/evidence/look/baseline
set -e
mkdir -p "$2"
for f in "$1"/*.png; do
  n=$(basename "$f" .png)
  case "$n" in *-pairA) continue ;; esac
  cwebp -quiet -q 80 "$f" -o "$2/$n.webp"
done
cp "$1"/measure.json "$1"/metrics.json "$2"/
