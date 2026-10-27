"use client";

/**
 * The creator's controls, shared by the studio creator (CharacterCreator: the first look on the applicant island, the
 * closet and the fitting room) and the arrival's reflection creator (components/game/arrival): the category rail, and a
 * category's options (its face sliders, its tiles, its colour swatches and the hair's colour wheel, the lock note), all
 * from the catalogue (lib/game/character/creatorCategories.ts). Tiles are pictures, never live 3D: face parts are their
 * atlas cells, clothes their item icons, hair its static thumbnail (baked at build time, head-v10: a colour change never
 * redraws them). The name field's availability check too.
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Lock } from "lucide-react";
import { Button, Slider } from "@/components/gui";
import { useGuiVariant } from "@/components/gui/variant";
import { IconRail, NUDGE_GRID, useNudge } from "@/components/gui/flat";
import { iconUrl } from "@/lib/icons/keys";
import { customHairUnlocked, dyeRef, FACE, FACE_ATLAS_URLS, FACE_ATLAS2_URLS, FREE_HAIR, HAIR_THUMB_URL, hairAccentHex, hairHex, NATURAL_HAIR, naturalHex, PALETTE, PART_BY_ID, PLACE_PARTS, PLACE_STEPS, partColor, unlockRef,
  type CatalogPart, type CharacterLook, type FaceCell, type Placement } from "@/lib/game/character/look";
import { choose, colourTarget, isOn, optionName, shownOptions, type Category, type Section } from "@/lib/game/character/creatorCategories";
import { PLACE_RANGE } from "@/lib/game/character/face";
import ColourWheel from "./ColourWheel";
import CreatorIcon from "./CreatorIcon";
import { prioritiseThumbs, thumbJob, useThumb } from "./CreatorStage";
import styles from "./CharacterCreator.module.css";

const SLIDERS: { i: 0 | 1 | 2 | 3; label: string; say: (v: number) => string }[] = [
  { i: 0, label: "Down – Up", say: v => (v ? `${Math.abs(v)} ${v > 0 ? "up" : "down"}` : "centred") },
  { i: 1, label: "Left – Right", say: v => (v ? `${Math.abs(v)} ${v > 0 ? "apart" : "closer"}` : "centred") },
  { i: 2, label: "Rotate", say: v => (v ? `${v > 0 ? "+" : "−"}${Math.round((Math.abs(v) / PLACE_STEPS) * PLACE_RANGE.rotate)}°` : "level") },
  { i: 3, label: "Smaller – Bigger", say: v => (v ? `${Math.round(PLACE_RANGE.size ** (v / PLACE_STEPS) * 100)}%` : "100%") },
];

/**
 * The rail of category tiles: arrows move along it (and open the category), Home and End jump to its ends.
 * `orientation` is what assistive tech is told; the layout is the stylesheet's. In the flat creator (the flat GUI
 * variant) it is the kit's `IconRail`: icons only, the chosen one's dot sliding to the next, a press that dips.
 */
export function CategoryRail({ cats, cat, onOpen, className, orientation = "vertical" }: {
  cats: readonly Category[]; cat: Category; onOpen: (c: Category, focus?: boolean) => void; className?: string; orientation?: "vertical" | "horizontal";
}) {
  const flat = useGuiVariant() === "flat";
  const step = (by: number) => onOpen(cats[(cats.indexOf(cat) + by + cats.length) % cats.length], true);
  const railKey = (e: React.KeyboardEvent) => {
    const by = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (by) { e.preventDefault(); step(by); }
    else if (e.key === "Home" || e.key === "End") { e.preventDefault(); onOpen(e.key === "Home" ? cats[0] : cats[cats.length - 1], true); }
  };
  if (flat) return <IconRail tabs label="Categories" value={cat.id} onChange={id => onOpen(cats.find(c => c.id === id)!)} onKeyDown={railKey}
    className={className ?? styles.rail} orientation={orientation}
    items={cats.map(c => ({ id: c.id, label: c.label, icon: c.itemIcon
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={iconUrl(c.itemIcon)} alt="" width={30} height={30} draggable={false} />
      : <CreatorIcon icon={c.icon} size={26} /> }))}
    itemAttrs={c => ({ "data-cat": c.id, id: `creator-tab-${c.id}`, "aria-controls": "creator-panel" })} />;
  return <nav className={className ?? styles.rail} role="tablist" aria-label="Categories" aria-orientation={orientation} onKeyDown={railKey}>
    {cats.map(c => <button key={c.id} type="button" role="tab" data-cat={c.id} id={`creator-tab-${c.id}`} aria-selected={c.id === cat.id} aria-controls="creator-panel"
      tabIndex={c.id === cat.id ? 0 : -1} aria-label={c.label} title={c.label} onClick={() => onOpen(c)} className={styles.railTab}>
      {c.itemIcon
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={iconUrl(c.itemIcon)} alt="" width={40} height={40} draggable={false} />
        : <CreatorIcon icon={c.icon} size={34} />}
    </button>)}
  </nav>;
}

