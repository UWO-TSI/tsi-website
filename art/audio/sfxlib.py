"""The SFX library's build (specs/sfx-library.md): every sound's candidates, cut, levelled, looped and encoded, plus
the manifest the game and the review page read.

  python3 -I art/audio/sfxlib.py            build every candidate into specs/evidence/sfx-library/r1/ and write the manifest
  python3 -I art/audio/sfxlib.py <id> ...   only these sounds (the manifest keeps the others as they were)
  python3 -I art/audio/sfxlib.py --check    validate the manifest: every file there, every licence CC0, levels on target

Sources: `ours:<name>` (art/audio/synth_sfxlib.py), `k:<pack>/<file>` (a Kenney pack in art/audio/staging/kenney),
`fs:<id>` (a Freesound preview in art/audio/staging/freesound, its licence checked on its page by the fetch and logged
in records.tsv), `game:<file>` (a file already in web/public/audio, credited in CREDITS.md / SOURCES.md).
Downloads are data: they are only decoded by ffmpeg here, never run.
"""
import json, os, subprocess, sys
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import synth_sfxlib as synth  # noqa: E402

SR = 48000
STAGE = os.path.join(ROOT, "art/audio/staging")
OUT = os.path.join(ROOT, "specs/evidence/sfx-library/r1")
MANIFEST = os.path.join(ROOT, "web/data/sfx-library.json")
CC0 = "CC0 1.0"
CEILING = -3.0  # true peak, dBFS
TARGET = {"ui": -20, "voice": -20, "rewards": -16, "actions": -18, "ambience": -26}  # LUFS (one-shots: loudest 400 ms; beds: integrated)
LOOP, XF = synth.LOOP, synth.XF

GAME_CREDIT = {  # web/public/audio/CREDITS.md and sfx/SOURCES.md
    "sfx/footstep.ogg": ("https://kenney.nl/assets/rpg-audio", "Kenney"),
    "sfx/confirm.ogg": ("https://kenney.nl/assets/interface-sounds", "Kenney"),
    "sfx/blip1.ogg": ("https://pixel-boy.itch.io/ninja-adventure-asset-pack", "Pixel-boy & AAA"),
    "sfx/coin.ogg": ("art/audio/synth_coin.py", "Tethos (game/fishing-depth)"),
    "sfx/bite.ogg": ("art/audio/synth_bite.py", "Tethos"),
}
for i in range(2, 6):
    GAME_CREDIT[f"sfx/blip{i}.ogg"] = GAME_CREDIT["sfx/blip1.ogg"]


def C(label, src, **o):
    return {"label": label, "src": src, **o}


def S(id, label, category, use, *cands, slot=None):
    return {"id": id, "label": label, "category": category, "use": use, "slot": slot, "candidates": list(cands)}


KI, KR, KM, KU, KD = "k:interface-sounds/Audio/", "k:rpg-audio/Audio/", "k:impact-sounds/Audio/", "k:ui-audio/Audio/", "k:digital-audio/Audio/"
KJ = "k:music-jingles/Audio/"
steps = lambda pre, n=4: [f"{pre}_{i:03d}.ogg" for i in range(n)]

