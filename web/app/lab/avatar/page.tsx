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
 *                  a row of front, 3/4, side and back (&views= to pick), on one skin and hair colour
 * ?sheet=david     David's 19 faces (face_set_305.py) as they came, eyes + mouth (+ accent), on three skins (&skins=)
 * ?sheet=mix       David's eyes, mouths and accents mixed with each other and with the earlier parts (&skins=)
 * &hair=<0-11>&skin=<0-11>&face=512 (the world atlas) &framing=head|body &charlod=1|2 (every cell at LOD 1 or LOD 2)
 * In ?sheet=roblox an id may carry a head accessory worn with it: &ids=hair_visor_messy+acc_visor (encode the + as %2B in a URL)
 */
import { Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, View } from "@react-three/drei";
import Character, { type CharacterMotion } from "@/components/game/character/Character";
import { DEFAULT_LOOK, FACE, parseLook, partsIn, type CharacterLook, type EyeFrame } from "@/lib/game/character/look";
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
const VIEWS: Record<string, number> = { front: 0, "34": -0.6, side: -Math.PI / 2, back: Math.PI };
/** `&charlod=1|2`: the cells load their LOD meshes and draw that tier (Character's SHOW_LOD). */
const LOD_SHEET = typeof window !== "undefined" && !!new URLSearchParams(window.location.search).get("charlod");
/** Kit sheets hold the eyes open (no blink lands mid-capture). */
const OPEN: FaceOverride = { eyeFrame: "open" };
interface Cell { label: string; look: CharacterLook; yaw: number; face?: FaceOverride | null; talk?: boolean }

function Stage({ cell, framing, faceSize }: { cell: Cell; framing: "head" | "body"; faceSize: number }) {
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: cell.yaw, lift: 0, pose: null, play: null, face: cell.face ?? null, talk: cell.talk ? 1e9 : 0 });
  const head = framing === "head";
  return <>
    <PerspectiveCamera makeDefault fov={30} position={head ? [0, 0.86, 1.3] : [0.15, 0.6, 2.05]} onUpdate={c => c.lookAt(0, head ? 0.8 : 0.5, 0)} />
    <ambientLight intensity={1.1} color="#fff6e6" />
    <hemisphereLight args={["#fff8ec", "#b7c7a8", 0.9]} />
    <directionalLight position={[1.6, 2.6, 2.2]} intensity={1.7} color="#fff1d8" />
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
  const framing = (q.get("framing") as "head" | "body") ?? "head";
  const base: CharacterLook = { ...DEFAULT_LOOK, hair: Number(q.get("hair") ?? 2), skin: Number(q.get("skin") ?? 3) };
  const style = (s: string) => ({ ...base, ...STYLES[s] });
  const yaw = Number(q.get("yaw") ?? -0.5);
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
      return [{ label: `${q.get("label") ?? "look"} front`, look, yaw: 0, face: OPEN }, { label: `${q.get("label") ?? "look"} 3/4`, look, yaw: -0.6, face: OPEN }];
    }
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
        return views.map(v => ({ label: `${item} ${v}`, look: { ...bob, back: id, acc: acc ? { head: acc } : {} }, yaw: VIEWS[v] ?? 0, face: OPEN }));
      });
    }
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
  const cols = sheet === "roblox" ? (q.get("views") ?? "front,34,side,back").split(",").length : sheet === "facekit" ? 13 : sheet === "hairkit" ? 10 : sheet === "fullkit" ? 7 : sheet === "styles" || sheet === "backs" || sheet === "faces" || sheet === "residents" || sheet === "emote" ? 6 : sheet === "hats" || sheet === "mix" ? 8 : sheet === "david" ? 10 : cells.length;
  return <div ref={root} style={{ position: "relative", paddingTop: 48, minHeight: "100vh", background: "#efe7d6" }}>
    <div data-sheet={sheet} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cols === 1 ? "420px" : "1fr"})`, gap: 8, padding: 8 }}>
      {cells.map(c => <figure key={c.label} style={{ margin: 0 }}>
        <View style={{ width: "100%", aspectRatio: framing === "head" ? "1 / 1" : "3 / 4", background: "#f6efe0", borderRadius: 10 }}>
          <Stage cell={c} framing={framing} faceSize={faceSize} />
        </View>
        <figcaption style={{ font: "12px 'IBM Plex Mono', monospace", color: "#5b4a36", textAlign: "center", paddingTop: 4 }}>{c.label}</figcaption>
      </figure>)}
    </div>
    <Canvas style={{ position: "fixed", inset: 0, pointerEvents: "none" }} eventSource={root as React.RefObject<HTMLElement>} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
      <View.Port />
    </Canvas>
  </div>;
}
