"""The SFX library's build (specs/sfx-library.md): every sound's candidates, cut, levelled, looped and encoded, plus
the manifest the game and the review page read.

  python3 -I art/audio/sfxlib.py            build this round's candidates into specs/evidence/sfx-library/r<ROUND>/ and write the manifest
  python3 -I art/audio/sfxlib.py <id> ...   only these sounds (earlier rounds' candidates keep their files and numbers)
  python3 -I art/audio/sfxlib.py --check    validate the manifest: every file there, every licence CC0, levels on target

Sources: `ours:<name>` (art/audio/synth_sfxlib.py), `k:<pack>/<file>` (a Kenney pack in art/audio/staging/kenney),
`fs:<id>` (a Freesound preview in art/audio/staging/freesound, its licence checked on its page by the fetch and logged
in records.tsv), `game:<file>` (a file already in web/public/audio, credited in CREDITS.md / SOURCES.md), `ref:<file>` (one of
David's references in specs/references/sfx: Pixabay files, used only edited or layered into our own sound, never
committed), `edit:<name>` (an EDITS function below: found or reference files cut, filtered and layered with ours).
Downloads are data: they are only decoded by ffmpeg here, never run.
"""
import json, os, subprocess, sys
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import synth_sfxlib as synth  # noqa: E402

SR = 48000
STAGE = os.path.join(ROOT, "art/audio/staging")
ROUND = 2
OUT = os.path.join(ROOT, f"specs/evidence/sfx-library/r{ROUND}")
REFS = os.path.join(ROOT, "specs/references/sfx")
PIXABAY = "Pixabay Content License"
MANIFEST = os.path.join(ROOT, "web/data/sfx-library.json")
CC0 = "CC0 1.0"
CEILING = -3.0  # true peak, dBFS
TARGET = {"ui": -20, "voice": -20, "rewards": -16, "actions": -18, "ambience": -26}  # LUFS (one-shots: loudest 400 ms; beds: integrated)
FOOTSTEPS = -26  # every footstep set's slow walk, integrated: all the same (David, r1: "test the db of all ambient walking and they should be the same after")
# Steps follow walking speed: the game plays each step at footstepRate(speed / walk speed) (web/lib/game/audio.ts), and
# the page shows a slow and a fast walk: (step interval s, playback rate, steps).
WALKS = {"slow": (0.55, 0.97, 6), "fast": (0.3, 1.2, 8)}
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

# ---- round 2: David's SFX Library 1 review (2026-11-13, https://claude.ai/artifact/ACLhH8idW4KJzayiDgpoE9) ---------