SOUNDS = [
    # UI
    S("ui-tap", "Tap", "ui", "a button or card pressed (varies)", C("Soft tick (ours)", "ours:ui-tap"), C("Wood tock (ours)", "ours:ui-tap-wood"),
      C("Kenney click", KI + "click_002.ogg"), slot=2),
    S("ui-open", "Open", "ui", "a sheet or menu opens", C("Pop up (ours)", "ours:ui-open"), C("Kenney open", KI + "open_001.ogg"),
      C("Kenney book open", KR + "bookOpen.ogg", dur=0.35), slot=2),
    S("ui-close", "Close", "ui", "a sheet or menu closes", C("Pop down (ours)", "ours:ui-close"), C("Kenney close", KI + "close_001.ogg"),
      C("Kenney book close", KR + "bookClose.ogg", dur=0.35), slot=2),
    S("ui-toggle", "Toggle", "ui", "a switch flipped", C("Two clicks (ours)", "ours:ui-toggle"), C("Kenney toggle", KI + "toggle_001.ogg"),
      C("Kenney switch", KU + "switch1.ogg")),
    S("ui-tab", "Tab", "ui", "a tab or page changed", C("Paper flick (ours)", "ours:ui-tab"), C("Kenney page flip", KR + "bookFlip1.ogg", dur=0.4),
      C("Kenney select", KI + "select_001.ogg")),
    S("ui-confirm", "Confirm", "ui", "a choice confirmed", C("Two marimba notes (ours)", "ours:ui-confirm"),
      C("Kenney confirmation", KI + "confirmation_004.ogg"), C("Today's confirm", "game:sfx/confirm.ogg")),
    S("error", "Error", "ui", "can't do that: not enough coins, bag full, too far, locked", C("Bonk-bonk (ours)", "ours:error"),
      C("Kenney bong", KI + "bong_001.ogg"), C("Kenney error", KI + "error_005.ogg"), slot=2),
    # rewards
    S("coin", "Coin", "rewards", "a coin arriving in the wallet", C("Today's coin (ours)", "game:sfx/coin.ogg"),
      C("Kenney coins in hand", KR + "handleCoins2.ogg")),
    S("coin-out", "Coin out", "rewards", "one coin leaving the purse (varies, rising)", C("Dry clink (ours)", "ours:coin-out"),
      C("Kenney light metal", KM + "impactMetal_light_000.ogg", dur=0.12), C("Kenney chip", "k:casino-audio/Audio/chip-lay-1.ogg", dur=0.12), slot=1),
    S("gem", "Gem", "rewards", "a gem landing in the wallet (varies)", C("Glass gem (ours)", "ours:gem"), C("Kenney glass", KI + "glass_002.ogg"),
      C("Rare loot find (LilMati)", "fs:659677", dur=0.4), slot=1),
    S("buy", "Buy", "rewards", "a purchase goes through: the till", C("Ka-ching (ours)", "ours:buy"),
      C("Old till with a bing (clubmydia+)", "fs:584168", start=2.15, dur=0.65),
      C("Coins and a desk bell (Kenney + kyles)", "mix", parts=[(KR + "handleCoins2.ogg", 0, 0.7), ("fs:453763", 0.05, 1.0, 34.35, 0.55)]), slot=1),
    S("sell", "Sell", "rewards", "a sale at the counter: the till drawer slides open", C("Drawer slide (ours)", "ours:sell"),
      C("Old till drawer (clubmydia+)", "fs:584168", start=1.45, dur=0.55), C("Toy till drawer (kyles)", "fs:637735", start=2.1, dur=0.5), slot=2),
    S("bag-thunk", "Bag thunk", "rewards", "a bought or received item dropping into the bag (varies)", C("Cloth bag thump (ours)", "ours:bag-thunk"),
      C("Kenney leather drop", KR + "dropLeather.ogg", dur=0.25), C("Bag of croutons (Anthousai)", "fs:399243", dur=0.25), slot=1),
    S("upgrade", "Upgrade", "rewards", "a tool, tackle or rod moves up a tier", C("Shing and four notes up (ours)", "ours:upgrade"),
      C("Achievement sparkle (SkySpeira)", "fs:715067"),
      C("Blade draw into sparkle (Kenney + SkySpeira)", "mix", parts=[(KR + "drawKnife1.ogg", 0, 1.0), ("fs:715067", 0.18, 0.8)]), slot=1),
    S("stamp", "Stamp", "rewards", "a task or quest step checked off: the stamp lands", C("Stamp thunk (ours)", "ours:stamp"),
      C("Traditional stamp (I.fekry)", "fs:470710", dur=0.22), C("Thump (mpuffenbarger)", "fs:683031", dur=0.22), slot=1),
    S("task-complete", "Task complete", "rewards", "a daily or fishing task finished (after the stamp)", C("Three marimba notes (ours)", "ours:task-complete"),
      C("Kenney pizzicato jingle", KJ + "Pizzicato jingles/jingles_PIZZI10.ogg"), C("Kenney steel drum jingle", KJ + "Steel jingles/jingles_STEEL10.ogg"), slot=1),
    S("quest-complete", "Quest complete", "rewards", "a quest finished: the bigger fanfare", C("Fanfare to a held chord (ours)", "ours:quest-complete"),
      C("Synth fanfare (_def)", "fs:751890"), C("RPG fanfare (colorsCrimsonTears)", "fs:609028", dur=2.5), slot=1),
    S("reward-fly", "Reward fly", "rewards", "a reward leaving its card and flying to its slot (varies)", C("Swish and sparkle (ours)", "ours:reward-fly"),
      C("Wink sparkle (MLaudio)", "fs:511485", dur=0.4), C("Short whoosh (moogy73)", "fs:425706", dur=0.4), slot=1),
    S("item-get", "Item get", "rewards", "any pickup or forage into the hand (varies)", C("Round pop (ours)", "ours:item-get"),
      C("Pop (deraj)", "fs:202230", dur=0.2), C("Cork pop (milcahrawr)", "fs:622150", dur=0.2), slot=2),
    S("level-up", "Level up", "rewards", "the XP ring fills and the level goes up", C("Arpeggio to a bright chord (ours)", "ours:level-up"),
      C("Level up (qubodup)", "fs:442943"), C("Level up (InfiniteLifespan)", "fs:266454", dur=2.5), slot=2),
    S("craft-done", "Craft done", "rewards", "an item comes off the workbench", C("Tool jingle and ta-da (ours)", "ours:craft-done"),
      C("Kenney steel drum jingle", KJ + "Steel jingles/jingles_STEEL15.ogg"),
      C("Hammer knock into a jingle (Kenney)", "mix", parts=[(KM + "impactMetal_light_001.ogg", 0, 0.6), (KJ + "Pizzicato jingles/jingles_PIZZI15.ogg", 0.15, 1.0)]), slot=3),
    S("donate", "Donate", "rewards", "a specimen settles into its museum case", C("Glass chime in a hall (ours)", "ours:donate"),
      C("Chime (Psykoosiossi)", "fs:398661", dur=1.0), C("Kenney glass", KI + "glass_001.ogg"), slot=3),
    # actions
    S("land", "Land", "actions", "the player lands from a jump or a glide (varies)", C("Grass thud (ours)", "ours:land"),
      C("Kenney soft impact", KM + "impactSoft_medium_000.ogg"), C("Kenney grass step", KM + "footstep_grass_000.ogg", dur=0.2), slot=3),
    S("rustle", "Rustle", "actions", "a bush or tree shaken, tall grass walked through (varies)", C("Leaf rustle (ours)", "ours:rustle"),
      C("Game rustle leaves (Fupicat)", "fs:538152", dur=0.6), C("Rustling foliage (sillygrizzlies)", "fs:635053", start=5.55, dur=0.6), slot=3),
    S("splash", "Splash", "actions", "the lure or bobber hits the water; a fish breaks the surface", C("Plop and splash (ours)", "ours:splash"),
      C("Lure plop (el_boss)", "fs:853279"), C("Water (danielpodlovics)", "fs:530359"), slot=3),
    S("place", "Place", "actions", "a furniture piece set down when decorating", C("Wood knock (ours)", "ours:place"),
      C("Kenney wood impact", KM + "impactWood_medium_000.ogg", dur=0.2), C("Kenney book set down", KR + "bookPlace1.ogg", dur=0.22), slot=3),
    S("sit", "Sit", "actions", "sitting down on a seat or bench", C("Cushion and creak (ours)", "ours:sit"),
      C("Kenney heavy soft impact", KM + "impactSoft_heavy_000.ogg", dur=0.25),
      C("Cushion and creak (Kenney)", "mix", parts=[(KM + "impactSoft_medium_000.ogg", 0, 1.0), (KR + "creak1.ogg", 0.02, 0.35, 0, 0.2)]), slot=3),
    S("forage", "Forage", "actions", "a plant pulled or a fruit picked", C("Snap, rustle, pop (ours)", "ours:forage"),
      C("Pull plant (Jofae)", "fs:387083"), C("Kenney pluck", KI + "pluck_001.ogg")),
    S("dig", "Dig", "actions", "the spade into the ground", C("Spade crunch (ours)", "ours:dig"),
      C("Digging wet sand (f3bbbo)", "fs:651293", dur=0.5), C("Shovel dirt (dr19)", "fs:353907", start=0.25, dur=0.6)),
    S("cast", "Cast", "actions", "the rod's cast: the whoosh and the line running out", C("Whoosh and line (ours)", "ours:cast"),
      C("Fishing rod cast (mwchristian95)", "fs:725426"), C("Casting a fishing rod (el_boss)", "fs:853287", dur=1.2)),
    S("fish-escape", "Fish escape", "actions", "a fish gets off the line", C("Splash and a soft \"aw\" (ours)", "ours:fish-escape"),
      C("Lure plop and two notes down (el_boss + Kenney)", "mix", parts=[("fs:853279", 0, 1.0), (KJ + "Pizzicato jingles/jingles_PIZZI09.ogg", 0.15, 0.6)]),
      C("Water and two notes down (danielpodlovics + Kenney)", "mix", parts=[("fs:530359", 0, 1.0), (KJ + "Steel jingles/jingles_STEEL09.ogg", 0.15, 0.5)]), slot=3),
    S("equip", "Equip", "actions", "fitting tackle on the rod (lower for taking it off; varies)", C("Clip and ping (ours)", "ours:equip"),
      C("Kenney metal click", KR + "metalClick.ogg", dur=0.3), C("Kenney metal latch", KR + "metalLatch.ogg", dur=0.3), slot=2),
    S("bite", "Bite", "actions", "the bite's \"!\"", C("Today's bite (ours)", "game:sfx/bite.ogg"), C("Kenney question", KI + "question_001.ogg"),
      C("Kenney pep", KD + "pepSound1.ogg")),
    S("reel", "Reel", "actions", "reeling in: the ratchet", C("Ratchet (ours)", "ours:reel"), C("Fishing reel winding (1bob)", "fs:831928", dur=1.0),
      C("Fly reel slow wind (paulprit)", "fs:507078", start=0.45, dur=1.0)),
    S("catch", "Catch", "actions", "the fish pulled out of the water", C("Splash out and two notes (ours)", "ours:catch"),
      C("Splash (swordofkings128)", "fs:398032"),
      C("Splash and a chime (swordofkings128 + Kenney)", "mix", parts=[("fs:398032", 0, 1.0), (KI + "confirmation_002.ogg", 0.18, 0.6)])),
    S("jump", "Jump", "actions", "the player jumps", C("Whoosh up (ours)", "ours:jump"), C("Kenney cloth", KR + "cloth1.ogg", dur=0.3),
      C("Today's jump (blip2)", "game:sfx/blip2.ogg")),
    S("footstep-grass", "Footsteps: grass", "actions", "walking on grass (four steps, the game picks one per step)", C("Grass (ours)", "ours:footstep-grass"),
      C("Kenney grass", "seq", seq=[KM + f for f in steps("footstep_grass")]), C("Today's footstep", "seq", seq=["game:sfx/footstep.ogg"] * 4)),
    S("footstep-wood", "Footsteps: wood", "actions", "walking on boards and floors", C("Wood (ours)", "ours:footstep-wood"),
      C("Kenney wood", "seq", seq=[KM + f for f in steps("footstep_wood")]), C("Kenney carpet", "seq", seq=[KM + f for f in steps("footstep_carpet")])),
    S("footstep-stone", "Footsteps: stone", "actions", "walking on stone, paths and tile", C("Stone (ours)", "ours:footstep-stone"),
      C("Kenney concrete", "seq", seq=[KM + f for f in steps("footstep_concrete")])),
    S("footstep-sand", "Footsteps: sand", "actions", "walking on the beach", C("Sand (ours)", "ours:footstep-sand"),
      C("Walking in beach sand (21100495)", "fs:655366", start=3.0, dur=2.3), C("Kenney snow (as sand)", "seq", seq=[KM + f for f in steps("footstep_snow")])),
    S("footstep-water", "Footsteps: shallow water", "actions", "wading through shallows and puddles", C("Shallows (ours)", "ours:footstep-water"),
      C("Small puddle splash (Robo9418)", "seq", seq=["fs:841834"] * 4)),
    # voice
    S("voice-blip", "Talk blips", "voice", "an NPC's line of dialogue, one blip per letter group", C("Today's blips (Ninja Adventure)", "seq", gap=0.09,
      seq=[f"game:sfx/blip{i}.ogg" for i in (1, 3, 2, 5, 4, 1, 2, 3)]), C("Vowel blips (ours)", "ours:voice-blip"), C("Kalimba blips (ours)", "ours:voice-kalimba")),
    # ambience
    S("amb-sea", "Open sea", "ambience", "the sea all round the island", C("Sea swell (ours)", "ours:amb-sea"),
      C("Ocean coast (YevgVerh)", "fs:827530", start=20), C("Ocean waves binaural (L.Finck)", "fs:636552", start=20)),
    S("amb-shore", "Shore waves", "ambience", "waves breaking on the beach", C("Breaking waves (ours)", "ours:amb-shore"),
      C("Soft waves, lonely beach (helenicglauc)", "fs:727834", start=10), C("Gentle ocean waves loop (kkenny101)", "fs:852826", start=0)),
    S("amb-wind", "Wind", "ambience", "a breeze over the island; gusts on the hills", C("Wind and leaves (ours)", "ours:amb-wind"),
      C("A gentle breeze (mario1298)", "fs:181252", start=15), C("Deep wind at night (eniru)", "fs:640219", start=20)),
    S("amb-birds-dawn", "Birds: dawn", "ambience", "the dawn chorus", C("Dawn chorus (ours)", "ours:amb-birds-dawn"),
      C("Dawn chorus (SamsterBirdies)", "fs:578523", start=30), C("Dawn chorus (Synge101)", "fs:611453", start=10)),
    S("amb-birds-day", "Birds: day", "ambience", "birds through the day", C("Day birds (ours)", "ours:amb-birds-day"),
      C("Calm summer forest (Villehardt)", "fs:613995", start=40), C("Forest day, birds, insects (RealSquink)", "fs:788118", start=10)),
    S("amb-crickets", "Crickets", "ambience", "crickets in the grass at dusk and night", C("Crickets (ours)", "ours:amb-crickets"),
      C("Crickets at night (Defelozedd94)", "fs:522299", start=30), C("Crickets by the beach (felix.blume)", "fs:479041", start=60)),
    S("amb-rain", "Rain", "ambience", "rain on the island", C("Rain (ours)", "ours:amb-rain"), C("Light rain, rural (jmbphilmes)", "fs:200273", start=10),
      C("Light rain (Ryding)", "fs:96729", start=5)),
    S("amb-river", "River", "ambience", "the river and the brook", C("Brook (ours)", "ours:amb-river"), C("Natural brook gurgling (Garuda1982)", "fs:639128", start=10),
      C("Forest river over rocks (BonnyOrbit)", "fs:442478", start=10)),
    S("amb-fire", "Fire", "ambience", "the campfire and the hearth", C("Campfire (ours)", "ours:amb-fire"), C("Campfire 02 (HECKFRICKER)", "fs:729396", start=30),
      C("Campfire close crackling (FunWithSound)", "fs:588401", start=20)),
    S("amb-town", "Town murmur", "ambience", "people about in town and at the market", C("London market (ilmari_freesound)", "fs:659634", start=20),
      C("Crowded market square (jdpietrzak)", "fs:784650", start=10), C("Crowd (SamuelGremaud)", "fs:545756", start=20)),
    S("amb-cave", "Cave", "ambience", "the ruins and caves", C("Drips and drone (ours)", "ours:amb-cave"), C("Cave ambience (pointlessperson1)", "fs:740041", start=30),
      C("Dark dungeon ambience (Kinoton)", "fs:516566", start=20)),
    S("amb-night", "Night", "ambience", "the island at night", C("Night: crickets, wind, an owl (ours)", "ours:amb-night"),
      C("Night crickets and waves, Madeira (Profispiesser)", "fs:583251", start=30), C("Deep wind at night (eniru)", "fs:640219", start=90)),
]

