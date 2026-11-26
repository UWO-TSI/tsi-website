#!/bin/bash
cd /private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad
S=~/Developer/uwotsi/.claude/worktrees/rod-touchup/art/pipeline/meshy_rods; B=/Applications/Blender.app/Contents/MacOS/Blender
p(){ echo "== $1"; $B -b --factory-startup -P $S/touch_prep.py -- meshy/dl/$1-hi.glb meshy/old/$2.glb touch/cur/$2.glb touch/$1 "$3" 2>&1 | grep -E "FIT|COVER|PREP_OK|Error|Traceback"; }
for r in "$@"; do case $r in
cedar) p cedar rod-cedar '{"reel_deg":30}';;
glass) p glass rod-glass '{"length":1.12}';;
riptide) p riptide rod-riptide '{}';;
tempest) p tempest rod-tempest '{}';;
tidewarden) p tidewarden rod-5 '{}';;
titanium) p titanium rod-titanium '{}';;
training-2) p training-2 rod-training-2 '{}';;
esac; done