REVIEW = {  # his mark and note per sound, verbatim
    "amb-birds-dawn": ("approve", "b"),
    "amb-birds-day": ("redo", "c, remove the static background sound isolate the bird sound effect"),
    "amb-cave": ("approve", "c"),
    "amb-crickets": ("redo", "b, remove the static background sound isolate the sound effect"),
    "amb-fire": ("approve", "b"),
    "amb-night": ("approve", "b"),
    "amb-rain": ("redo", "b, make it light"),
    "amb-river": ("approve", "c"),
    "amb-sea": ("redo", "a, but should have wave crashing with that ambient sound, like swells in and out more to mimic it, look at b and c"),
    "amb-shore": ("redo", "b for deep ocean, c for beach, but make it lighter"),
    "amb-town": ("approve", "a, but we will not use this for our town plaza, just keep it in your back pocket if we need it"),
    "amb-wind": ("approve", "b but make it very light"),
    "bag-thunk": ("redo", "a but make a wind up sound effect before the thud"),
    "bite": ("approve", "a"),
    "buy": ("approve", "a, but edit so theres more before the ching, more ka"),
    "cast": ("redo", "i want the woosh of a but the line creek of c"),
    "catch": ("redo", "the splash part learn from c but the chine use a"),
    "coin-out": ("redo", "i dont like any"),
    "coin": ("approve", "both, a is the rewards sound, b is more realist like coin rattling, b is not for rewards, for when coins are visualized and stuff"),
    "craft-done": ("approve", "should have hammer sound like tik tik tik and on the third tik a chime, the tik is light"),
    "dig": ("redo", "redo in a style but with the sound of b, keep a as well i want variety"),
    "donate": ("approve", "a"),
    "equip": ("redo", "a redo to be softer and less crinkly and neutral"),
    "error": ("approve", "a"),
    "fish-escape": ("redo", "the splash needs to be a plop and sad splash and the aw sound needs to be redone so theres a slight gap between spash and aw"),
    "footstep-grass": ("redo", "should be a but more bassy earthy feel and overall more rounded so its easy on the ears. and it should also be able to match speed, so faster the sound goes faster"),
    "footstep-sand": ("redo", "needs to be softer and pleasing to the ear, i want you to redo the sound effect make it more quiet, test the db of all ambient wlaking and they should be the same after"),
    "footstep-stone": ("redo", "it should be a rounded light sound on like boot i added reference you can use"),
    "footstep-water": ("redo", "ours is not accurate at all, use b as reference, they shouldnt be all the same tone, mix it up feel the splash linger between each step"),
    "footstep-wood": ("redo", "b, but more deepness to it and overall rounded"),
    "forage": ("redo", "use the leaf sound effect for the rustle and the A. for the pop"),
    "gem": ("redo", "this should be more epic cuz its gems, i dont like any"),
    "item-get": ("redo", "a but should be more poppy sound like a minecraft pop sound effect"),
    "jump": ("redo", "the whoosh up is too harsh, redo to be smoother more satisfying for the ear"),
    "land": ("redo", "a but should be lighter and more soft and rounder"),
    "level-up": ("redo", "a but more epic"),
    "place": ("redo", "a is good but make the tone a proper note"),
    "quest-complete": ("redo", "a make the chime ding sound louder and appegio"),
    "reel": ("redo", "in the style of a make it sound like b but less harsh on the ear"),
    "reward-fly": ("approve", "a"),
    "rustle": ("redo", "the rustling sound doesnt sound right, i need it redone or look online for refrernce or find like pre exisitng, i downloaded a reference to use its in my downloads"),
    "sell": ("redo", "make the hua befroe the ding longer and ring out, make ding ring out too naturally for a lil bit"),
    "sit": ("approve", "b"),
    "splash": ("redo", "downloaded 3 seperate splash sound effects, for you to either reference or use straight up"),
    "stamp": ("redo", "should be a lighter version of b and a confrim happy chime"),
    "task-complete": ("approve", "a"),
    "ui-close": ("approve", "a"),
    "ui-confirm": ("approve", "a"),
    "ui-open": ("approve", "a"),
    "ui-tab": ("approve", "a"),
    "ui-tap": ("approve", "i like b and c, c for more muted items"),
    "ui-toggle": ("approve", "a"),
    "upgrade": ("redo", "a but should me a lil more epic and sustained and longer and spaced out"),
    "voice-blip": ("redo", "i dont like any of these, use the davidliu.work sound for the head character in my project folder"),
}
PICKS = {  # locked; where he approved with a change, the pick is the changed candidate (shown again to confirm)
    "amb-birds-dawn": "b", "amb-cave": "c", "amb-fire": "b", "amb-night": "b", "amb-river": "c", "amb-town": "a", "amb-wind": "d",
    "bite": "a", "buy": "d", "coin": "a", "craft-done": "d", "donate": "a", "error": "a", "reward-fly": "a", "sit": "b",
    "task-complete": "a", "ui-close": "a", "ui-confirm": "a", "ui-open": "a", "ui-tab": "a", "ui-tap": "b", "ui-toggle": "a",
}
USES = {  # a sound whose picks have more than one job
    "coin": {"a": "the reward sound: a coin arriving in the wallet", "b": "coins shown moving (a rattle); never a reward"},
    "ui-tap": {"b": "taps", "c": "taps on muted items"},
    "amb-town": {"a": "kept in the back pocket; not the town plaza's sound"},
}
R = lambda label, src, **o: C(label, src, round=2, **o)
NEW = {  # round 2 candidates: id -> (the r1 candidates his note points at, to compare; the new ones)
    "amb-birds-day": ("c", [R("Day birds, the hiss taken out (RealSquink, cleaned)", "fs:788118", start=10, fx=[("denoise", 30, 2.0, 0.03)])]),
    "amb-crickets": ("b", [R("Crickets alone, the beach taken out (felix.blume, cleaned)", "fs:479041", start=60, fx=[("keep", 3800, 8500, 0.02), ("denoise", 15, 1.5, 0.1)])]),
    "amb-rain": ("b", [R("Light rain, thinner and quieter (jmbphilmes)", "fs:200273", start=10, fx=[("denoise", 40, 1.3, 0.3), ("hp", 300)], target=-31)]),
    "amb-sea": ("abc", [R("Swell with waves cresting and crashing (ours)", "ours:amb-sea-crash"),
                        R("Our swell moving with a real coast's waves (ours + YevgVerh)", "edit:sea-coast")]),
    "amb-shore": ("c", [R("Beach waves, lighter (kkenny101)", "fs:852826", start=0, fx=[("lp", 7000)], target=-30)]),
    "amb-wind": ("b", [R("A gentle breeze, very light (mario1298)", "fs:181252", start=15, fx=[("hp", 120), ("lp", 6000)], target=-33)]),
    "bag-thunk": ("a", [R("Swish in, then the cloth thump (ours)", "ours:bag-windup")]),
    "buy": ("a", [R("Ka-ka-ka, ching (ours)", "ours:buy-ka")]),
    "cast": ("ac", [R("Our whoosh, el_boss's line running out (ours + el_boss)", "mix", parts=[("ours:cast-whoosh", 0, 1.0), ("fs:853287", 0.17, 0.8, 0.28, 1.25)])]),
    "catch": ("ac", [R("swordofkings128's splash, our two notes", "mix", parts=[("fs:398032", 0, 1.0), ("ours:catch-chime", 0.18, 0.7)])]),
    "coin-out": ("abc", [R("A coin set on the counter (ours)", "ours:coin-counter", run=5), R("A soft musical pip (ours)", "ours:coin-pip", run=5)]),
    "craft-done": ("a", [R("Tik, tik, tik, and a chime on the third (ours)", "ours:craft-tik")]),
    "dig": ("ab", [R("a's spade, b's wet sand (ours + f3bbbo)", "edit:dig-wet")]),
    "equip": ("a", [R("Soft clip, no ring (ours)", "ours:equip-soft")]),
    "fish-escape": ("a", [R("Plop, a sad small splash, a pause, \"aw\" (ours)", "ours:fish-escape-aw")]),
    "footstep-grass": ("a", [R("Grass, earthier and rounder (ours)", "edit:steps-grass", walk=True)]),
    "footstep-sand": ("a", [R("Sand, soft and quiet (ours)", "edit:steps-sand", walk=True)]),
    "footstep-stone": ("ab", [R("Boots on stone from David's reference (cleaned, rounded)", "edit:steps-stone-ref", walk=True),
                              R("Boots on stone, rounded (ours)", "edit:steps-stone", walk=True)]),
    "footstep-water": ("ab", [R("Shallows from b: each step its own tone, the water lingering (Robo9418 + ours)", "edit:steps-water", walk=True)]),
    "footstep-wood": ("b", [R("Kenney wood, deeper and rounder", "edit:steps-wood", walk=True)]),
    "forage": ("a", [R("Snap, David's dry leaves, a's pop (ours + dragon-studio)", "edit:forage-leaves")]),
    "gem": ("abc", [R("Crystal run into a glass chord (ours)", "ours:gem-crystal"), R("Sparkle swell onto a big bell (ours)", "ours:gem-flash")]),
    "item-get": ("a", [R("Pop (ours)", "ours:item-pop")]),
    "jump": ("a", [R("Soft whoosh up (ours)", "ours:jump-soft")]),
    "land": ("a", [R("Soft round thud (ours)", "ours:land-soft")]),
    "level-up": ("a", [R("Run up into a full chord, a boom and shimmer (ours)", "ours:level-up-epic")]),
    "place": ("a", [R("Wood knock tuned to an A (ours)", "ours:place-note")]),
    "quest-complete": ("a", [R("Fanfare, the bells louder and as an arpeggio (ours)", "ours:quest-complete-bells")]),
    "reel": ("ab", [R("Ratchet wound like b, soft on the ear (ours)", "ours:reel-soft")]),
    "rustle": ("a", [R("A bush shaken: David's dry leaves (dragon-studio)", "edit:rustle-shake"), R("Brushing through: David's dry leaves, softer (dragon-studio)", "edit:rustle-brush")]),
    "sell": ("a", [R("A long drawer slide that rings, then the ding ringing out (ours)", "ours:sell-ring")]),
    "splash": ("abc", [R("Splash (universfield 229315)", "ref:universfield-water-splash-229315.mp3", start=0.1, dur=1.2),
                       R("Big splash (universfield 199583)", "ref:universfield-water-splash-199583.mp3", start=0.1, dur=1.5),
                       R("Splash 02 (universfield 352021)", "ref:universfield-water-splash-02-352021.mp3", start=0.1, dur=1.0)]),
    "stamp": ("b", [R("b lighter, with a happy chime (I.fekry + ours)", "edit:stamp-light")]),
    "upgrade": ("a", [R("Shing, four notes spaced out over a held chord (ours)", "ours:upgrade-long")]),
    "voice-blip": ("abc", [R("davidliu.work's talk blips (ours)", "ours:voice-davidliu")]),
}
SOUNDS.insert(next(i for i, x in enumerate(SOUNDS) if x["id"] == "amb-shore") + 1,
              S("amb-shore-deep", "Deep ocean", "ambience", "the deep water off the island (David: shore b, as deep ocean)",
                R("Deep ocean, lighter (helenicglauc)", "fs:727834", start=10, fx=[("lp", 5000)], target=-30)))