# ---- sources ----------------------------------------------------------------------------------------------------


def fs_records():
    recs = {}
    p = os.path.join(STAGE, "freesound/records.tsv")
    for line in open(p) if os.path.exists(p) else []:
        sid, url, user, title, lic, file = line.rstrip("\n").split("\t")
        recs[sid] = {"url": url, "author": user, "title": title, "licence": CC0, "file": file}
    return recs


FS = fs_records()


def credit(src):
    """(source url, author, licence, origin) of one source."""
    kind, _, ref = src.partition(":")
    if kind == "ours":
        return "art/audio/synth_sfxlib.py", "Tethos (game/sfx-library)", CC0, ref
    if kind == "k":
        return f"https://kenney.nl/assets/{ref.split('/')[0]}", "Kenney", CC0, ref.split("/")[-1]
    if kind == "fs":
        r = FS[ref]
        return r["url"], r["author"], r["licence"], r["title"]
    url, author = GAME_CREDIT[ref]
    return url, author, CC0, f"web/public/audio/{ref}"


def decode(src, ch):
    kind, _, ref = src.partition(":")
    if kind == "ours":
        y = synth.make(ref)
        return y if (y.ndim == 2) == (ch == 2) else (y.mean(1) if y.ndim == 2 else np.stack([y, y], 1))
    path = {"k": lambda: os.path.join(STAGE, "kenney", ref), "fs": lambda: os.path.join(STAGE, "freesound", FS[ref]["file"]),
            "game": lambda: os.path.join(ROOT, "web/public/audio", ref)}[kind]()
    raw = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-i", path, "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    y = np.frombuffer(raw, np.float32).astype(np.float64)
    return y.reshape(-1, 2) if ch == 2 else y


