"use client";

/**
 * /lab/avatar: the avatar v7 bench (specs/avatar-v7.md item 5). The real runtime Character (v7 head, sculpted-lock
 * hair, the animated painted face) under the character creator's camera and lights, in a grid of
 * cells that each force a look, a turn and a face frame, so review sheets and the blink/talk strips are
 * deterministic. Dev-only via the lab layout.
 *
 * ?sheet=styles    the three milestone styles, front and 3/4, head close-ups (faces at 1024)
 * ?sheet=expr      the six expressions (bob), 3/4 head close-ups
 * ?sheet=blink     one blink: open, half, closed, half, open
 * ?sheet=talk      the talk frames: the look's mouth, then each talk cell
 * ?sheet=live      one character at a time, the face on its own clock (blinks, &talk=1 talks); &style=, &yaw=
 * ?sheet=bangs     every bangs style over a back (&back=, back_bob); ?sheet=backs every back under a bangs (&bangs=)
 * ?sheet=hats      the four hats (they hide the back hair and carry a lock tuck), front and back 3/4
 * ?sheet=faces     row 301's face set (sleepy and dot eyes, cat and curled-grin mouths, the blush band) on three skins (&skins=)
 * ?sheet=david     David's 19 faces (face_set_305.py) as they came, eyes + mouth (+ accent), no brows, on three skins (&skins=)
 * ?sheet=mix       David's eyes, mouths and accents mixed with each other and with the earlier parts (&skins=)
 * &hair=<0-11>&skin=<0-11>&face=512 (the world atlas) &framing=head|body
 */
import { Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, View } from "@react-three/drei";
import Character, { type CharacterMotion } from "@/components/game/character/Character";
import { DEFAULT_LOOK, FACE, partsIn, type CharacterLook, type EyeFrame } from "@/lib/game/character/look";
import { EXPRESSIONS, type FaceOverride } from "@/lib/game/character/face";

const STYLES: Record<string, Pick<CharacterLook, "bangs" | "back">> = {
  short: { bangs: "bangs_spiky", back: "back_short_spiky" },
  bob: { bangs: "bangs_straight", back: "back_bob" },
  long: { bangs: "bangs_curtain", back: "back_long" },
};
interface Cell { label: string; look: CharacterLook; yaw: number; face?: FaceOverride | null; talk?: boolean }