NEW["amb-shore-deep"] = ("amb-shore:b", [])
for x in SOUNDS:
    if x["id"] in REVIEW:
        x["mark"], x["note"] = REVIEW[x["id"]]
    x["pick"], x["uses"] = PICKS.get(x["id"]), USES.get(x["id"])
    if x["id"] in NEW:
        cmp, cands = NEW[x["id"]]
        x["compare"] = [cmp] if ":" in cmp else list(cmp)
        x["candidates"] += cands

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
    if kind == "ref":
        return "https://pixabay.com/sound-effects/", next(a for a in ("dragon-studio", "freesound_community", "musicholder", "universfield") if ref.startswith(a)), PIXABAY, ref
    url, author = GAME_CREDIT[ref]
    return url, author, CC0, f"web/public/audio/{ref}"


def decode(src, ch):
    kind, _, ref = src.partition(":")
    if kind == "ours":
        y = synth.make(ref)
        return y if (y.ndim == 2) == (ch == 2) else (y.mean(1) if y.ndim == 2 else np.stack([y, y], 1))
    path = {"k": lambda: os.path.join(STAGE, "kenney", ref), "fs": lambda: os.path.join(STAGE, "freesound", FS[ref]["file"]),
            "game": lambda: os.path.join(ROOT, "web/public/audio", ref), "ref": lambda: os.path.join(REFS, ref)}[kind]()
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
    if c["src"].startswith("edit:"):
        synth.rng = np.random.default_rng(sum(map(ord, c["src"])) * 7919)
        y, srcs = EDITS[c["src"][5:]](ch)
        return y, srcs
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


