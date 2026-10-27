"use client";

/**
 * The reflection creator (specs/v1-drop.md §1.3; David's sketch, references/ui/creator/2026-10-13-reflection-creator-sketch.png):
 * the left two-thirds is the scene (the boat's edge on a diagonal, the back of your head leaning over it, your reflection
 * in the water), the options panel sits right of it, the category rail runs down the far right edge, and a "That's me" pill
 * floats on the water at the bottom. On a phone the scene is on top with the pill on its water, the options under it and
 * the rail a tab row along the bottom.
 *
 * The creator's data and controls are the Li'l Lads creator's (CreatorControls: the catalogue's categories, tiles,
 * swatches and face sliders; no colour wheel here, David 2026-10-26: it is a shop unlock in the wardrobe). Each change
 * sends a small foam-capped wave rolling past that rewrites that feature (the scene's look catches up as its crest
 * crosses your face), and counts as a choice: each sharpens the world a little (the sequence's clarity), "That's me"
 * clears it. The same canvas shows the aboard beat before it, the panels out of the way.
 */
import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Field } from "@/components/gui";
import { SignInText } from "@/components/gui/SignIn";
import { mentionsSignIn } from "@/lib/game/signIn";
import { inTopDialog, useWorldDialog } from "@/lib/game/useWorldDialog";
import { STARTER_PARTS, type CharacterLook } from "@/lib/game/character/look";
import { CATEGORIES, type Category } from "@/lib/game/character/creatorCategories";
import { CategoryRail, CreatorOptions, useNameCheck } from "@/components/game/character/CreatorControls";
import { arrivalRun } from "@/lib/game/arrival/arrivalStore";
import { BOAT_LINES, BRAM, YES_LABEL } from "@/lib/game/arrival/lines";
import type { ArrivalPhase } from "@/lib/game/arrival/sequence";
import { AudioManager } from "@/lib/game/audio";
import { tierDpr } from "@/lib/game/qualityTier";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import ReflectionScene, { WAVE_MAX, waveReach } from "./ReflectionScene";
import cc from "@/components/game/character/CharacterCreator.module.css";
import s from "./ReflectionCreator.module.css";

const STARTERS: ReadonlySet<string> = new Set(STARTER_PARTS);
/** Slider drags count as one choice per this long. */
const CHOICE_EVERY_MS = 700;