/** What a change was, for the reflection creator's ripple: a tile, a colour or a slider. */
export type CreatorChange = "tile" | "colour" | "place";

/**
 * One category's options. `mode="create"` offers only what is owned (the identity parts are always free); the
 * wardrobe shows the rest locked with a note (and `onShop`). `onChange` hears every change made here. `wheel={false}`
 * leaves out the hair colour wheel (the arrival's reflection creator keeps to the swatches, David 2026-10-26).
 */
export function CreatorOptions({ cat, look, setLook, mode, owned, onShop, onChange, wheel: showWheel = true }: {
  cat: Category; look: CharacterLook; setLook: (update: (l: CharacterLook) => CharacterLook) => void; mode: "create" | "wardrobe";
  owned: ReadonlySet<string>; onShop?: () => void; onChange?: (kind: CreatorChange) => void; wheel?: boolean;
}) {
  const [lastAccessory, setLastAccessory] = useState<string | null>(null);
  // The flat creator's tiles move as the kit's cards do (a hover grows one, the worn ones stay out).
  const flat = useGuiVariant() === "flat";
  const nudge = useNudge('[aria-pressed="true"]');
  const [lockNote, setLockNote] = useState<{ cat: string; text: string } | null>(null);
  const note = lockNote?.cat === cat.id ? lockNote.text : null;
  const say = (text: string | null) => setLockNote(text ? { cat: cat.id, text } : null);
  // Identity (face, hair styles, the free colours) is free; clothes and dyes are owned (ruling on audit item 22), and so
  // are wardrobe batch 2's priced hairstyles, accessories and whole faces (a face's parts: unlockRef).
  const has = (id: string | null) => { const ref = id && unlockRef(id); return !ref || owned.has(ref); };
  const hasHair = (i: number) => FREE_HAIR.includes(i) || owned.has(dyeRef(i));
  const crafted = (id: string | null) => !!id && !!PART_BY_ID.get(id)?.item; // unlocked by a crafted item, never sold
  const target = colourTarget(cat, look, lastAccessory);

  const pick = (section: Section, id: string | null) => {
    say(has(id) ? null : `${optionName(section, id)} is ${crafted(id) ? "made at the workbench" : "sold in the shop"}.`);
    if (!has(id)) return;
    setLook(l => choose(l, section, id));
    if ("slot" in section.source && section.source.slot === "accessory" && id) setLastAccessory(id);
    onChange?.("tile");
  };
  const paint = (i: number) => {
    const locked = cat.swatch === "hair" && !hasHair(i);
    say(locked ? "That colour is a hair dye from the shop." : null);
    if (locked) return;
    setLook(l => {
      if (cat.swatch === "skin") return { ...l, skin: i };
      if (cat.swatch === "hair") { const next = { ...l, hair: i }; delete next.hairColor; return next; }   // a preset replaces the wheel's colour
      return target ? { ...l, colors: { ...l.colors, [target]: i } } : l;
    });
    onChange?.("colour");
  };
  // head-v10: the colour wheel (any colour; unlocked by buying the colour wheel in the shop); a drag counts as a change at most every WHEEL_MS
  const wheelAt = useRef(0);
  const wheel = (hex: string) => {
    setLook(l => ({ ...l, hairColor: hex }));
    say(null);
    const now = performance.now();
    if (now - wheelAt.current > WHEEL_MS) { wheelAt.current = now; onChange?.("colour"); }
  };
  // [palette index, colour]: the creator offers the free hair colours only (FREE_HAIR), the wardrobe every one
  const swatches = !cat.swatch ? [] : (cat.swatch === "hair" && mode === "create" ? FREE_HAIR : PALETTE[cat.swatch].map((_, i) => i)).map(i => [i, PALETTE[cat.swatch!][i]] as const);
  // head fit: a two-tone hairstyle's second colour (the accent mask of its shading map), picked from the same hair colours
  const backPart = look.back ? PART_BY_ID.get(look.back) : undefined;
  const accentPart = cat.id === "hair" && backPart?.full && (backPart.accent || backPart.map?.natural.b) ? backPart : null;
  const accentHex = accentPart ? hairAccentHex(look, accentPart) : null;
  const paintAccent = (i: number) => {
    const locked = !hasHair(i);
    say(locked ? "That colour is a hair dye from the shop." : null);
    if (locked) return;
    setLook(l => ({ ...l, hairAccent: i }));
    onChange?.("colour");
  };
  // round 2 (David, 2026-10-17): a hairstyle's own colours, as Roblox draws it (the default), and the same for its second
  const ownHair = () => {
    setLook(l => { const next = { ...l, hair: NATURAL_HAIR }; delete next.hairColor; return next; });
    say(null);
    onChange?.("colour");
  };
  const ownAccent = () => {
    setLook(l => { const next = { ...l }; delete next.hairAccent; return next; });
    say(null);
    onChange?.("colour");
  };
  const ownSwatch = (part: CatalogPart | undefined, channel: "a" | "b") => part?.map?.natural.b && channel === "a"
    ? `linear-gradient(135deg, ${naturalHex(part)} 0 55%, ${naturalHex(part, "b")} 55%)` : naturalHex(part, channel);
  const swatchOn = (i: number) => cat.swatch === "skin" ? look.skin === i : cat.swatch === "hair" ? look.hair === i && !look.hairColor : target !== null && partColor(look, target) === i;
  const place = cat.place ? look.place?.[cat.place] ?? [0, 0, 0, 0] as Placement : null;
  const setPlace = (i: number, v: number) => {
    setLook(l => {
      if (!cat.place) return l;
      const p = [...(l.place?.[cat.place] ?? [0, 0, 0, 0])] as Placement;
      p[i] = v;
      const next: NonNullable<CharacterLook["place"]> = { ...l.place, [cat.place]: p };
      if (p.every(x => x === 0)) delete next[cat.place];
      const out: CharacterLook = { ...l, place: next };
      if (!Object.keys(next).length) delete out.place;
      return out;
    });
    onChange?.("place");
  };
  // The starting creator: owned and never crafted; an event costume only while its tradition runs (shownOptions).
  const shownTiles = cat.sections.flatMap(s => shownOptions(s, mode, has));
  const thumbKeys = new Set(shownTiles.flatMap(id => (id && needsBake(id) ? [thumbJob(id, look).key] : [])));
  useEffect(() => { prioritiseThumbs(thumbKeys); });

  return <>
    {place && cat.place && <div className={styles.sliders} role="group" aria-label={`${cat.label} placement`}>
      {SLIDERS.filter(s => s.i !== 1 || PLACE_PARTS[cat.place!].apart).map(s => <Slider key={s.i} className={styles.slider} label={s.label} min={-PLACE_STEPS} max={PLACE_STEPS} value={place[s.i]}
        onChange={v => setPlace(s.i, v)} format={s.say} />)}
      <Button variant="quiet" className={styles.reset} disabled={place.every(v => v === 0)} onClick={() => {
        setLook(l => {
          const next: NonNullable<CharacterLook["place"]> = { ...l.place }; delete next[cat.place!];
          const out: CharacterLook = { ...l, place: next }; if (!Object.keys(next).length) delete out.place; return out;
        });
        onChange?.("place");
      }}>Reset</Button>
    </div>}
    {cat.sections.map(section => {
      const options = shownOptions(section, mode, has);
      if (!options.length) return null;
      return <section key={section.id} className={styles.section} aria-label={section.label}>
        {cat.sections.length > 1 && <h3>{section.label}</h3>}
        <ul ref={flat ? nudge : undefined} className={flat ? `${styles.tiles} ${NUDGE_GRID}` : styles.tiles} data-face={"face" in section.source || undefined}>
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
      <h3>{cat.swatch === "skin" ? "Skin" : cat.swatch === "hair" ? "Hair colour" : target ? `${PART_BY_ID.get(target)?.name ?? "Its"} colour` : "Colour"}</h3>
      <div className={styles.swatches} role="group" aria-label={`${cat.swatch} colours`} data-kind={cat.swatch}>
        {cat.swatch === "hair" && <button type="button" data-own style={{ "--swatch": ownSwatch(backPart, "a") } as CSSProperties}
          aria-pressed={look.hair === NATURAL_HAIR && !look.hairColor} aria-label="The hairstyle's own colours" title="Own colours" onClick={ownHair}>Own</button>}
        {swatches.map(([i, hex]) => {
          const locked = cat.swatch === "hair" && !hasHair(i);
          return <button key={hex} type="button" style={{ "--swatch": hex } as CSSProperties} aria-pressed={swatchOn(i)}
            aria-label={`${cat.swatch} colour ${i + 1}${locked ? " (hair dye in the shop)" : ""}`} data-locked={locked || undefined}
            disabled={cat.swatch === "outfit" && !target} onClick={() => paint(i)} />;
        })}
      </div>
      {cat.swatch === "hair" && showWheel && <ColourWheel value={hairHex(look) ?? naturalHex(PART_BY_ID.get(look.back))} active={!!look.hairColor} locked={!customHairUnlocked(owned)} onShop={onShop} onChange={wheel} />}
      {cat.swatch === "outfit" && !target && <p className={styles.hint}>Wear something here to colour it.</p>}
    </div>}
    {accentPart && <div className={styles.swatchBlock}>
      <h3>Second colour</h3>
      <div className={styles.swatches} role="group" aria-label="accent colours" data-kind="hair">
        <button type="button" data-own style={{ "--swatch": ownSwatch(accentPart, "b") } as CSSProperties} aria-pressed={look.hairAccent === undefined}
          aria-label="The hairstyle's own second colour" title="Own colour" onClick={ownAccent}>Own</button>
        {swatches.map(([i, hex]) => {
          const locked = !hasHair(i);
          return <button key={hex} type="button" style={{ "--swatch": hex } as CSSProperties} aria-pressed={look.hairAccent !== undefined && accentHex === hex}
            aria-label={`accent colour ${i + 1}${locked ? " (hair dye in the shop)" : ""}`} data-locked={locked || undefined} onClick={() => paintAccent(i)} />;
        })}
      </div>
    </div>}
    {note && <p className={styles.lockNote} role="status">{note}{onShop && <button type="button" onClick={onShop}>Visit the shop</button>}</p>}
  </>;
}

/** What the first creator says when it's confirmed without a name. */
export const NAME_NEEDED = "The island needs a name for you.";

/**
 * The world name's availability (row 222), checked through /api/identity/name 400 ms after typing stops. Signed out
 * the route says "Unauthorized": said as a sign-in instead, whose words link back here (reachability §3).
 */
export function useNameCheck(askName: { current: string } | undefined, required = false) {
  const id = useId();
  const [name, setName] = useState(askName?.current === "You" ? "" : askName?.current ?? "");
  const [nameNote, setNameNote] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!askName || !name.trim() || name.trim() === askName.current) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/identity/name?check=${encodeURIComponent(name.trim())}`).then(r => (r.status === 401 ? { ok: false, error: "Sign in to pick a name." } : r.json())).then(b => {
        // the route's answer is { ok, name: { name, available } } (jsonResult's key); reading it as `data` threw, so every name
        // read as refused and was dropped from the save (net-identity, 2026-10-27)
        setNameNote(b?.ok ? { ok: b.name.available, text: b.name.available ? "That name is free." : "Someone already has that name." } : { ok: false, text: b?.error ?? "Sign in to pick a name." });
      }).catch(() => setNameNote({ ok: false, text: "Couldn't check the name right now." }));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [name, askName]);
  // The typed name goes with the look unless the check already said it's taken: confirming inside the check's 400 ms,
  // or pressing Skip, used to drop it. The server checks again; a failure is surfaced (PlayerCharacterUI).
  const wanted = askName && name.trim() && name.trim() !== askName.current && nameNote?.ok !== false ? name.trim() : null;
  // `required` (the first creator): confirming with no name, or one the check refused, shows the field instead of saving
  // the look nameless. The caller stops when `missing()` is true.
  return useMemo(() => ({
    id, name, nameNote, wanted, type: (v: string) => { setName(v); setNameNote(null); },
    missing: () => {
      if (!required || !askName || (name.trim() && nameNote?.ok !== false)) return false;
      if (!name.trim()) setNameNote({ ok: false, text: NAME_NEEDED });
      const field = document.getElementById(id);
      field?.scrollIntoView({ block: "nearest" });
      field?.focus();
      return true;
    },
  }), [id, name, nameNote, wanted, required, askName]);
}

/** A whole hairstyle's tile is its static thumbnail (head-v10: baked at build time, in a neutral colour). */
const staticHair = (id: string) => { const p = PART_BY_ID.get(id); return p?.slot === "back" && !!p.full; };
/** A piece of the old lock hair has no item icon: its tile is baked in the creator. So is any part whose item icon is missing. */
const needsBake = (id: string) => { const slot = PART_BY_ID.get(id)?.slot; return !staticHair(id) && (slot === "bangs" || slot === "back"); };
/** A colour drag counts as a change (the reflection creator's ripple) at most this often. */
const WHEEL_MS = 160;

function PartArt({ id, look }: { id: string; look: CharacterLook }) {
  const [iconFailed, setIconFailed] = useState(false);
  // eslint-disable-next-line @next/next/no-img-element
  if (staticHair(id)) return <img src={HAIR_THUMB_URL(id)} alt="" width={80} height={80} draggable={false} decoding="async" />;
  return <BakedArt id={id} look={look} iconFailed={iconFailed} onIconFail={() => setIconFailed(true)} />;
}

function BakedArt({ id, look, iconFailed, onIconFail }: { id: string; look: CharacterLook; iconFailed: boolean; onIconFail: () => void }) {
  const bake = needsBake(id) || iconFailed;
  const job = useMemo(() => (bake ? thumbJob(id, look) : null), [bake, id, look]);
  const src = useThumb(job);
  // eslint-disable-next-line @next/next/no-img-element
  if (!bake) return <img src={iconUrl(id)} alt="" width={64} height={64} draggable={false} onError={onIconFail} />;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" width={80} height={80} draggable={false} /> : <span className={styles.baking} aria-hidden="true" />;
}

/** The least of the face a tile shows (canvas units), so a mole or a freckle keeps its size against the face. */
const MIN_SPAN = { eyes: 0.5, mouth: 0.3, extras: 0.62 } as const;
/** A face part as it sits on the face: its atlas cells at their anchors (both sides for paired parts), on the skin. */
function FaceArt({ layer, id, look }: { layer: "eyes" | "mouth" | "extras"; id: string; look: CharacterLook }) {
  const L = FACE.layers, A = FACE.anchors;
  const pieces: { cell: FaceCell; anchor: [number, number]; mirror: boolean }[] = [];
  if (layer === "eyes") {
    // David's pairs (face set 305): two cells (the canvas-right eye its own `left` cell) or one cell on the centre line
    const it = L.eyes.items[id];
    if (it?.left === null) pieces.push({ cell: it.open, anchor: A.eye_pair, mirror: false });
    else if (it?.left) pieces.push({ cell: it.open, anchor: A.eye, mirror: false }, { cell: it.left, anchor: A.eye_left, mirror: false });
    else if (it) pieces.push({ cell: it.open, anchor: A.eye, mirror: true });
  }
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
  return <span className={styles.face} style={{ "--skin": PALETTE.skin[look.skin] } as CSSProperties}>
    {rects.map((r, i) => {
      const [x, y, w, h, , , page] = r.cell, [W, H] = page ? FACE.atlas2_size : FACE.atlas_size;
      // The cell's box in the tile, and the atlas scaled so the cell fills it.
      const box: CSSProperties = {
        left: pct((r.u0 - (cu - span / 2)) / span), top: pct((r.w0 - (cw - span / 2)) / span), width: pct((r.u1 - r.u0) / span), height: pct((r.w1 - r.w0) / span),
        transform: r.flip ? "scaleX(-1)" : undefined,
      };
      const art = `url(${page ? FACE_ATLAS2_URLS.world : FACE_ATLAS_URLS.world})`, size = `${(W / w) * 100}% ${(H / h) * 100}%`, at = `${(x / (W - w)) * 100}% ${(y / (H - h)) * 100}%`;
      return <i key={i} style={{ ...box, backgroundImage: art, backgroundSize: size, backgroundPosition: at }} />;
    })}
  </span>;
}