# ---- edits (round 2): found and reference files cut, filtered and layered with ours -------------------------------


def resample(x, rate):
    """Played `rate` times faster (higher and shorter), as the game's playbackRate does."""
    return signal.resample(x, int(len(x) / rate)) if rate != 1 else x


def grab(y, t, dur, pre=0.012):
    """One hit from a recording: its peak near t, from `pre` before it, `dur` long, faded."""
    w = y[int((t - 0.06) * SR):int((t + 0.08) * SR)]
    i = int((t - 0.06) * SR) + int(np.argmax(np.abs(w)))
    x = y[i - int(pre * SR):i + int(dur * SR)].copy()
    m = int(0.003 * SR)
    x[:m] *= np.linspace(0, 1, m)
    synth.fade_end(x, 0.04)
    return x


def denoise(y, pct=25, over=2.0, floor=0.05):
    """Spectral gate: each frequency's floor is its `pct` percentile over the clip; what sits less than `over` times
    above it is turned down to `floor`. Takes the steady hiss and hum out from under birds, crickets and steps."""
    def one(x):
        _, _, Z = signal.stft(x, SR, nperseg=2048, noverlap=1536)
        A = np.abs(Z)
        m = uniform_filter(np.clip(1 - over * np.percentile(A, pct, axis=1, keepdims=True) / (A + 1e-12), 0, 1), (3, 5))
        return signal.istft(Z * (floor + (1 - floor) * m), SR, nperseg=2048, noverlap=1536)[1][:len(x)]
    return one(y) if y.ndim == 1 else np.stack([one(y[:, i]) for i in (0, 1)], 1)