function Stage({ cell, framing, faceSize }: { cell: Cell; framing: "head" | "body"; faceSize: number }) {
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: cell.yaw, lift: 0, pose: null, play: null, face: cell.face ?? null, talk: cell.talk ? 1e9 : 0 });
  const head = framing === "head";
  return <>
    <PerspectiveCamera makeDefault fov={30} position={head ? [0, 0.86, 1.3] : [0.15, 0.6, 2.05]} onUpdate={c => c.lookAt(0, head ? 0.8 : 0.5, 0)} />
    <ambientLight intensity={1.1} color="#fff6e6" />
    <hemisphereLight args={["#fff8ec", "#b7c7a8", 0.9]} />
    <directionalLight position={[1.6, 2.6, 2.2]} intensity={1.7} color="#fff1d8" />
    <Suspense fallback={null}><Character look={cell.look} motion={motion} scale={1} faceSize={faceSize} lod={false} /></Suspense>
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
  const cells = useMemo<Cell[]>(() => {
    const bob = style(q.get("style") ?? "bob");
    if (sheet === "expr") return EXPRESSIONS.map(e => ({ label: e, look: bob, yaw, face: { expression: e, eyeFrame: FACE.expressions[e].eyeFrame } }));
    if (sheet === "blink") return (["open", "half", "closed", "half", "open"] as EyeFrame[]).map((f, i) => ({ label: `${i + 1}: ${f}`, look: bob, yaw: 0, face: { eyeFrame: f } }));
    if (sheet === "talk") return [bob.mouth, ...FACE.talk.frames].map(m => ({ label: m, look: bob, yaw: 0, face: { mouth: m } }));
    if (sheet === "live") return [{ label: q.get("style") ?? "bob", look: bob, yaw, talk: q.get("talk") === "1" }];
    // the whole library on the v7 head: every bangs over the bob back, every back under the straight fringe
    if (sheet === "bangs") return partsIn("bangs").map(p => ({ label: p.id, look: { ...bob, bangs: p.id, back: q.get("back") ?? "back_bob" }, yaw }));
    if (sheet === "backs") return partsIn("back").map(p => ({ label: p.id, look: { ...bob, bangs: q.get("bangs") ?? "bangs_straight", back: p.id }, yaw: yaw - 0.9 }));
    if (sheet === "hats") return ["acc_sunhat", "acc_cap", "acc_beanie", "acc_straw_hat"].flatMap(h => [
      { label: `${h} front`, look: { ...bob, acc: { head: h } }, yaw }, { label: `${h} back`, look: { ...bob, acc: { head: h } }, yaw: yaw + 2.6 }]);
    if (sheet === "faces") return (q.get("skins") ?? "1,5,10").split(",").map(Number).flatMap(skin => ([
      ["sleepy_lash", "cat_w", ["blush_band"], 0], ["dot", "grin_curl", [], 0], ["sleepy_lash", "M1.1", [], 0],
      ["dot", "cat_w", ["blush_band"], 0], ["F1.1", "grin_curl", ["blush_band"], 0], ["sleepy_lash", "cat_w", ["blush_band"], yaw],
    ] as [string, string, string[], number][]).map(([eyes, mouth, extras, y]) => ({
      label: `skin ${skin} ${eyes} ${mouth}${extras.length ? " +band" : ""}${y ? " 3/4" : ""}`, look: { ...bob, skin, eyes, mouth, extras }, yaw: y })));
    // David's faces: the second atlas page's eyes and mouths, in his order (face_set_305.FACES), with his two accents
    const davidEyes = Object.keys(FACE.layers.eyes.items).filter(id => FACE.layers.eyes.items[id].open[6] === 1);
    const davidMouths = Object.keys(FACE.layers.mouth.items).filter(id => FACE.layers.mouth.items[id][6] === 1);
    const open = { ...bob, bangs: "bangs_swept_back", back: "back_bun", brows: "brow_none" };   // a clear forehead, his own brows
    const skins = (q.get("skins") ?? "1,5,10").split(",").map(Number);
    if (sheet === "david") return skins.flatMap(skin => davidEyes.map((eyes, i) => ({
      label: `${skin}: ${i + 1} ${FACE.names[eyes]} / ${FACE.names[davidMouths[i]]}`,
      look: { ...open, skin, eyes, mouth: davidMouths[i], extras: i === 5 ? ["nose_blush"] : i === 13 ? ["sweat_drop"] : [] }, yaw: 0 })));
    if (sheet === "mix") return skins.flatMap(skin => ([
      ["swirl", "drool", ["sweat_drop"], "brow_none", 0], ["bean", "kitty", ["nose_blush"], "brow_none", 0], ["sleepy", "gritted", [], "brow_none", 0],
      ["F1.1", "drumstick", [], "brow_soft", 0], ["doll_lash", "M1.1", ["blush_band"], "brow_none", 0], ["dot", "nervous_laugh", ["sweat_drop"], "brow_soft", 0],
      ["teary", "buck_tooth", [], "brow_none", 0], ["chill", "cat_w", ["nose_blush"], "brow_none", yaw],
    ] as [string, string, string[], string, number][]).map(([eyes, mouth, extras, brows, y]) => ({
      label: `${skin}: ${FACE.names[eyes] ?? eyes} / ${FACE.names[mouth] ?? mouth}${extras.length ? ` + ${FACE.names[extras[0]] ?? extras[0]}` : ""}${y ? " 3/4" : ""}`,
      look: { ...open, skin, eyes, mouth, extras, brows }, yaw: y })));
    return Object.keys(STYLES).flatMap(s => [{ label: `${s} front`, look: style(s), yaw: 0 }, { label: `${s} 3/4`, look: style(s), yaw: -0.6 }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, yaw, q]);
  const root = useRef<HTMLDivElement>(null);
  const cols = sheet === "styles" || sheet === "backs" || sheet === "faces" ? 6 : sheet === "bangs" || sheet === "hats" || sheet === "mix" ? 8 : sheet === "david" ? 10 : cells.length;
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
