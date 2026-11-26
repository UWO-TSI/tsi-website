import sys; sys.path.insert(0, sys.argv[1])
from touch_paint import *
import numpy as np
rod=sys.argv[2]; T="/private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad"
R=Rod(f"{T}/touch/{rod}", f"{T}/meshy/{rod}", ("w-a","w-b") if rod=="training-2" else ("side","top","threequarter"))
def show(name, c, z=None, r=None):
    h=hsv(c); m=h[...,1]>0.1
    hist,_=np.histogram(h[m][:,0],bins=range(0,361,20)); print(name,"hue(sat>.1) per 20deg", (hist*1000//max(1,m.sum())).tolist(), "lowsat", round(float((~m).mean()),3))
show("tex", R.c0.reshape(-1,3)); show("sheet", R.sheet)
for spec in sys.argv[3:]:
    n, hue, sat, val = spec.split(":"); hue=tuple(map(float,hue.split(","))) if hue else None
    sat=tuple(map(float,sat.split(","))); val=tuple(map(float,val.split(",")))
    m=pick(R.c0,hue,sat,val); ms=pick(R.sheet,hue,sat,val)
    print(f"{n}: tex n{m.sum()} z{np.percentile(R.z[m],[1,50,99]).round(3)} r{np.percentile(R.r[m],[50,99]).round(3)} rgb{R.c0[m].mean(0).round(2)} | sheet n{ms.sum()} rgb{R.sheet[ms].mean(0).round(2)} std{R.sheet[ms].std(0).round(2)}")