def apply_fx(y, ops):
    for op, *a in ops:
        if op == "denoise":
            y = denoise(y, *a)
        elif op == "keep":  # keep a band, the rest down to a[2]
            y = synth.flt(y, "bandpass", (a[0], a[1]), 4) + a[2] * y
        else:
            y = synth.flt(y, {"hp": "highpass", "lp": "lowpass"}[op], a[0])
    return y


def steps_ours(surface):
    return lambda ch: ([synth.make(f"step2-{surface}-{v}") for v in range(4)], [f"ours:footstep-{surface}"])


def steps_stone_ref(ch):
    """David's boot reference: four of its steps, the room hiss gated out, rounded off."""
    y = denoise(decode("ref:freesound_community-walking-96582.mp3", 1), 30, 2.0, 0.05)
    return [synth.flt(grab(y, t, 0.24), "lowpass", 5000) for t in (0.36, 1.0, 1.44, 2.52)], ["ref:freesound_community-walking-96582.mp3"]


def steps_water(ch):
    """Robo9418's puddle splash (r1 b), each step at its own pitch and brightness, the water lingering after it."""
    b = cut(decode("fs:841834", 1))
    out = []
    for r, lp, f in ((1.0, 6000, 820), (0.86, 3800, 640), (1.13, 7000, 950), (0.93, 3000, 720)):
        x = synth.flt(resample(b, r), "lowpass", lp)
        swirl = synth.flt(synth.sweep(0.7, synth.glide(f, f * 0.6, 0.7), None, 1.0, synth.ev(0.7, 0.06, 0.22)), "lowpass", 2200)
        drips = [(t, 0.05 * synth.osc(synth.glide(g, g * 1.5, 0.03), 0.03) * synth.ev(0.03, 0.001, 0.008))
                 for t, g in zip(synth.rng.uniform(0.12, 0.5, 3), synth.rng.uniform(900, 2200, 3))]
        x = x / np.abs(x).max()
        out.append(synth.mix(0.75, (0, x), (0.04, 0.22 * swirl / np.abs(swirl).max()), *drips))
    return out, ["fs:841834", "ours:footstep-water"]


def steps_wood(ch):
    """Kenney's wood steps (r1 b), played lower and rounded: slower, the top rolled off, the low end lifted."""
    out = []
    for f in steps("footstep_wood"):
        x = resample(cut(decode(KM + f, 1)), 0.82)
        x = synth.flt(x, "lowpass", 2600) + 1.2 * synth.flt(x, "lowpass", 300)
        m = int(0.004 * SR)
        x[:m] *= np.linspace(0, 1, m)
        out.append(x)
    return out, [KM + f for f in steps("footstep_wood")]


LEAVES = "ref:dragon-studio-dry-leaves-rustling-482874.mp3"


def rustle_shake(ch):
    """A bush shaken: David's dry leaves, three shakes."""
    y = synth.flt(decode(LEAVES, 1)[int(2.75 * SR):int(3.4 * SR)], "bandpass", (250, 9000))
    shake = synth.mix(0.65, *[(at, g * synth.ev(0.3, 0.03, 0.08)) for at, g in ((0, 1), (0.14, 0.85), (0.29, 0.6))])
    return y * shake[:len(y)], [LEAVES]