def cut(y, start=0.0, dur=None, trim=True):
    y = y[int(start * SR):]
    if trim:  # from 2 ms before the sound starts
        a = np.abs(y if y.ndim == 1 else y.max(1))
        i = int(np.argmax(a > a.max() * 10 ** (-40 / 20)))
        y = y[max(0, i - int(0.002 * SR)):]
    if dur:
        y = y[:int(dur * SR)].copy()
        synth.fade_end(y, min(0.06, dur / 4))
    else:
        a = np.abs(y if y.ndim == 1 else y.max(1))
        end = len(a) - int(np.argmax(a[::-1] > a.max() * 10 ** (-60 / 20)))
        y = y[:end + int(0.01 * SR)].copy()
        synth.fade_end(y, min(0.025, len(y) / SR / 6))
    m = int(0.002 * SR)  # and in over 2 ms, so a cut never starts on a step
    y[:m] *= np.linspace(0, 1, m)[:, None] if y.ndim == 2 else np.linspace(0, 1, m)
    return y


def render(c, ch):
    if c["src"] == "mix":  # parts: (src, at, gain[, start, dur])
        xs = [(p[1], p[2] * cut(decode(p[0], ch), *(p[3:5] if len(p) > 3 else (0, None)))) for p in c["parts"]]
        return synth.mix(max(at + len(x) / SR for at, x in xs), *xs), [p[0] for p in c["parts"]]
    if c["src"] == "seq":
        xs = [cut(decode(s, ch)) for s in c["seq"]]
        gap = c.get("gap", 0.42)
        return synth.mix(gap * (len(xs) - 1) + len(xs[-1]) / SR, *[(gap * i, x) for i, x in enumerate(xs)]), sorted(set(c["seq"]))
    y = decode(c["src"], ch)
    if ch == 2 and c["src"].startswith("fs:"):
        y = y[int(c.get("start", 0) * SR):][:int((LOOP + XF) * SR)]
        if len(y) < (LOOP + XF) * SR:  # a short recording: loop what there is
            y = y[:max(len(y) - int(XF * SR), int(4 * SR)) + int(XF * SR)]
        return y, [c["src"]]
    if ch == 2:
        return y, [c["src"]]
    return cut(y, c.get("start", 0), c.get("dur"), trim=True), [c["src"]]


