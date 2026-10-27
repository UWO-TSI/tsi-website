"use client";

/**
 * /lab/avatar: the avatar v7 bench (specs/avatar-v7.md item 5). The real runtime Character (v7 head, sculpted-lock
 * hair, the animated painted face) under the character creator's camera and lights, in a grid of
 * cells that each force a look, a turn and a face frame, so review sheets and the blink/talk strips are
 * deterministic. Dev-only via the lab layout.
 *
 * ?sheet=styles    the three milestone styles, front and 3/4, head close-ups (faces at 1024)
 * ?sheet=expr      the six expressions (bob), 3/4 head close-ups
 * ?sheet=emote     each emote mouth's frames (Laugh, Cheer, Dance) on the happy face they play with
 * ?sheet=residents every authored resident look, the HQ lead and the café owner (&framing=body for the clothes)
 * ?sheet=look      one look from &look=<JSON> (parsed like a saved look), front and 3/4, labelled &label=
 * ?sheet=blink     one blink: open, half, closed, half, open
 * ?sheet=talk      the talk frames: the look's mouth, then each talk cell
 * ?sheet=live      one character at a time, the face on its own clock (blinks, &talk=1 talks); &style=, &yaw=
 * ?sheet=backs     every hairstyle (head-roblox: David's whole styles), turned
 * ?sheet=hats      the hats (they hide the back hair and carry a lock tuck), front and back 3/4
 * ?sheet=faces     row 301's face set (sleepy and dot eyes, the blush band; its mouths were cut) on three skins (&skins=)
 * ?sheet=facekit   head fit (specs/characters/head-fit.md): every face option once, on one skin and view (&view=front|34|side):
 *                  one cell per mouth, with the eyes and extras cycling through all of theirs alongside
 * ?sheet=hairkit   head fit: every hat, band and glasses (head-roblox: the hairstyles are ?sheet=fullkit and ?sheet=roblox),
 *                  on one skin and view (&view=front|34|side|back)
 * ?sheet=fullkit   head fit: every whole hairstyle (David's set) on one skin, hair colour (&hair=) and view
 * ?sheet=roblox    head-roblox (specs/characters/head-roblox.md): the whole hairstyles listed in &ids= (default all), each in
 *                  a row of front, 3/4, side and back (&views= to pick; high and low: 3/4 from above and below), on one skin and hair colour
 * ?sheet=david     David's 19 faces (face_set_305.py) as they came, eyes + mouth (+ accent), on three skins (&skins=)
 * ?sheet=mix       David's eyes, mouths and accents mixed with each other and with the earlier parts (&skins=)
 * &pitch= &zoom= &look= the camera's orbit (radians up, closer by, the height looked at)
 * &hair=<0-11> (none: the hairstyles' own colours) &color=RRGGBB &accent=<0-11> &skin=<0-11>&face=512 (the world atlas) &framing=head|hat|body &charlod=1|2 (every cell at LOD 1 or LOD 2)
 * &cut=0 (draw what a hat or hood hides: hidden_cut.py's marks ignored)
 * In ?sheet=roblox an id may carry a head accessory worn with it: &ids=hair_messy_boy+acc_visor (encode the + as %2B in a URL)
 * ?sheet=b2acc    wardrobe batch 2: David's Roblox accessories, each worn over a hairstyle (&style=, default the ribbon bob),
 *                  front and 3/4; &groups=head,face (default all) &framing=body for the neck and front ones
 * ?sheet=b2faces  wardrobe batch 2: David's whole faces #20-25 on the head, front and 3/4 (&skins=, default 3), then a mix row
 * ?sheet=fit      clothing-v2: each garment in &ids= (default the starter set) worn with plain companions (a top over the
 *                  shorts, a bottom under the tee, shoes under both), in a run, a jump and a sit (each frozen at one phase),
 *                  front, side and back; with &cut=0 the body skin the garments cut is drawn too (&framing=body)
 * ?sheet=haircolours  reflection-waves round 3: each style in &ids= on each of &skins= (default 1,6,11), a row of the hair colours in
 *                  &hairs= (default own, the free ones, two dyes; own is the style's own colours), &yaw= one view
 * ?sheet=eyeskins  reflection-waves round 3: every eye style in &ids= (default all) on every skin a player can pick (SKIN_PICKS), front, eyes open
 * ?sheet=hatcut   wardrobe batch 2: each hat with a hair cut (&hats= to pick) over each hairstyle in &ids= (default six), &yaw= one view; with
 *                  &cut=0 the hair the hat hides is drawn too (the hat cut's before and after)
 */
import { Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, View } from "@react-three/drei";
import Character, { type CharacterMotion, type ClipName } from "@/components/game/character/Character";
import { Lights as CreatorLights } from "@/components/game/character/CreatorStage";
import { CUTS } from "@/lib/game/character/rig";
import { DEFAULT_LOOK, FACE, NATURAL_HAIR, PARTS, parseLook, partsIn, SKIN_PICKS, STARTER_PARTS, type CharacterLook, type EyeFrame } from "@/lib/game/character/look";
import { RESIDENT_LOOKS } from "@/lib/content/residentRoster";
import { HQ_LEAD } from "@/lib/game/welcome";
import { CAFE_OWNER } from "@/lib/game/cafe";
import { EXPRESSIONS, type FaceOverride } from "@/lib/game/character/face";

const STYLES: Record<string, Pick<CharacterLook, "bangs" | "back">> = {
  short: { bangs: "", back: "hair_anime_spikes" },
  bob: { bangs: "", back: "hair_bob_pigtail" },
  long: { bangs: "", back: "hair_long_scruffy" },
};
/** Head fit sheets: the three review views (the character faces the camera at yaw 0). */
const VIEWS: Record<string, number> = { front: 0, "34": -0.6, side: -Math.PI / 2, back: Math.PI, high: -0.6, low: -0.6 };
/** Wardrobe round 5: the hat cut judged from above and below too (3/4, the camera's orbit pitched up or down, radians). */
const VIEW_PITCH: Record<string, number> = { high: 0.55, low: -0.3 };
/** `&cut=0`: every hidden triangle drawn (rig.ts CUTS), for the hat cut's before-and-after sheet. */
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cut") === "0") CUTS.on = false;
/** `&charlod=1|2`: the cells load their LOD meshes and draw that tier (Character's SHOW_LOD). */
const LOD_SHEET = typeof window !== "undefined" && !!new URLSearchParams(window.location.search).get("charlod");
/** &light=creator: the creator's studio lights (CreatorStage) in place of the bench's (the TSI zip hoodie's review shots). */
const CREATOR_LIGHT = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("light") === "creator";
/** Kit sheets hold the eyes open (no blink lands mid-capture). */
const OPEN: FaceOverride = { eyeFrame: "open" };
interface Cell { label: string; look: CharacterLook; yaw: number; face?: FaceOverride | null; talk?: boolean; pitch?: number;
  /** A clip held at a phase (?sheet=fit). */
  clip?: [ClipName, number] }
/** ?sheet=fit: the poses (clip, phase) and views, and each slot's plain companions (render_fit.py's). */
const FIT_POSES: [string, ClipName, number][] = [["run", "Run", 0.3], ["jump", "Jump", 0.5], ["sit", "Sit", 0.5]];
const FIT_VIEWS: [string, number][] = [["front", 0], ["side", -Math.PI / 2], ["back", Math.PI]];
const FIT_WITH: Record<string, Partial<CharacterLook>> = { top: { bottom: "bottom_shorts", shoes: "shoes_slipon" },
  bottom: { top: "top_tee", shoes: "shoes_slipon" }, shoes: { top: "top_tee", bottom: "bottom_shorts" } };

/** The camera by framing: the head, the head with room above it for a hat (wardrobe batch 2), the whole body. */
const FRAMING = { head: { at: [0, 0.86, 1.3], look: 0.8 }, hat: { at: [0, 0.98, 1.7], look: 0.9 }, body: { at: [0.15, 0.6, 2.05], look: 0.5 } } as const;