def rustle_brush(ch):
    """Brushing through: David's dry leaves, one soft swell, the top rolled off."""
    y = synth.flt(decode(LEAVES, 1)[int(4.35 * SR):int(4.95 * SR)], "bandpass", (200, 6000))
    return y * np.sin(np.pi * np.arange(len(y)) / len(y)) ** 1.5, [LEAVES]


def forage_leaves(ch):
    """forage a's snap and pop, its rustle from David's dry leaves."""
    lv = synth.flt(decode(LEAVES, 1)[int(2.85 * SR):int(3.15 * SR)], "bandpass", (250, 9000))
    lv = lv / np.abs(lv).max() * np.linspace(1, 0.15, len(lv))
    pop = synth.make("forage-pop")
    return synth.mix(0.32, (0, pop[:int(0.02 * SR)]), (0.01, 0.45 * lv), (0.11, pop[int(0.11 * SR):])), [LEAVES, "ours:forage"]


def dig_wet(ch):
    """dig a's shape (the spade's thump, the bite, the spill after) with f3bbbo's wet sand (r1 b) as the sound."""
    b = decode("fs:651293", 1)
    bite = cut(b, 0, 0.28)
    bite = bite / np.abs(bite).max() * synth.ev(len(bite) / SR, 0.006, 0.1)[:len(bite)]
    spill = cut(b, 0.3, 0.2)
    return synth.mix(0.45, (0, 0.55 * synth.thump(120, 60, 0.1, 0.04)), (0, bite), (0.2, 0.4 * spill / np.abs(spill).max())), ["ours:dig", "fs:651293"]


def stamp_light(ch):
    """I.fekry's stamp (r1 b) made lighter (its low weight taken off), with a happy confirm chime."""
    b = synth.flt(cut(decode("fs:470710", 1), 0, 0.22), "highpass", 320)
    b = b / np.abs(b).max()
    return synth.mix(0.65, (0, 0.8 * b), (0.05, 0.55 * synth.make("stamp-chime"))), ["fs:470710", "ours:stamp"]


def sea_coast(ch):
    """amb-sea a's swell, moved by a real coast's waves (YevgVerh, r1 b) and laid over them."""
    a = synth.make("amb-sea")
    b = decode("fs:827530", 2)[int(20 * SR):][:len(a)]
    e = synth.flt(np.sqrt(synth.flt((b ** 2).mean(1), "lowpass", 0.6, 1).clip(0)), "lowpass", 0.6, 1)
    e = (e - e.min()) / (e.max() - e.min())
    rms = lambda x: np.sqrt(np.mean(x ** 2))
    return a / rms(a) * (0.25 + 0.75 * e ** 1.5)[:, None] + 0.8 * b / rms(b), ["ours:amb-sea", "fs:827530"]


EDITS = {
    "steps-grass": steps_ours("grass"), "steps-sand": steps_ours("sand"), "steps-stone": steps_ours("stone"), "steps-stone-ref": steps_stone_ref,
    "steps-water": steps_water, "steps-wood": steps_wood, "rustle-shake": rustle_shake, "rustle-brush": rustle_brush,
    "forage-leaves": forage_leaves, "dig-wet": dig_wet, "stamp-light": stamp_light, "sea-coast": sea_coast,
}


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


def out(y, name, amb, gain=None, target=None, integrated=None):
    """Level (or apply `gain`), limit, encode `name`.ogg and its waveform; returns (measured audio, gain applied)."""
    ogg, png = os.path.join(OUT, name + ".ogg"), os.path.join(OUT, name + ".png")
    integrated = amb if integrated is None else integrated
    if gain is None:
        y0 = y
        y = level(y, target, integrated)
        gain = lufs(y, integrated) - lufs(y0, integrated)
    else:
        y = limit(y * 10 ** (gain / 20), CEILING - 1.2)
    for _ in range(3):  # the encoder can overshoot the limiter on sharp transients: pull the peak down and redo
        encode(y, ogg, 4 if amb else 5)
        z = measure(ogg, amb)
        over = true_peak(z) - (CEILING - 0.1)
        if over <= 0:
            break
        y = limit(y, CEILING - 1.2 - over - 0.3)
    waveform(ogg, png, len(z) / SR)
    return z, gain, os.path.relpath(ogg, ROOT), os.path.relpath(png, ROOT)