export default function ReflectionCreator({ phase, initial, askName, onYes }: {
  phase: ArrivalPhase;
  initial: CharacterLook;
  askName?: { current: string };
  /** "That's me": the look (and the name, if typed) to keep. */
  onYes: (look: CharacterLook, name: string | null) => void;
}) {
  const creating = phase === "creator";
  const [graphics] = useGraphicsSettings();
  const root = useWorldDialog<HTMLElement>(true, () => {}, undefined, true);
  const [look, setLook] = useState(initial);
  // What the water shows: it follows the panel's look as each wave's crest crosses your face.
  const [shown, setShown] = useState(initial);
  const [catId, setCatId] = useState(CATEGORIES[0].id);
  const cat = CATEGORIES.find(c => c.id === catId)!;
  const naming = useNameCheck(askName);
  const waves = useRef<number[]>([]);
  const clock = useRef(0);
  const lastChoice = useRef(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const view = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [yes, setYes] = useState(false);

  // Where the scene shows once the panels are in: the scene column's rect within the canvas (which fills the screen).
  useEffect(() => {
    const measure = () => {
      const el = sceneRef.current, host = root.current;
      if (!el || !host) return;
      const a = el.getBoundingClientRect(), b = host.getBoundingClientRect();
      view.current = { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (sceneRef.current) ro.observe(sceneRef.current);
    return () => ro.disconnect();
  }, [root]);

  // Bram's words over the scene: aboard his two lines, then the prompt as you lean over, a word as it comes back, "That's me".
  const [second, setSecond] = useState(false), [coming, setComing] = useState(false);
  useEffect(() => {
    if (phase !== "aboard") return;
    const t = window.setTimeout(() => setSecond(true), 1900);
    return () => window.clearTimeout(t);
  }, [phase]);
  const said = phase === "aboard" ? BOAT_LINES.aboard[second ? 1 : 0] : phase === "creator" ? (coming ? BOAT_LINES.coming : BOAT_LINES.reflection) : phase === "clearing" ? BOAT_LINES.yes : null;
  useEffect(() => {
    if (!said) return;
    AudioManager.playBlip();
    const blips = [140, 300].map(ms => window.setTimeout(() => AudioManager.playBlip(), ms));
    return () => blips.forEach(window.clearTimeout);
  }, [said]);

  // A change: a small wave rolls past and the water rewrites you as its crest crosses your face. A wave still on its way
  // to your face carries the change too; once it is past, the next change sets a new one off behind it.
  const change = () => {
    const a = arrivalRun.current, nowMs = performance.now();
    if (a && nowMs - lastChoice.current > CHOICE_EVERY_MS) {
      lastChoice.current = nowMs;
      a.choices++;
      if (a.choices === 3) setComing(true);
    }
    const last = waves.current.at(-1);
    if (last === undefined || clock.current - last >= waveReach()) {
      waves.current.push(clock.current);
      if (waves.current.length > WAVE_MAX) waves.current.shift();
    }
    AudioManager.playSFX("blip2", { rate: 0.55 + Math.random() * 0.1, gain: 0.35 });
  };
  useEffect(() => {
    if (look === shown) return;
    const last = waves.current.at(-1) ?? -Infinity;
    const t = window.setTimeout(() => setShown(look), Math.max(0, (last + waveReach() - clock.current) * 1000));
    return () => window.clearTimeout(t);
  }, [look, shown]);

  const openCat = (c: Category, focus = false) => {
    setCatId(c.id);
    if (focus) root.current?.querySelector<HTMLElement>(`[data-cat="${c.id}"]`)?.focus();
  };
  const step = (by: number) => openCat(CATEGORIES[(CATEGORIES.indexOf(cat) + by + CATEGORIES.length) % CATEGORIES.length], true);
  const live = useRef(step);
  useEffect(() => { live.current = step; });
  useEffect(() => {
    const on = (e: Event) => { if (inTopDialog(root.current)) live.current((e as CustomEvent<{ step: number }>).detail.step); };
    window.addEventListener("tsi:menu-tab", on);
    return () => window.removeEventListener("tsi:menu-tab", on);
  }, [root]);

  const confirm = () => {
    if (yes) return;
    setYes(true);
    setShown(look);
    AudioManager.playSFX("confirm");
    onYes(look, naming.wanted);
  };
  return <section ref={root} tabIndex={-1} className={s.root} role="dialog" aria-modal="true" aria-label="Your reflection in the water" data-phase={phase} data-testid="reflection-creator">
    <Canvas className={s.canvas} gl={{ antialias: false, powerPreference: "high-performance" }} dpr={tierDpr(graphics.liteMode, [1, 2])} camera={{ fov: 40, near: 0.05, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
        if (process.env.NODE_ENV !== "production") (window as unknown as { __reflectGl?: THREE.WebGLRenderer }).__reflectGl = gl;
      }}>
      <ReflectionScene look={shown} waves={waves} clock={clock} view={view} />
    </Canvas>
    <div ref={sceneRef} className={s.scene}>
      {said && <p key={said} className={s.bubble} role="status"><b>{BRAM.name}</b><span>{said}</span></p>}
      {creating && <button type="button" className={s.yes} onClick={confirm} disabled={yes} data-testid="reflection-yes">{YES_LABEL}</button>}
    </div>
    <div className={`${cc.panel} ${s.panel}`} role="tabpanel" id="creator-panel" aria-labelledby={`creator-tab-${cat.id}`} aria-hidden={!creating} inert={!creating}>
      <header className={cc.panelHead}><h2 className={cc.title}>{cat.label}</h2></header>
      <div className={cc.body}>
        <CreatorOptions cat={cat} look={look} setLook={setLook} mode="create" owned={STARTERS} onChange={change} wheel={false} />
      </div>
      {askName && <footer className={cc.foot}>
        <Field label="Your name on the island" hint="Letters and numbers; everyone in the world sees it." value={naming.name} maxLength={24}
          onChange={e => naming.type(e.target.value)} error={naming.nameNote && !naming.nameNote.ok && !mentionsSignIn(naming.nameNote.text) ? naming.nameNote.text : undefined} className={cc.name} />
        {naming.nameNote?.ok && <p className={cc.nameOk} role="status">{naming.nameNote.text}</p>}
        {naming.nameNote && !naming.nameNote.ok && mentionsSignIn(naming.nameNote.text) && <p className={cc.nameOk} role="status"><SignInText text={naming.nameNote.text} /></p>}
      </footer>}
    </div>
    <div className={s.railWrap} aria-hidden={!creating} inert={!creating}>
      <CategoryRail cats={CATEGORIES} cat={cat} onOpen={openCat} className={`${cc.rail} ${s.rail}`} />
    </div>
  </section>;
}