/** The camera's orbit (wardrobe round 5: the hat cut judged from above and below, and close up at a rim): &pitch= radians
 * up (negative: from below), &zoom= closer by that factor, &look= the height it looks at (m). */
interface Orbit { pitch: number; zoom: number; look: number | null }

function Stage({ cell, framing, faceSize, orbit }: { cell: Cell; framing: keyof typeof FRAMING; faceSize: number; orbit: Orbit }) {
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: cell.yaw, lift: 0, pose: cell.clip?.[0] ?? null, freeze: cell.clip?.[1], play: null, face: cell.face ?? null, talk: cell.talk ? 1e9 : 0 });
  const f = FRAMING[framing] ?? FRAMING.head;
  const look = orbit.look ?? f.look;
  const [dy, dz] = [f.at[1] - f.look, f.at[2]];
  const [cp, sp] = [Math.cos(cell.pitch ?? orbit.pitch), Math.sin(cell.pitch ?? orbit.pitch)];
  const at: [number, number, number] = [f.at[0] / orbit.zoom, look + (dy * cp + dz * sp) / orbit.zoom, (dz * cp - dy * sp) / orbit.zoom];
  return <>
    <PerspectiveCamera makeDefault fov={30} position={at} onUpdate={c => c.lookAt(0, look, 0)} />
    {CREATOR_LIGHT ? <CreatorLights /> : <>
      <ambientLight intensity={1.1} color="#fff6e6" />
      <hemisphereLight args={["#fff8ec", "#b7c7a8", 0.9]} />
      <directionalLight position={[1.6, 2.6, 2.2]} intensity={1.7} color="#fff1d8" />
    </>}
    <Suspense fallback={null}><Character look={cell.look} motion={motion} scale={1} faceSize={faceSize} lod={LOD_SHEET} /></Suspense>
  </>;
}

export default function AvatarBenchPage() {
  return <Suspense fallback={null}><AvatarBench /></Suspense>;
}