def walk(xs, interval, rate, n):
    """Steps laid as a walk: the four in turn, each played at `rate`, `interval` apart (a hair of human unevenness)."""
    order = [0, 1, 2, 3, 1, 0, 3, 2]
    j = np.random.default_rng(5).uniform(-0.012, 0.012, n)
    parts = [(0.02 + interval * i + j[i], resample(xs[order[i % 8]], rate)) for i in range(n)]
    return synth.mix(max(at + len(x) / SR for at, x in parts) + 0.05, *parts)


def build(sound, key, c):
    amb = sound["category"] == "ambience"
    ch = 2 if amb else 1
    target = c.get("target") or (FOOTSTEPS if c.get("walk") else TARGET[sound["category"]])
    y, srcs = render(c, ch)
    name = f"sfx{ROUND}-{sound['id']}-{key}"
    extra = {}
    if c.get("walk"):  # four steps: the slow walk is the candidate, the fast walk its alt at the same gain
        xs = [apply_fx(cut(x), c.get("fx", [])) for x in y]
        y = walk(xs, *WALKS["slow"])
        z, gain, ogg, png = out(y, name, False, target=target, integrated=True)
        fz, _, fogg, fpng = out(walk(xs, *WALKS["fast"]), name + "-fast", False, gain=gain)
        extra = {"alt": {"label": "fast walk", "file": fogg, "waveform": fpng, "seconds": round(len(fz) / SR, 3)},
                 "walk": {k: {"interval": v[0], "rate": v[1], "steps": v[2]} for k, v in WALKS.items()},
                 "walkLufs": round(float(lufs(z, True)), 1), "walkRmsDb": round(float(20 * np.log10(np.sqrt(np.mean(z ** 2)))), 1)}
    else:
        y = apply_fx(y, c.get("fx", []))
        if amb:
            y = loop(y)
        z, gain, ogg, png = out(y, name, amb, target=target)
        if c.get("run"):  # a run of coins, each a semitone up (the game re-pitches per play)
            single = y * 10 ** (gain / 20)
            rz, _, rogg, rpng = out(synth.mix(0.09 * c["run"] + len(single) / SR, *[(0.09 * i, resample(single, 2 ** (i / 12))) for i in range(c["run"])]),
                                    name + "-run", False, gain=0)
            extra = {"alt": {"label": f"a run of {c['run']}", "file": rogg, "waveform": rpng, "seconds": round(len(rz) / SR, 3)}}
    creds = [credit(s) for s in srcs]
    c.update({
        "key": key, "file": ogg, "waveform": png,
        "sources": [{"url": u, "author": a, "licence": l, "origin": o} for u, a, l, o in creds],
        "ours": all(s.startswith("ours:") for s in srcs),
        "seconds": round(len(z) / SR, 3), "lufs": round(float(lufs(z, amb)), 1), "truePeak": round(float(true_peak(z)), 1), **extra,
    })
    if target != TARGET[sound["category"]]:
        c["target"] = target
    if amb:
        c["seam"] = seam(z)
    print(f"{name:34} {c['seconds']:6.2f}s {c['lufs']:6.1f} LUFS tp {c['truePeak']:5.1f}" + (f" seam {c['seam']}" if amb else "")
          + (f" walk {c['walkLufs']} LUFS, rms {c['walkRmsDb']} dB" if c.get("walk") else ""))


RECIPE = ("src", "parts", "seq", "gap", "start", "dur", "fx", "walk", "run")


