"use client";

/**
 * Character creator (rows 141, 142, 191, 210; layout from David's Li'l Lads reference, 2026-10-08): an icon rail of
 * categories on the left, a big lit 3D portrait that frames the face for face parts and the whole body for clothes,
 * and a paper panel with the category's title, its face sliders, its option tiles and its colour swatches.
 * `mode="wardrobe"` is the same sheet limited to hair and clothes (closet and fitting room). On a phone the rail is a
 * tab row along the bottom, the portrait on top and the options between.
 *
 * Categories, options and swatches come from the catalogue (lib/game/character/creatorCategories.ts). Tiles are
 * pictures, never live 3D: face parts are their atlas cells, clothes their item icons, hair a thumbnail baked once.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Lock, RotateCcw, RotateCw, X } from "lucide-react";
import { Button, Field, IconButton, Slider } from "@/components/gui";
import { SignInText } from "@/components/gui/SignIn";
import { inTopDialog, useWorldDialog } from "@/lib/game/useWorldDialog";
import { mentionsSignIn } from "@/lib/game/signIn";
import { iconUrl } from "@/lib/icons/keys";
import { dyeRef, FACE, FACE_ATLAS_URLS, FACE_ATLAS2_URLS, FREE_HAIR_COLOURS, PALETTE, PART_BY_ID, PLACE_PARTS, PLACE_STEPS, partColor, partRef, randomLook, STARTER_PARTS,
  type CharacterLook, type FaceCell, type Placement } from "@/lib/game/character/look";
import { CATEGORIES, choose, colourTarget, isOn, optionName, type Category, type Section } from "@/lib/game/character/creatorCategories";
import { holdCreatorOpen } from "@/lib/game/character/creatorPresence";
import { PLACE_RANGE } from "@/lib/game/character/face";
import CreatorIcon from "./CreatorIcon";
import { FRAMES, Portrait, ThumbBaker, prioritiseThumbs, thumbJob, useThumb } from "./CreatorStage";
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
const SLIDERS: { i: 0 | 1 | 2 | 3; label: string; say: (v: number) => string }[] = [
  { i: 0, label: "Down – Up", say: v => (v ? `${Math.abs(v)} ${v > 0 ? "up" : "down"}` : "centred") },
  { i: 1, label: "Left – Right", say: v => (v ? `${Math.abs(v)} ${v > 0 ? "apart" : "closer"}` : "centred") },
  { i: 2, label: "Rotate", say: v => (v ? `${v > 0 ? "+" : "−"}${Math.round((Math.abs(v) / PLACE_STEPS) * PLACE_RANGE.rotate)}°` : "level") },
  { i: 3, label: "Smaller – Bigger", say: v => (v ? `${Math.round(PLACE_RANGE.size ** (v / PLACE_STEPS) * 100)}%` : "100%") },
];

export default function CharacterCreator({ initial, mode = "create", title, askName, owned = STARTERS, onShop, onDone, onClose, presence }: CreatorProps) {
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
  const [lastAccessory, setLastAccessory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lockNote, setLockNote] = useState<string | null>(null);
  // Identity (face, hair styles, the free colours) is always free; clothes and dyes are owned (ruling on audit item 22).
  const has = (id: string | null) => { const ref = id && partRef(id); return !ref || owned.has(ref); };
  const hasHair = (i: number) => i < FREE_HAIR_COLOURS || owned.has(dyeRef(i));
  const crafted = (id: string | null) => !!id && !!PART_BY_ID.get(id)?.item; // unlocked by a crafted item, never sold
  const target = colourTarget(cat, look, lastAccessory);
  const [name, setName] = useState(askName?.current === "You" ? "" : askName?.current ?? "");
  const [nameNote, setNameNote] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { root.current?.querySelector<HTMLButtonElement>("[role=tab][aria-selected=true]")?.focus(); }, [root]);
  useEffect(() => {
    if (!askName || !name.trim() || name.trim() === askName.current) return;
    const timer = window.setTimeout(() => {
      // Signed out the route says "Unauthorized": said as a sign-in instead, whose words link back here (reachability §3).
      void fetch(`/api/identity/name?check=${encodeURIComponent(name.trim())}`).then(r => (r.status === 401 ? { ok: false, error: "Sign in to pick a name." } : r.json())).then(b => {
        setNameNote(b?.ok ? { ok: b.data.available, text: b.data.available ? "That name is free." : "Someone already has that name." } : { ok: false, text: b?.error ?? "Sign in to pick a name." });
      }).catch(() => setNameNote({ ok: false, text: "Couldn't check the name right now." }));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [name, askName]);

  const openCat = (c: Category, focus = false) => {
    setCatId(c.id);
    setLockNote(null);
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
  const railKey = (e: React.KeyboardEvent) => {
    const by = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (by) { e.preventDefault(); step(by); }
    else if (e.key === "Home" || e.key === "End") { e.preventDefault(); openCat(e.key === "Home" ? cats[0] : cats[cats.length - 1], true); }
  };

  const pick = (section: Section, id: string | null) => {
    setLockNote(has(id) ? null : `${optionName(section, id)} is ${crafted(id) ? "made at the workbench" : "sold in the shop"}.`);
    if (!has(id)) return;
    setLook(l => choose(l, section, id));
    if ("slot" in section.source && section.source.slot === "accessory" && id) setLastAccessory(id);
  };
  const paint = (i: number) => {
    const locked = cat.swatch === "hair" && !hasHair(i);
    setLockNote(locked ? "That colour is a hair dye from the shop." : null);
    if (!locked) setLook(l => {
      if (cat.swatch === "skin") return { ...l, skin: i };
      if (cat.swatch === "hair") return { ...l, hair: i };
      return target ? { ...l, colors: { ...l.colors, [target]: i } } : l;
    });
  };
  const swatches = !cat.swatch ? [] : cat.swatch === "hair" && mode === "create" ? PALETTE.hair.slice(0, FREE_HAIR_COLOURS) : PALETTE[cat.swatch];
  const swatchOn = (i: number) => cat.swatch === "skin" ? look.skin === i : cat.swatch === "hair" ? look.hair === i : target !== null && partColor(look, target) === i;
  const place = cat.place ? look.place?.[cat.place] ?? [0, 0, 0, 0] as Placement : null;
  const setPlace = (i: number, v: number) => setLook(l => {
    if (!cat.place) return l;
    const p = [...(l.place?.[cat.place] ?? [0, 0, 0, 0])] as Placement;
    p[i] = v;
    const next: NonNullable<CharacterLook["place"]> = { ...l.place, [cat.place]: p };
    if (p.every(x => x === 0)) delete next[cat.place];
    const out: CharacterLook = { ...l, place: next };
    if (!Object.keys(next).length) delete out.place;
    return out;
  });
  const confirm = async (final: CharacterLook) => {
    setSaving(true);
    // The typed name goes with the look unless the check already said it's taken: confirming inside the check's 400 ms,
    // or pressing Skip, used to drop it. The server checks again; a failure is surfaced (PlayerCharacterUI).
    const wanted = askName && name.trim() && name.trim() !== askName.current && nameNote?.ok !== false ? name.trim() : null;
    await onDone(final, wanted);
    setSaving(false);
  };

  // Drag the portrait to turn the character.
  const drag = useRef<{ x: number; id: number } | null>(null);
  const turnBy = (rad: number) => { yaw.current.target += rad; };
  const shownTiles = cat.sections.flatMap(s => s.options.filter(id => mode !== "create" || has(id)));
  const thumbKeys = new Set(shownTiles.flatMap(id => (id && needsBake(id) ? [thumbJob(id, look).key] : [])));
  useEffect(() => { prioritiseThumbs(thumbKeys); });

  return <section ref={root} className={styles.creator} role="dialog" aria-modal="true" aria-labelledby="creator-title" data-mode={mode} data-state={presence}>
    <nav className={styles.rail} role="tablist" aria-label="Categories" aria-orientation="vertical" onKeyDown={railKey}>
      {cats.map(c => <button key={c.id} type="button" role="tab" data-cat={c.id} id={`creator-tab-${c.id}`} aria-selected={c.id === cat.id} aria-controls="creator-panel"
        tabIndex={c.id === cat.id ? 0 : -1} aria-label={c.label} title={c.label} onClick={() => openCat(c)} className={styles.railTab}>
        {c.itemIcon
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={iconUrl(c.itemIcon)} alt="" width={40} height={40} draggable={false} />
          : <CreatorIcon icon={c.icon} size={34} />}
      </button>)}
    </nav>

    <div className={styles.portrait} data-framing={cat.framing}
      onPointerDown={e => { if (e.button !== 0 || (e.target as Element).closest("button")) return; drag.current = { x: e.clientX, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { const d = drag.current; if (!d || d.id !== e.pointerId) return; const dx = e.clientX - d.x; d.x = e.clientX; yaw.current.target += dx * 0.012; yaw.current.now = yaw.current.target; }}
      onPointerUp={e => { if (drag.current?.id === e.pointerId) drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <h1 id="creator-title" className={styles.heading}>{title ?? (mode === "wardrobe" ? "Your closet" : "Make your character")}</h1>
      <Canvas className={styles.canvas} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} dpr={[1, 2]} camera={{ fov: FRAMES.face.fov, near: 0.05, far: 30 }}
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
        {place && cat.place && <div className={styles.sliders} role="group" aria-label={`${cat.label} placement`}>
          {SLIDERS.filter(s => s.i !== 1 || PLACE_PARTS[cat.place!].apart).map(s => <Slider key={s.i} className={styles.slider} label={s.label} min={-PLACE_STEPS} max={PLACE_STEPS} value={place[s.i]}
            onChange={v => setPlace(s.i, v)} format={s.say} />)}
          <Button variant="quiet" className={styles.reset} disabled={place.every(v => v === 0)} onClick={() => setLook(l => {
            const next: NonNullable<CharacterLook["place"]> = { ...l.place }; delete next[cat.place!];
            const out: CharacterLook = { ...l, place: next }; if (!Object.keys(next).length) delete out.place; return out;
          })}>Reset</Button>
        </div>}
        {cat.sections.map(section => {
          const options = section.options.filter(id => mode !== "create" || has(id));
          if (!options.length) return null;
          return <section key={section.id} className={styles.section} aria-label={section.label}>
            {cat.sections.length > 1 && <h3>{section.label}</h3>}
            <ul className={styles.tiles} data-face={"face" in section.source || undefined}>
              {options.map(id => {
                const locked = !has(id);
                const label = optionName(section, id);
                return <li key={id ?? "none"}>
                  <button type="button" className={styles.tile} aria-pressed={isOn(look, section, id)} data-locked={locked || undefined} onClick={() => pick(section, id)}
                    aria-label={locked ? `${label} (${crafted(id) ? "crafted" : "in the shop"})` : label} title={label}>
                    {"face" in section.source ? <FaceArt layer={section.source.face} id={id!} look={look} /> : id ? <PartArt id={id} look={look} /> : <span className={styles.none}>None</span>}
                    {locked && <Lock size={13} strokeWidth={2.6} aria-hidden className={styles.lock} />}
                  </button>
                </li>;
              })}
            </ul>
          </section>;
        })}
        {cat.sections.length > 0 && shownTiles.length === 0 && <p className={styles.empty}>
          Nothing here yet. These come from the shop and the workbench; once you have some, try them on in your closet.</p>}
        {swatches.length > 0 && (cat.swatch !== "outfit" || shownTiles.length > 0) && <div className={styles.swatchBlock}>
          <h3>{cat.swatch === "skin" ? "Skin" : cat.swatch === "hair" ? (cat.id === "brows" ? "Brow and hair colour" : "Hair colour") : target ? `${PART_BY_ID.get(target)?.name ?? "Its"} colour` : "Colour"}</h3>
          <div className={styles.swatches} role="group" aria-label={`${cat.swatch} colours`} data-kind={cat.swatch}>
            {swatches.map((hex, i) => {
              const locked = cat.swatch === "hair" && !hasHair(i);
              return <button key={hex} type="button" style={{ "--swatch": hex } as CSSProperties} aria-pressed={swatchOn(i)}
                aria-label={`${cat.swatch} colour ${i + 1}${locked ? " (hair dye in the shop)" : ""}`} data-locked={locked || undefined}
                disabled={cat.swatch === "outfit" && !target} onClick={() => paint(i)} />;
            })}
          </div>
          {cat.swatch === "outfit" && !target && <p className={styles.hint}>Wear something here to colour it.</p>}
        </div>}
        {lockNote && <p className={styles.lockNote} role="status">{lockNote}{onShop && <button type="button" onClick={onShop}>Visit the shop</button>}</p>}
      </div>
      <footer className={styles.foot}>
        {askName && <Field label="Your name on the island" hint="Letters and numbers; everyone in the world sees it." value={name} maxLength={24}
          onChange={e => { setName(e.target.value); setNameNote(null); }} error={nameNote && !nameNote.ok && !mentionsSignIn(nameNote.text) ? nameNote.text : undefined} className={styles.name} />}
        {askName && nameNote?.ok && <p className={styles.nameOk} role="status">{nameNote.text}</p>}
        {askName && nameNote && !nameNote.ok && mentionsSignIn(nameNote.text) && <p className={styles.nameOk} role="status"><SignInText text={nameNote.text} /></p>}
        <div className={styles.actions}>
          {mode === "create" && <Button variant="quiet" onClick={() => setLook(randomLook(Math.random, owned))}>Surprise me</Button>}
          {mode === "create" && <Button variant="quiet" disabled={saving} onClick={() => void confirm(randomLook(Math.random, owned))}>Skip</Button>}
          <Button disabled={saving} onClick={() => void confirm(look)}>{mode === "wardrobe" ? "Wear this" : "That's me"}</Button>
        </div>
      </footer>
    </div>
  </section>;
}

/** Hair has no item icon: its tile is a baked thumbnail. So is any part whose item icon is missing. */
const needsBake = (id: string) => { const slot = PART_BY_ID.get(id)?.slot; return slot === "bangs" || slot === "back"; };