# ---- loop, loudness, limiter ------------------------------------------------------------------------------------


def loop(y):
    """Keep len - XF; the tail past it crossfades (equal power) into the head, so the wrap runs on with no seam."""
    x = int(XF * SR)
    L = len(y) - x
    k = np.linspace(0, 1, x)[:, None]
    out = y[:L].copy()
    out[:x] = y[:x] * np.sqrt(k) + y[L:L + x] * np.sqrt(1 - k)
    return out


def kweight(y):
    y = y if y.ndim == 2 else y[:, None]
    y = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], y, axis=0)
    return signal.lfilter([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621], y, axis=0)


def blocks(y):
    """Mean square per 400 ms block (100 ms hop) of the K-weighted signal, channels summed."""
    z = kweight(y) ** 2
    z = z.sum(1)
    w, h = int(0.4 * SR), int(0.1 * SR)
    z = np.concatenate([z, np.zeros(max(0, w - len(z)))])
    c = np.concatenate([[0], np.cumsum(z)])
    starts = np.arange(0, len(z) - w + 1, h)
    return (c[starts + w] - c[starts]) / w


def lufs(y, integrated):
    ms = blocks(y)
    if not integrated:  # a one-shot: its loudest 400 ms
        return -0.691 + 10 * np.log10(ms.max() + 1e-12)
    ms = ms[-0.691 + 10 * np.log10(ms + 1e-12) > -70]
    rel = -0.691 + 10 * np.log10(ms.mean()) - 10
    ms = ms[-0.691 + 10 * np.log10(ms + 1e-12) > rel]
    return -0.691 + 10 * np.log10(ms.mean())