def manifest(sounds):
    return {
        "name": "SFX library", "round": ROUND, "spec": "specs/sfx-library.md",
        "targets": {"lufs": TARGET, "footsteps": FOOTSTEPS, "truePeakDb": CEILING,
                    "measure": "one-shots: the loudest 400 ms (K-weighted); ambience: integrated (EBU R128)"},
        "sounds": [{**{k: v for k, v in s.items() if k != "candidates" and v is not None},
                    "candidates": [{k: v for k, v in c.items() if k not in RECIPE} | {"recipe": {k: v for k, v in c.items() if k in RECIPE}}
                                   for c in s["candidates"]]} for s in sounds],
    }


def check():
    m = json.load(open(MANIFEST))
    bad = []
    ids = {s["id"]: s for s in m["sounds"]}
    for s in m["sounds"]:
        keys = [c["key"] for c in s["candidates"]]
        if not keys or len(set(keys)) != len(keys):
            bad.append(f"{s['id']}: candidates {keys}")
        for k in [s.get("pick")] + list((s.get("uses") or {})):
            if k and k not in keys:
                bad.append(f"{s['id']}: pick {k} is not a candidate")
        for k in s.get("compare", []):
            sid, _, kk = k.rpartition(":")
            if kk not in [c["key"] for c in ids[sid or s["id"]]["candidates"]]:
                bad.append(f"{s['id']}: compare {k} missing")
        for c in s["candidates"]:
            for f in (c["file"], c["waveform"]) + ((c["alt"]["file"], c["alt"]["waveform"]) if "alt" in c else ()):
                if not os.path.exists(os.path.join(ROOT, f)):
                    bad.append(f"missing {f}")
            for src in c["sources"]:
                ok = src["licence"] == CC0 or (src["licence"] == PIXABAY and src["origin"].endswith(".mp3"))
                if not ok or not src["url"]:
                    bad.append(f"{c['file']}: licence {src['licence']}")
            want = c.get("target", m["targets"]["lufs"][s["category"]])
            if "walkLufs" in c:
                want, c = m["targets"]["footsteps"], {**c, "lufs": c["walkLufs"]}
            if abs(c["lufs"] - want) > 1.0 and c["truePeak"] < CEILING - 1.5:  # under target is fine only when the peak ceiling held it back
                bad.append(f"{c['file']}: {c['lufs']} LUFS (want {want})")
            if c["truePeak"] > CEILING + 0.2:
                bad.append(f"{c['file']}: true peak {c['truePeak']}")
            sm = c.get("seam")
            if sm and (sm["step"] > max(10, 1.5 * sm["bedStep95"]) or sm["levelDb"] > max(1.5, 1.5 * sm["bedLevelDb95"])):
                bad.append(f"{c['file']}: seam {c['seam']}")
    walks = [c["walkLufs"] for s in m["sounds"] for c in s["candidates"] if "walkLufs" in c]
    if walks and max(walks) - min(walks) > 0.6:
        bad.append(f"footstep walks differ by {max(walks) - min(walks):.1f} LU")
    n = sum(len(s["candidates"]) for s in m["sounds"])
    print(f"{len(m['sounds'])} sounds, {n} candidates;", "OK" if not bad else f"{len(bad)} problems:\n  " + "\n  ".join(bad))
    return not bad


if __name__ == "__main__":
    if sys.argv[1:] == ["--check"]:
        sys.exit(0 if check() else 1)
    os.makedirs(OUT, exist_ok=True)
    want = set(sys.argv[1:])
    old = {s["id"]: {c["key"]: c for c in s["candidates"]} for s in json.load(open(MANIFEST))["sounds"]} if os.path.exists(MANIFEST) else {}
    for s in SOUNDS:
        for key, c in zip("abcdefgh", s["candidates"]):
            prev = old.get(s["id"], {}).get(key)
            if c.get("round", 1) == ROUND and (not want or s["id"] in want):
                build(s, key, c)
            elif prev:  # built in an earlier round (or not asked for now): keep its files and numbers
                c.update({k: v for k, v in prev.items() if k != "recipe"})
            else:
                build(s, key, c)
    with open(MANIFEST, "w") as f:
        json.dump(manifest(SOUNDS), f, indent=1)
        f.write("\n")
    check()
