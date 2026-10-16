"use client";

/**
 * Character creator (rows 141, 142, 191, 210; layout from David's Li'l Lads reference, 2026-10-08): an icon rail of
 * categories on the left, a big lit 3D portrait that frames the face for face parts and the whole body for clothes,
 * and a paper panel with the category's title, its face sliders, its option tiles and its colour swatches.
 * `mode="wardrobe"` is the same sheet limited to hair, the face parts and clothes (closet and fitting room). On a phone the rail is a
 * tab row along the bottom, the portrait on top and the options between.
 *
 * Categories, options and swatches come from the catalogue (lib/game/character/creatorCategories.ts). Tiles are
 * pictures, never live 3D: face parts are their atlas cells, clothes their item icons, hair a thumbnail baked once.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { RotateCcw, RotateCw, X } from "lucide-react";
import { Button, Field, IconButton } from "@/components/gui";
import { SignInText } from "@/components/gui/SignIn";
import { inTopDialog, useWorldDialog } from "@/lib/game/useWorldDialog";
import { mentionsSignIn } from "@/lib/game/signIn";
import { randomLook, STARTER_PARTS, type CharacterLook } from "@/lib/game/character/look";
import { CATEGORIES, type Category } from "@/lib/game/character/creatorCategories";
import { holdCreatorOpen } from "@/lib/game/character/creatorPresence";
import { tierDpr } from "@/lib/game/qualityTier";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { CategoryRail, CreatorOptions, useNameCheck } from "./CreatorControls";
import { FRAMES, Portrait, ThumbBaker } from "./CreatorStage";
import styles from "./CharacterCreator.module.css";

export interface CreatorProps {
  initial: CharacterLook;
  mode?: "create" | "wardrobe";
  title?: string;
  /** Member game: pick a world name (row 222) checked through /api/identity/name. */
  askName?: { current: string };
  /** Clothes and dyes owned (inventory catalogue refs). The creator offers only these; the wardrobe shows the rest locked. */
  owned?: ReadonlySet<string>;
  /** Wardrobe: a locked item links here (the shop). */
  onShop?: () => void;
  onDone: (look: CharacterLook, name: string | null) => void | Promise<void>;
  onClose?: () => void;
  /** The wardrobe's open and close motion (WardrobeSheet keeps it mounted while it closes); without it, no motion. */
  presence?: "open" | "closing";
}

const STARTERS: ReadonlySet<string> = new Set(STARTER_PARTS);
const stay = () => {};

