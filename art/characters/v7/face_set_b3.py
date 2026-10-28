"""Face set b3: David's faces #26-32 (wardrobe batch 3, specs/lanes/wardrobe-b3.md; his own Roblox dynamic heads), as
mix-and-match creator parts: eyes, mouths and accents, exactly as face_set_b2.py does batch 2.

Source: face/source/david-b3/{eyes,mouth,face,full}/NN-*.glb (split by "split_head" like the earlier sets), with a
preview sheet in _previews/batch3.png. Only the textures and where the parts sit are used, never the head geometry.

Drawn and placed as set 305 is (face_set_305.build with set 305's placement). Accents: #28's and #32's shells carry a
blush, #29's a pink nose, #30's a shadow under the eyes; #26, #27 and #31 are plain skin.

`FACES` maps each face to its key (`face-NN`). No prices yet (David picks free or price on the shelf page), so none is
in specs/wardrobe/batch2-pricing.json and every part is free in the creator until he does (look.ts facePartRef).
build_face.py packs these cells on the second atlas page, in a band below batch 2's (whose rects stay as they were).
"""
import os

import face_set_b2

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "face", "source", "david-b3")

# number: (eyes id, eyes name, mouth id or None, mouth name). Our own names; no shop titles reach the game.
FACES = {
    26: ("scribble", "Scribble eyes", "dot_dash", "Dot and dash"),
    27: ("yellow_eyes", "Yellow eyes", "jagged_shout", "Jagged shout"),
    28: ("big_shiny", "Big shiny eyes", "tiny_caret", "Tiny caret"),
    29: ("teary_closed", "Tearful closed eyes", "wobbly", "Wobbly mouth"),
    30: ("spiky_side", "Spiky side eye", "dark_lips", "Dark lips"),
    31: ("spiral", "Spiral eyes", "small_open", "Small open mouth"),
    32: ("retro_wink", "Retro wink", "curl_smile", "Curl smile"),
}
ACCENTS = {28: ("soft_blush", "Soft blush"), 29: ("pink_nose", "Pink nose"), 30: ("eye_shadow", "Eye shadow"),
           32: ("rosy_cheeks", "Rosy cheeks")}
# the whole face as a shop item: its creator name and the parts it unlocks
NAMES = {26: "Squiggle face", 27: "Zombie face", 28: "Big eyes face", 29: "Crying face", 30: "Moody face", 31: "Dizzy face",
         32: "Wink face"}


# David, 2026-10-27 ("remove moody face"): out of the game. Its cells keep their place in the atlas (no re-bake); build_face.py
# leaves the face and its three parts out of face_v7.json, so a re-run never brings it back.
REMOVED = (30,)


def removed_parts():
    """(eyes id, mouth id, accent id) of every removed face: out of face_v7.json's layers and names too."""
    return [(FACES[n][0], FACES[n][2], ACCENTS[n][0] if n in ACCENTS else None) for n in REMOVED]


def faces():
    out = face_set_b2.faces(FACES, ACCENTS, NAMES)
    return {k: v for k, v in out.items() if int(k.split("-")[1]) not in REMOVED}


def build(PX, anchors, place):
    import face_set_305
    return face_set_305.build(PX, anchors, faces=FACES, accents=ACCENTS, source=SOURCE, place=place)