def true_peak(y):
    up = signal.resample_poly(y, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def limit(y, ceiling_db):
    c = 10 ** (ceiling_db / 20)
    a = np.abs(y) if y.ndim == 1 else np.abs(y).max(1)
    g = np.minimum(1, c / np.maximum(a, 1e-12))
    look = int(0.002 * SR)
    g = minimum_filter1d(g, 2 * look + 1)
    g = np.convolve(g, np.ones(look + 1) / (look + 1), "same")
    return y * (g if y.ndim == 1 else g[:, None])


def level(y, target, integrated):
    for _ in range(8):
        y = y * 10 ** ((target - lufs(y, integrated)) / 20)
        y = limit(y, CEILING - 1.2)
        if abs(lufs(y, integrated) - target) < 0.3:
            break
    return y


def seam(y):
    """The wrap against the bed itself: at the wrap and at every 0.5 s inside, the sample step (against the median
    step) and the 50 ms level change across the point; returns the wrap's two numbers and the bed's 95th percentiles.
    A seam is clean when the wrap is no bigger than what the bed does anyway."""
    m = y.mean(1)
    med = np.median(np.abs(np.diff(m))) + 1e-12
    w = int(0.05 * SR)
    rms = lambda s: 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-12)
    at = lambda x, i: (abs(x[i] - x[i - 1]) / med, abs(rms(x[i:i + w]) - rms(x[i - w:i])))
    wrap = at(np.concatenate([m[-w:], m[:w]]), w)
    inside = np.array([at(m, i) for i in range(w, len(m) - w, int(0.5 * SR))])
    p95 = np.percentile(inside, 95, axis=0)
    return {"step": round(float(wrap[0]), 2), "levelDb": round(float(wrap[1]), 2), "bedStep95": round(float(p95[0]), 2), "bedLevelDb95": round(float(p95[1]), 2)}