export default function CharacterCreator({ initial, mode = "create", title, askName, owned = STARTERS, onShop, onDone, onClose, presence }: CreatorProps) {
  const [graphics] = useGraphicsSettings();
  // A dialog (lib/game/useWorldDialog): the world's keys hold still under it (G no longer opens the emotes over it); Escape
  // closes the wardrobe, never the first-login creator. Closing, it lets go at once: focus goes back, the world moves.
  const root = useWorldDialog<HTMLElement>(presence !== "closing", onClose ?? stay, undefined, true);
  // Full screen and opaque: the island under it stops drawing while it's up (DefaultIslandWorld).
  const covering = presence !== "closing";
  useEffect(() => (covering ? holdCreatorOpen() : undefined), [covering]);
  const [look, setLook] = useState(initial);
  const cats = useMemo(() => CATEGORIES.filter(c => mode === "create" || c.wardrobe), [mode]);
  const [catId, setCatId] = useState(cats[0].id);
  const cat = cats.find(c => c.id === catId)!;
  const yaw = useRef({ now: FRAMES[cat.framing].yaw, target: FRAMES[cat.framing].yaw });
  const [saving, setSaving] = useState(false);
  const naming = useNameCheck(askName);
  useEffect(() => { root.current?.querySelector<HTMLButtonElement>("[role=tab][aria-selected=true]")?.focus(); }, [root]);

  const openCat = (c: Category, focus = false) => {
    setCatId(c.id);
    if (FRAMES[c.framing].yaw !== FRAMES[cat.framing].yaw || c.framing !== cat.framing) yaw.current.target = FRAMES[c.framing].yaw;
    if (focus) root.current?.querySelector<HTMLElement>(`[data-cat="${c.id}"]`)?.focus();
  };
  const step = (by: number) => openCat(cats[(cats.indexOf(cat) + by + cats.length) % cats.length], true);
  const live = useRef(step);
  useEffect(() => { live.current = step; });
  useEffect(() => {
    // The menu's tab keys ([ and ], remappable) arrive as tsi:menu-tab inside the top dialog, as for the kit's Tabs.
    const on = (e: Event) => { if (inTopDialog(root.current)) live.current((e as CustomEvent<{ step: number }>).detail.step); };
    window.addEventListener("tsi:menu-tab", on);
    return () => window.removeEventListener("tsi:menu-tab", on);
  }, [root]);

  const confirm = async (final: CharacterLook) => {
    setSaving(true);
    await onDone(final, naming.wanted);
    setSaving(false);
  };

  // Drag the portrait to turn the character.
  const drag = useRef<{ x: number; id: number } | null>(null);
  const turnBy = (rad: number) => { yaw.current.target += rad; };


  return <section ref={root} className={styles.creator} role="dialog" aria-modal="true" aria-labelledby="creator-title" data-mode={mode} data-state={presence}>
    <CategoryRail cats={cats} cat={cat} onOpen={openCat} />

    <div className={styles.portrait} data-framing={cat.framing}
      onPointerDown={e => { if (e.button !== 0 || (e.target as Element).closest("button")) return; drag.current = { x: e.clientX, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { const d = drag.current; if (!d || d.id !== e.pointerId) return; const dx = e.clientX - d.x; d.x = e.clientX; yaw.current.target += dx * 0.012; yaw.current.now = yaw.current.target; }}
      onPointerUp={e => { if (drag.current?.id === e.pointerId) drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <h1 id="creator-title" className={styles.heading}>{title ?? (mode === "wardrobe" ? "Your closet" : "Make your character")}</h1>
      <Canvas className={styles.canvas} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} dpr={tierDpr(graphics.liteMode, [1, 2])} camera={{ fov: FRAMES.face.fov, near: 0.05, far: 30 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
          if (process.env.NODE_ENV !== "production") (window as unknown as { __creatorGl?: THREE.WebGLRenderer }).__creatorGl = gl;
        }}>
        <Portrait look={look} framing={cat.framing} yaw={yaw} />
        <ThumbBaker />
      </Canvas>
      <p className={styles.dragHint} aria-hidden="true">Drag to turn</p>
      <div className={styles.turn}>
        <IconButton label="Turn left" onClick={() => turnBy(-Math.PI / 4)}><RotateCcw size={20} strokeWidth={2.4} /></IconButton>
        <IconButton label="Turn right" onClick={() => turnBy(Math.PI / 4)}><RotateCw size={20} strokeWidth={2.4} /></IconButton>
      </div>
    </div>

    <div className={styles.panel} role="tabpanel" id="creator-panel" aria-labelledby={`creator-tab-${cat.id}`}>
      <header className={styles.panelHead}>
        <h2 className={styles.title}>{cat.label}</h2>
        {onClose && <IconButton label="Close" onClick={onClose} className={styles.close}><X size={20} strokeWidth={2.6} /></IconButton>}
      </header>
      <div className={styles.body}>
        <CreatorOptions key={mode} cat={cat} look={look} setLook={setLook} mode={mode} owned={owned} onShop={onShop} />
      </div>
      <footer className={styles.foot}>
        {askName && <Field label="Your name on the island" hint="Letters and numbers; everyone in the world sees it." value={naming.name} maxLength={24}
          onChange={e => naming.type(e.target.value)} error={naming.nameNote && !naming.nameNote.ok && !mentionsSignIn(naming.nameNote.text) ? naming.nameNote.text : undefined} className={styles.name} />}
        {askName && naming.nameNote?.ok && <p className={styles.nameOk} role="status">{naming.nameNote.text}</p>}
        {askName && naming.nameNote && !naming.nameNote.ok && mentionsSignIn(naming.nameNote.text) && <p className={styles.nameOk} role="status"><SignInText text={naming.nameNote.text} /></p>}
        <div className={styles.actions}>
          {mode === "create" && <Button variant="quiet" onClick={() => setLook(randomLook(Math.random, owned))}>Surprise me</Button>}
          {mode === "create" && <Button variant="quiet" disabled={saving} onClick={() => void confirm(randomLook(Math.random, owned))}>Skip</Button>}
          <Button disabled={saving} onClick={() => void confirm(look)}>{mode === "wardrobe" ? "Wear this" : "That's me"}</Button>
        </div>
      </footer>
    </div>
  </section>;
}