function PartArt({ id, look }: { id: string; look: CharacterLook }) {
  const [iconFailed, setIconFailed] = useState(false);
  const bake = needsBake(id) || iconFailed;
  const job = useMemo(() => (bake ? thumbJob(id, look) : null), [bake, id, look]);
  const src = useThumb(job);
  // eslint-disable-next-line @next/next/no-img-element
  if (!bake) return <img src={iconUrl(id)} alt="" width={64} height={64} draggable={false} onError={() => setIconFailed(true)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" width={80} height={80} draggable={false} /> : <span className={styles.baking} aria-hidden="true" />;
}

/** The least of the face a tile shows (canvas units), so a mole or a freckle keeps its size against the face. */
const MIN_SPAN = { eyes: 0.5, brows: 0.5, mouth: 0.3, extras: 0.62 } as const;
/** A face part as it sits on the face: its atlas cells at their anchors (both sides for paired parts), on the skin. */
function FaceArt({ layer, id, look }: { layer: "eyes" | "brows" | "mouth" | "extras"; id: string; look: CharacterLook }) {
  const L = FACE.layers, A = FACE.anchors;
  const pieces: { cell: FaceCell; anchor: [number, number]; mirror: boolean }[] = [];
  if (layer === "eyes") {
    // David's pairs (face set 305): two cells (the canvas-right eye its own `left` cell) or one cell on the centre line
    const it = L.eyes.items[id];
    if (it?.left === null) pieces.push({ cell: it.open, anchor: A.eye_pair, mirror: false });
    else if (it?.left) pieces.push({ cell: it.open, anchor: A.eye, mirror: false }, { cell: it.left, anchor: A.eye_left, mirror: false });
    else if (it) pieces.push({ cell: it.open, anchor: A.eye, mirror: true });
  }
  else if (layer === "brows") { const c = L.brows.items[id]; if (c?.[2]) pieces.push({ cell: c, anchor: A.brow, mirror: true }); }   // brow_none: an empty cell
  else if (layer === "mouth") { const c = L.mouth.items[id]; if (c) pieces.push({ cell: c, anchor: A.mouth, mirror: false }); }
  else { const it = L.extras.items[id]; if (it) pieces.push({ cell: it.cell, anchor: A[it.anchor], mirror: it.mirror }); }
  const k = 1 / FACE.density;
  const rects = pieces.flatMap(p => {
    const [, , w, h, ax, ay] = p.cell, u0 = p.anchor[0] - ax * k, w0 = p.anchor[1] - ay * k, r = { cell: p.cell, u0, w0, u1: u0 + w * k, w1: w0 + h * k, flip: false };
    return p.mirror ? [r, { ...r, u0: 1 - r.u1, u1: 1 - r.u0, flip: true }] : [r];
  });
  if (!rects.length) return <span className={styles.face} style={{ "--skin": PALETTE.skin[look.skin] } as CSSProperties} />;
  // The view: the parts' bounds with a little room, square, centred.
  const u0 = Math.min(...rects.map(r => r.u0)), u1 = Math.max(...rects.map(r => r.u1)), w0 = Math.min(...rects.map(r => r.w0)), w1 = Math.max(...rects.map(r => r.w1));
  const span = Math.max(u1 - u0, w1 - w0, MIN_SPAN[layer]) * 1.18, cu = (u0 + u1) / 2, cw = (w0 + w1) / 2;
  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
  const tint = layer === "brows" && L.brows.tint === "hair" ? PALETTE.hair[look.hair] : null;
  return <span className={styles.face} style={{ "--skin": PALETTE.skin[look.skin] } as CSSProperties}>
    {rects.map((r, i) => {
      const [x, y, w, h, , , page] = r.cell, [W, H] = page ? FACE.atlas2_size : FACE.atlas_size;
      // The cell's box in the tile, and the atlas scaled so the cell fills it.
      const box: CSSProperties = {
        left: pct((r.u0 - (cu - span / 2)) / span), top: pct((r.w0 - (cw - span / 2)) / span), width: pct((r.u1 - r.u0) / span), height: pct((r.w1 - r.w0) / span),
        transform: r.flip ? "scaleX(-1)" : undefined,
      };
      const art = `url(${page ? FACE_ATLAS2_URLS.world : FACE_ATLAS_URLS.world})`, size = `${(W / w) * 100}% ${(H / h) * 100}%`, at = `${(x / (W - w)) * 100}% ${(y / (H - h)) * 100}%`;
      return <i key={i} style={{ ...box, ...(tint
        ? { backgroundColor: tint, maskImage: art, WebkitMaskImage: art, maskSize: size, WebkitMaskSize: size, maskPosition: at, WebkitMaskPosition: at, maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" }
        : { backgroundImage: art, backgroundSize: size, backgroundPosition: at }) }} />;
    })}
  </span>;
}