# ---- encode -----------------------------------------------------------------------------------------------------


def encode(y, path, q):
    st = y if y.ndim == 2 else np.stack([y, y], 1)  # ffmpeg's vorbis encoder takes stereo only (as web/public/audio/sfx)
    subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "vorbis", "-strict", "-2",
                    "-q:a", str(q), path], input=st.astype(np.float32).tobytes(), check=True)


def waveform(path, png, dur):
    w = 640 if dur < 3 else 960
    subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-y", "-i", path, "-filter_complex",
                    f"aformat=channel_layouts=mono,showwavespic=s={w}x120:colors=0x3d8c74:scale=sqrt", "-frames:v", "1", png], check=True)


def measure(path, integrated):
    ch = 2
    raw = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-i", path, "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, np.float32).astype(np.float64).reshape(-1, 2)
    return y if integrated else y.mean(1)


def build(sound):
    amb = sound["category"] == "ambience"
    ch = 2 if amb else 1
    keys = "abc"
    for key, c in zip(keys, sound["candidates"]):
        y, srcs = render(c, ch)
        if amb:
            y = loop(y)
        y = level(y, TARGET[sound["category"]], amb)
        name = f"sfxlib1-{sound['id']}-{key}"
        ogg, png = os.path.join(OUT, name + ".ogg"), os.path.join(OUT, name + ".png")
        for _ in range(3):  # the encoder can overshoot the limiter on sharp transients: pull the peak down and redo
            encode(y, ogg, 4 if amb else 5)
            z = measure(ogg, amb)
            over = true_peak(z) - (CEILING - 0.1)
            if over <= 0:
                break
            y = limit(y, CEILING - 1.2 - over - 0.3)
        waveform(ogg, png, len(z) / SR)
        creds = [credit(s) for s in srcs]
        c.update({
            "key": key, "file": os.path.relpath(ogg, ROOT), "waveform": os.path.relpath(png, ROOT),
            "sources": [{"url": u, "author": a, "licence": l, "origin": o} for u, a, l, o in creds],
            "ours": all(s.startswith("ours:") for s in srcs),
            "seconds": round(len(z) / SR, 3), "lufs": round(float(lufs(z, amb)), 1), "truePeak": round(float(true_peak(z)), 1),
        })
        if amb:
            c["seam"] = seam(z)
        print(f"{name:34} {c['seconds']:6.2f}s {c['lufs']:6.1f} LUFS tp {c['truePeak']:5.1f}" + (f" seam {c['seam']}" if amb else ""))