function AvatarBench() {
  const q = useSearchParams();
  const sheet = q.get("sheet") ?? "styles";
  const faceSize = q.get("face") === "512" ? 512 : 1024;
  const framing = (q.get("framing") as keyof typeof FRAMING) ?? "head";
  // round 2: no &hair= is the hairstyles' own colours (NATURAL_HAIR); &color=RRGGBB a colour wheel pick, &accent= a second colour
  const base: CharacterLook = { ...DEFAULT_LOOK, hair: Number(q.get("hair") ?? NATURAL_HAIR), skin: Number(q.get("skin") ?? 3),
    ...(q.get("color") ? { hairColor: `#${q.get("color")!.toUpperCase()}` } : {}), ...(q.get("accent") ? { hairAccent: Number(q.get("accent")) } : {}) };
  const style = (s: string) => ({ ...base, ...STYLES[s] });
  const yaw = Number(q.get("yaw") ?? -0.5);
  // the height looked at is &look=, or &at= on ?sheet=look, whose &look= is the look's JSON
  const lookAt = q.get(sheet === "look" ? "at" : "look");
  const orbit: Orbit = { pitch: Number(q.get("pitch") ?? 0), zoom: Number(q.get("zoom") ?? 1), look: lookAt ? Number(lookAt) : null };
  const view = VIEWS[q.get("view") ?? "34"] ?? VIEWS["34"];
  const cells = useMemo<Cell[]>(() => {
    const bob = style(q.get("style") ?? "bob");
    if (sheet === "expr") return EXPRESSIONS.map(e => ({ label: e, look: bob, yaw, face: { expression: e, eyeFrame: FACE.expressions[e].eyeFrame } }));
    if (sheet === "blink") return (["open", "half", "closed", "half", "open"] as EyeFrame[]).map((f, i) => ({ label: `${i + 1}: ${f}`, look: bob, yaw: 0, face: { eyeFrame: f } }));
    if (sheet === "talk") return [bob.mouth, ...FACE.talk.frames].map(m => ({ label: m, look: bob, yaw: 0, face: { mouth: m } }));
    if (sheet === "emote") return Object.entries(FACE.emoteMouth).flatMap(([clip, m]) => m.frames.map((f, i) => ({
      label: `${clip} ${i + 1}: ${f}`, look: bob, yaw, face: { expression: "happy" as const, mouth: f } })));
    if (sheet === "residents") return [...Object.entries(RESIDENT_LOOKS), ["HQ lead (welcome)", HQ_LEAD.look], ["café owner", CAFE_OWNER.look]]
      .map(([label, look]) => ({ label: label as string, look: parseLook(look), yaw: 0, face: OPEN }));
    if (sheet === "look") {
      const look = parseLook(JSON.parse(q.get("look") ?? "{}"));
      return (q.get("views") ?? "front,34").split(",").map(v => ({ label: `${q.get("label") ?? "look"} ${v}`, look, yaw: VIEWS[v] ?? 0, pitch: VIEW_PITCH[v], face: OPEN }));
    }
    if (sheet === "fit") return (q.get("ids")?.split(",") ?? [...STARTER_PARTS]).flatMap(id => {
      const slot = PARTS.find(p => p.id === id)!.slot;
      const look = { ...base, ...FIT_WITH[slot], [slot]: id };
      return FIT_POSES.flatMap(([pose, clip, t]) => FIT_VIEWS.map(([v, y]) => ({ label: `${id} ${pose} ${v}`, look, yaw: y, face: OPEN, clip: [clip, t] as [ClipName, number] })));
    });
    if (sheet === "live") return [{ label: q.get("style") ?? "bob", look: bob, yaw, talk: q.get("talk") === "1" }];
    // head-roblox: the hair is David's whole hairstyles (no bangs or backs); every one, turned
    if (sheet === "backs") return partsIn("back").map(p => ({ label: p.id, look: { ...bob, back: p.id }, yaw: yaw - 0.9 }));
    if (sheet === "hats") return ["acc_sunhat", "acc_cap", "acc_straw_hat"].flatMap(h => [
      { label: `${h} front`, look: { ...bob, acc: { head: h } }, yaw }, { label: `${h} back`, look: { ...bob, acc: { head: h } }, yaw: yaw + 2.6 }]);
    if (sheet === "faces") return (q.get("skins") ?? "1,5,10").split(",").map(Number).flatMap(skin => ([
      ["sleepy_lash", "kitty", ["blush_band"], 0], ["dot", "G3.3", [], 0], ["sleepy_lash", "M1.1", [], 0],
      ["dot", "kitty", ["blush_band"], 0], ["F1.1", "G3.3", ["blush_band"], 0], ["sleepy_lash", "kitty", ["blush_band"], yaw],
    ] as [string, string, string[], number][]).map(([eyes, mouth, extras, y]) => ({
      label: `skin ${skin} ${eyes} ${mouth}${extras.length ? " +band" : ""}${y ? " 3/4" : ""}`, look: { ...bob, skin, eyes, mouth, extras }, yaw: y })));
    if (sheet === "facekit") {
      const eyes = Object.keys(FACE.layers.eyes.items);
      const extras = [[], ...Object.keys(FACE.layers.extras.items).map(e => [e])];
      return Object.keys(FACE.layers.mouth.items).map((mouth, i) => {
        const look = { ...bob, mouth, eyes: eyes[i % eyes.length], extras: extras[i % extras.length] };
        return { label: `${look.eyes} ${mouth}${look.extras.length ? ` +${look.extras[0]}` : ""}`, look, yaw: view, face: OPEN };
      });
    }
    if (sheet === "hairkit") return [
      ...partsIn("accessory").filter(p => p.group === "head" || p.group === "face").map(p => ({ label: p.id, look: { ...bob, acc: { [p.group!]: p.id } }, yaw: view, face: OPEN })),
    ];
    // head fit: the whole hairstyles (David's set), each alone
    if (sheet === "fullkit") return partsIn("back").filter(p => p.full).map(p => ({ label: p.id, look: { ...bob, back: p.id }, yaw: view, face: OPEN }));
    if (sheet === "roblox") {
      const ids = q.get("ids")?.split(",") ?? partsIn("back").filter(p => p.full).map(p => p.id);
      const views = (q.get("views") ?? "front,34,side,back").split(",");
      return ids.flatMap(item => {
        const [id, acc] = item.split("+");
        return views.map(v => ({ label: `${item} ${v}`, look: { ...bob, back: id, acc: acc ? { head: acc } : {} }, yaw: VIEWS[v] ?? 0, pitch: VIEW_PITCH[v], face: OPEN }));
      });
    }
    // wardrobe batch 2: David's Roblox accessories over a hairstyle, and his whole faces #20-25
    if (sheet === "b2acc") {
      const groups = (q.get("groups") ?? "head,face,neck,front").split(",");
      const hair = { ...base, back: q.get("style") ?? "hair_ribbon_bob" };
      return partsIn("accessory").filter(p => p.key && groups.includes(p.group!)).flatMap(p => [
        { label: `${p.key} ${p.name}`, look: { ...hair, acc: { [p.group!]: p.id } }, yaw: 0, face: OPEN },
        { label: `${p.key} 3/4`, look: { ...hair, acc: { [p.group!]: p.id } }, yaw: -0.6, face: OPEN }]);
    }
    if (sheet === "hatcut") {
      const hairs = q.get("ids")?.split(",") ?? ["hair_ribbon_bob", "hair_windy_bob", "hair_messy_wolf", "hair_waves", "hair_double_buns", "hair_goggle_ushanka"];
      const hats = q.get("hats")?.split(",") ?? PARTS.filter(p => p.hatCut !== undefined).map(p => p.id);
      return hairs.flatMap(h => hats.map(c => ({ label: `${h.replace("hair_", "")} + ${c.replace("acc_", "")}`, look: { ...base, back: h, acc: { head: c } }, yaw: Number(q.get("yaw") ?? -0.6), face: OPEN })));
    }
    if (sheet === "b2faces") {
      const hair = { ...base, back: q.get("style") ?? "hair_waves" };
      const faces = Object.entries(FACE.faces);
      return (q.get("skins") ?? "3").split(",").map(Number).flatMap(skin => faces.flatMap(([key, f]) => [0, -0.6].map(y => ({
        label: `${skin}: ${key} ${f.name}${y ? " 3/4" : ""}`, look: { ...hair, skin, eyes: f.eyes, mouth: f.mouth ?? "M1.1", extras: f.extras }, yaw: y, face: OPEN }))))
        .concat(([["cat_wide", "fangs", ["stitches"]], ["caret_hash", "cat_fang", []], ["weird_eyes", "wide_w", ["nose_shade"]], ["squint_blush", "M1.1", ["blush"]],
          ["F1.1", "tongue_out", []], ["tired_lines", "kitty", ["sweat_drop"]]] as [string, string, string[]][]).map(([eyes, mouth, extras]) => ({
          label: `mix: ${FACE.names[eyes] ?? eyes} / ${FACE.names[mouth] ?? mouth}${extras.length ? ` + ${FACE.names[extras[0]] ?? extras[0]}` : ""}`,
          look: { ...hair, eyes, mouth, extras }, yaw: 0, face: OPEN })));
    }
    if (sheet === "haircolours") {
      const hairs = (q.get("hairs") ?? "own,0,1,2,3,4,5,12,10,11").split(",");
      return (q.get("ids") ?? DEFAULT_LOOK.back).split(",").flatMap(back => (q.get("skins") ?? "1,6,11").split(",").map(Number).flatMap(skin =>
        hairs.map(h => ({ label: `${back.replace("hair_", "")} s${skin} ${h}`, look: { ...base, back, skin, hair: h === "own" ? NATURAL_HAIR : Number(h) }, yaw, face: OPEN }))));
    }
    if (sheet === "eyeskins") return (q.get("ids")?.split(",") ?? Object.keys(FACE.layers.eyes.items)).flatMap(eyes =>
      Array.from({ length: SKIN_PICKS }, (_, skin) => ({ label: `${eyes} s${skin}`, look: { ...base, back: "hair_waves", skin, eyes, extras: [] }, yaw: 0, face: OPEN })));
    // David's faces: the second atlas page's eyes and mouths, in his order (face_set_305.FACES), with his two accents
    const davidEyes = Object.keys(FACE.layers.eyes.items).filter(id => FACE.layers.eyes.items[id].open[6] === 1);
    const davidMouths = Object.keys(FACE.layers.mouth.items).filter(id => FACE.layers.mouth.items[id][6] === 1);
    const open = { ...bob, back: "hair_waves" };   // a clear forehead
    const skins = (q.get("skins") ?? "1,5,10").split(",").map(Number);
    if (sheet === "david") return skins.flatMap(skin => davidEyes.map((eyes, i) => ({
      label: `${skin}: ${i + 1} ${FACE.names[eyes]} / ${FACE.names[davidMouths[i]]}`,
      look: { ...open, skin, eyes, mouth: davidMouths[i], extras: i === 5 ? ["nose_blush"] : i === 13 ? ["sweat_drop"] : [] }, yaw: 0 })));
    if (sheet === "mix") return skins.flatMap(skin => ([
      ["swirl", "drool", ["sweat_drop"], 0], ["bean", "kitty", ["nose_blush"], 0], ["sleepy", "gritted", [], 0],
      ["F1.1", "drumstick", [], 0], ["doll_lash", "M1.1", ["blush_band"], 0], ["dot", "nervous_laugh", ["sweat_drop"], 0],
      ["teary", "buck_tooth", [], 0], ["chill", "pout", ["nose_blush"], yaw],
    ] as [string, string, string[], number][]).map(([eyes, mouth, extras, y]) => ({
      label: `${skin}: ${FACE.names[eyes] ?? eyes} / ${FACE.names[mouth] ?? mouth}${extras.length ? ` + ${FACE.names[extras[0]] ?? extras[0]}` : ""}${y ? " 3/4" : ""}`,
      look: { ...open, skin, eyes, mouth, extras }, yaw: y })));
    return Object.keys(STYLES).flatMap(s => [{ label: `${s} front`, look: style(s), yaw: 0 }, { label: `${s} 3/4`, look: style(s), yaw: -0.6 }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, yaw, q]);
  const root = useRef<HTMLDivElement>(null);
  const cols = q.get("cols") ? Number(q.get("cols")) : sheet === "hatcut" ? 6 : sheet === "eyeskins" ? SKIN_PICKS : sheet === "haircolours" ? (q.get("hairs") ?? "own,0,1,2,3,4,5,12,10,11").split(",").length : sheet === "b2acc" ? 8 : sheet === "b2faces" ? 6 : sheet === "roblox" ? (q.get("views") ?? "front,34,side,back").split(",").length : sheet === "facekit" ? 13 : sheet === "fit" ? 9 : sheet === "hairkit" ? 10 : sheet === "fullkit" ? 7 : sheet === "styles" || sheet === "backs" || sheet === "faces" || sheet === "residents" || sheet === "emote" ? 6 : sheet === "hats" || sheet === "mix" ? 8 : sheet === "david" ? 10 : cells.length;
  return <div ref={root} style={{ position: "relative", paddingTop: 48, minHeight: "100vh", background: "#efe7d6" }}>
    <div data-sheet={sheet} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cols === 1 ? "420px" : "1fr"})`, gap: 8, padding: 8 }}>
      {cells.map(c => <figure key={c.label} style={{ margin: 0 }}>
        <View style={{ width: "100%", aspectRatio: framing === "body" ? "3 / 4" : "1 / 1", background: "#f6efe0", borderRadius: 10 }}>
          <Stage cell={c} framing={framing} faceSize={faceSize} orbit={orbit} />
        </View>
        <figcaption style={{ font: "12px 'IBM Plex Mono', monospace", color: "#5b4a36", textAlign: "center", paddingTop: 4 }}>{c.label}</figcaption>
      </figure>)}
    </div>
    <Canvas style={{ position: "fixed", inset: 0, pointerEvents: "none" }} eventSource={root as React.RefObject<HTMLElement>} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
      <View.Port />
    </Canvas>
  </div>;
}
