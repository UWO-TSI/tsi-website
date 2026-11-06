"""Round 11 evidence sheets (tutorial-v2): before (round 10's evidence) beside after, strips, close-ups at 1x and 2x."""
import sys
from PIL import Image, ImageDraw
WT = "/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/tutorial-v2"
V10, OUT = f"{WT}/specs/evidence/tutorial-v2/v10", f"{WT}/specs/evidence/tutorial-v2/v11"
SP = "/private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/phone11"
S3, S4 = f"{SP}/s3", f"{SP}/s4"
o = lambda p: Image.open(p).convert("RGB")
def row(ims, gap=12, bg="white"):
    H = max(i.height for i in ims); c = Image.new("RGB", (sum(i.width for i in ims) + gap * (len(ims) - 1), H), bg); x = 0
    for i in ims: c.paste(i, (x, 0)); x += i.width + gap
    return c
def save(im, name): im.save(f"{OUT}/{name}.webp", quality=88, method=6); print(name, im.size)
near = lambda im, k: im.resize((round(im.width * k), round(im.height * k)), Image.NEAREST)

# The phone beside the world, before and after: desktop (both at round 10's 1280x800) and the phone screen (2x device).
before = o(f"{V10}/t10-desktop-grid.webp").crop((760, 260, 1280, 800))
after = o(f"{S4}/u-phone.png").resize((1280, 800), Image.LANCZOS).crop((760, 260, 1280, 800))
save(row([before, after]), "t11-desktop-before-after")
save(row([o(f"{V10}/t10-phone-grid.webp").resize((390, 844), Image.LANCZOS), o(f"{S3}/p-phone.png").resize((390, 844), Image.LANCZOS)]), "t11-phone-before-after")
# The phone close up at its real pixel size, before and after, and the screens at 2x (nearest, so each pixel shows).
b, a = o(f"{V10}/t10-desktop-grid-close.webp"), o(f"{S4}/u-phone-close.png")
save(row([b, a]), "t11-close-before-after-1x")
save(row([near(b.crop((90, 45, 255, 245)), 2), near(o(f"{S4}/u-screen.png"), 2)]), "t11-screen-before-after-2x")
# The highlighted tile: at rest, hovered (Bag), the keyboard's pick with the hand (Friends), at 2x.
save(row([near(o(f"{S4}/u-{n}.png"), 2) for n in ("screen", "hover", "pick")]), "t11-highlight-2x")
# The slide with the new screen, up and away, desktop; and up on the phone screen.
strip = lambda d, n, idx, w: row([o(f"{d}/{n}-f{i:02d}.png").resize((w, round(w * Image.open(f"{d}/{n}-f{i:02d}.png").height / Image.open(f"{d}/{n}-f{i:02d}.png").width)), Image.LANCZOS) for i in idx], 6)
save(strip(S4, "u-slide", (1, 2, 3, 4, 5, 6, 7, 8, 9, 10), 280), "t11-slide-strip")
save(strip(S4, "u-away", (1, 2, 3, 4, 5, 6, 7), 280), "t11-away-strip")
save(strip(S3, "p-slide", (1, 3, 4, 5, 6, 7, 8, 10), 195), "t11-phone-slide-strip")
# The phone screen's grid close (real device pixels, 2x) and an app open and back.
save(o(f"{S3}/p-phone-close.png"), "t11-phone-close")
save(row([o(f"{S4}/u-app-mail.png").resize((720, 450), Image.LANCZOS), o(f"{S4}/u-back.png").resize((720, 450), Image.LANCZOS)]), "t11-desktop-app-back")
save(row([o(f"{S3}/p-app-mail.png").resize((390, 844), Image.LANCZOS), o(f"{S3}/p-back.png").resize((390, 844), Image.LANCZOS)]), "t11-phone-app-back")
# A short window (1440x780): the open phone's top under the wallet's slot (round 10 reached it by about 12 px).
s = o(f"{S3}/s-phone.png").crop((1040, 300, 1440, 780)); d = ImageDraw.Draw(s); d.line((0, 80, 400, 80), fill=(220, 40, 40), width=1)
save(s, "t11-short-window")
# The pixel finish off in the settings: the body smooth, the screen still pixel art; beside it on.
save(row([o(f"{S4}/u-phone-close.png"), o(f"{S3}/m-phone-close.png")]), "t11-finish-on-off")
save(o(f"{SP}/s2/r-60ms.png"), "t11-reduced-60ms")
# Review only (never in git): the reference's style beside our screen.
ref = o(f"{WT}/specs/references/phone/phone-ui-ref.png")
row([near(ref, 1.5), near(o(f"{S4}/u-screen.png"), 3)]).save(f"{SP}/t11-ref-beside-screen.webp", quality=88); print("ref sheet in scratchpad")