def manifest(sounds):
    return {
        "name": "SFX library", "round": 1, "spec": "specs/sfx-library.md",
        "targets": {"lufs": TARGET, "truePeakDb": CEILING, "measure": "one-shots: the loudest 400 ms (K-weighted); ambience: integrated (EBU R128)"},
        "sounds": [{**{k: v for k, v in s.items() if k != "candidates"}, "pick": s.get("pick"),
                    "candidates": [{k: v for k, v in c.items() if k not in ("src", "parts", "seq", "gap", "start", "dur")} | {"recipe": {k: v for k, v in c.items() if k in ("src", "parts", "seq", "gap", "start", "dur")}}
                                   for c in s["candidates"]]} for s in sounds],
    }


def check():
    m = json.load(open(MANIFEST))
    bad = []
    for s in m["sounds"]:
        if not 2 <= len(s["candidates"]) <= 3:
            bad.append(f"{s['id']}: {len(s['candidates'])} candidates")
        for c in s["candidates"]:
            for f in (c["file"], c["waveform"]):
                if not os.path.exists(os.path.join(ROOT, f)):
                    bad.append(f"missing {f}")
            for src in c["sources"]:
                if src["licence"] != CC0 or not src["url"]:
                    bad.append(f"{c['file']}: licence {src['licence']}")
            want = m["targets"]["lufs"][s["category"]]
            if abs(c["lufs"] - want) > 1.0 and c["truePeak"] < CEILING - 1.5:  # under target is fine only when the peak ceiling held it back
                bad.append(f"{c['file']}: {c['lufs']} LUFS (want {want})")
            if c["truePeak"] > CEILING + 0.2:
                bad.append(f"{c['file']}: true peak {c['truePeak']}")
            sm = c.get("seam")
            if sm and (sm["step"] > max(10, 1.5 * sm["bedStep95"]) or sm["levelDb"] > max(1.5, 1.5 * sm["bedLevelDb95"])):
                bad.append(f"{c['file']}: seam {c['seam']}")
    n = sum(len(s["candidates"]) for s in m["sounds"])
    print(f"{len(m['sounds'])} sounds, {n} candidates;", "OK" if not bad else f"{len(bad)} problems:\n  " + "\n  ".join(bad))
    return not bad


if __name__ == "__main__":
    if sys.argv[1:] == ["--check"]:
        sys.exit(0 if check() else 1)
    os.makedirs(OUT, exist_ok=True)
    want = set(sys.argv[1:])
    old = {s["id"]: s for s in json.load(open(MANIFEST))["sounds"]} if want and os.path.exists(MANIFEST) else {}
    done = []
    for s in SOUNDS:
        if not want or s["id"] in want:
            build(s)
            done.append(s)
        elif s["id"] in old:
            done.append({**old[s["id"]], "candidates": [{**c, **c.pop("recipe", {})} for c in old[s["id"]]["candidates"]]})
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w") as f:
        json.dump(manifest(done), f, indent=1)
        f.write("\n")
    check()
