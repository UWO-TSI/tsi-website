"""Face set b2: David's faces #20-25 (wardrobe batch 2, specs/playtest-round1.md "New wardrobe batch"; his own Roblox
dynamic heads, confirmed by him), as mix-and-match creator parts: eyes, mouths and accents.

Source: face/source/david-b2/{eyes,mouth,face,full}/NN-*.glb (~/Downloads/faces-2.zip, split by "split_head" like the
row-305 set), with a preview sheet in _previews/. Only the textures and where the parts sit are used, never the head
geometry; #24 has eyes only (no mouth).

They are drawn exactly as face_set_305.py draws David's 19 (its unwrap, painter's drawing, line finish and eye-pair
split), and placed the way the game places those: the same Roblox head, so the same similarity, the one set 305 fitted
on itself (`place`), not one fitted on these six. Accents: #22's face carries a soft shade on the nose (a primitive over
its shell) and #25's shell stitches on the cheek; the other shells are plain skin.

`FACES` maps each face to its shop key in specs/wardrobe/batch2-pricing.json (`face-NN`): a priced face is one shop item,
and owning it unlocks its eyes, mouth and accent in the creator (look.ts faceRef). build_face.py packs these cells on
the second atlas page, in a band below set 305's (whose rects stay as they were).
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "face", "source", "david-b2")

# number: (eyes id, eyes name, mouth id or None, mouth name). No shop titles reach the game.
FACES = {
    20: ("cat_wide", "Wide cat eyes", "cat_fang", "Fang smile"),
    21: ("squint_blush", "Squint and blush", "tongue_out", "Tongue out"),
    22: ("squint", "Squint", "wide_w", "Wide w"),
    23: ("tired_lines", "Tired lines", "unsure", "Unsure"),
    24: ("weird_eyes", "Weirdcore eyes", None, None),
    25: ("caret_hash", "Caret and hash", "fangs", "Fangs"),
}
ACCENTS = {22: ("nose_shade", "Nose shade"), 25: ("stitches", "Stitches")}
# the whole face as a shop item: its creator name and the parts it unlocks
NAMES = {20: "Silly cat face", 21: "Silly face", 22: "Silly smile face", 23: "Tired face", 24: "Weirdcore eyes", 25: "Vampire face"}


def faces():
    """{"face-NN": {id, name, eyes, mouth, extras}}: the whole faces, by their pricing key."""
    out = {}
    for n, (eid, _, mid, _) in FACES.items():
        extras = [ACCENTS[n][0]] if n in ACCENTS else []
        out[f"face-{n}"] = {"id": NAMES[n].lower().replace(" face", "").replace(" ", "_"), "name": NAMES[n], "eyes": eid,
                            "mouth": mid, "extras": extras}
    return out


def build(PX, anchors, place):
    import face_set_305
    return face_set_305.build(PX, anchors, faces=FACES, accents=ACCENTS, source=SOURCE, place=place)
