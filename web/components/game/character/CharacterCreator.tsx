"use client";

/**
 * Character creator (rows 141, 142, 191, 210): ACNH layout in the Tethos
 * palette. Character in three-quarter view on the left, category tabs top
 * right, a 2x4 grid of rendered previews (each cell is the character wearing
 * that option, drawn live through one shared canvas with drei <View>), a
 * swatch row from the shared palette, confirm bottom right. `mode="wardrobe"`
 * is the same sheet limited to hair and clothes (closet and fitting room).
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, View } from "@react-three/drei";
import Character, { type CharacterMotion } from "./Character";
import { Lock } from "lucide-react";
import { VillageButton, VillageField } from "@/components/recruit/ui";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import { mentionsSignIn } from "@/lib/game/signIn";
import { SignInText } from "@/components/gui/SignIn";
import { dyeRef, FACE, FREE_HAIR_COLOURS, PALETTE, PART_BY_ID, partColor, partRef, partsIn, randomLook, STARTER_PARTS, wear, type CharacterLook, type PartSlot } from "@/lib/game/character/look";
import styles from "./CharacterCreator.module.css";

type Swatch = "skin" | "hair" | "outfit" | null;
interface Tab { id: string; label: string; items: (string | null)[]; framing: "head" | "body"; swatch: Swatch; apply: (look: CharacterLook, id: string | null) => CharacterLook; on: (look: CharacterLook, id: string | null) => boolean; name: (id: string | null) => string }
const partName = (id: string | null) => (id ? PART_BY_ID.get(id)?.name ?? id : "None");
const slotTab = (id: string, label: string, slots: PartSlot[], framing: Tab["framing"], swatch: Swatch, extra: (string | null)[] = []): Tab => ({
  id, label, framing, swatch, name: partName,
  items: [...extra, ...slots.flatMap(s => partsIn(s).map(p => p.id))],
  apply: (look, part) => (part ? wear(look, PART_BY_ID.get(part)!.slot, part) : wear(look, slots[0], null)),
  on: (look, part) => (part ? [look.bangs, look.back, look.top, look.bottom, look.onepiece, look.shoes, ...Object.values(look.acc)].includes(part) : !look[slots[0] as "shoes"]),
});
const TABS: Tab[] = [
  { id: "skin", label: "Skin", items: [], framing: "head", swatch: "skin", apply: l => l, on: () => false, name: () => "" },
  { id: "eyes", label: "Eyes", items: Object.keys(FACE.layers.eyes.items), framing: "head", swatch: null, apply: (l, id) => ({ ...l, eyes: id! }), on: (l, id) => l.eyes === id, name: id => `Eyes ${id}` },
  { id: "mouth", label: "Mouth", items: Object.keys(FACE.layers.mouth.items), framing: "head", swatch: null, apply: (l, id) => ({ ...l, mouth: id! }), on: (l, id) => l.mouth === id, name: id => `Mouth ${id}` },
  {
    id: "features", label: "Brows & extras", items: [...Object.keys(FACE.layers.brows.items), ...Object.keys(FACE.layers.extras.items)], framing: "head", swatch: "hair",
    apply: (l, id) => id! in FACE.layers.brows.items ? { ...l, brows: id! } : { ...l, extras: l.extras.includes(id!) ? l.extras.filter(e => e !== id) : [...l.extras, id!] },
    on: (l, id) => l.brows === id || l.extras.includes(id!), name: id => ({ brow_soft: "Soft brows", brow_flat: "Flat brows", blush: "Blush", mole: "Mole", freckles: "Freckles" } as Record<string, string>)[id!] ?? id!,
  },
  slotTab("bangs", "Bangs", ["bangs"], "head", "hair"),
  slotTab("back", "Back hair", ["back"], "head", "hair"),
  slotTab("top", "Tops", ["top"], "body", "outfit"),
  slotTab("bottom", "Bottoms & one-pieces", ["bottom", "onepiece"], "body", "outfit"),
  slotTab("shoes", "Shoes", ["shoes"], "body", "outfit", [null]),
  slotTab("accessory", "Accessories", ["accessory"], "head", "outfit"),
];
const WARDROBE_TABS = ["bangs", "back", "top", "bottom", "shoes", "accessory"];
/** Face cells have sheet codes for names ("Eyes F1.1"): said as their place in the row instead. */
const spoken = (tab: Tab, id: string | null, items: (string | null)[]) => (tab.id === "eyes" || tab.id === "mouth" ? `${tab.label}, style ${items.indexOf(id) + 1} of ${items.length}` : tab.name(id));
const PAGE = 8;
const STARTERS: ReadonlySet<string> = new Set(STARTER_PARTS);

/** The part a colour swatch recolours on the current tab. */
function colourTarget(tab: string, look: CharacterLook, lastAccessory: string | null): string | null {
  if (tab === "top") return look.onepiece ?? look.top;
  if (tab === "bottom") return look.onepiece ?? look.bottom;
  if (tab === "shoes") return look.shoes;
  if (tab === "accessory") return lastAccessory && Object.values(look.acc).includes(lastAccessory) ? lastAccessory : Object.values(look.acc)[0] ?? null;
  return null;
}

const STILL: CharacterMotion = { speed: 0, yaw: -0.4, lift: 0, pose: null, play: null };
function Stage({ look, framing, yaw = -0.4, faceSize = 512 }: { look: CharacterLook; framing: "head" | "body"; yaw?: number; faceSize?: number }) {
  const motion = useRef<CharacterMotion>({ ...STILL, yaw });
  useEffect(() => { motion.current.yaw = yaw; }, [yaw]);
  const head = framing === "head";
  return <>
    <PerspectiveCamera makeDefault fov={head ? 30 : 30} position={head ? [0.1, 0.86, 1.3] : [0.15, 0.6, 2.05]} onUpdate={c => c.lookAt(0, head ? 0.8 : 0.5, 0)} />
    <ambientLight intensity={1.1} color="#fff6e6" />
    <hemisphereLight args={["#fff8ec", "#b7c7a8", 0.9]} />
    <directionalLight position={[1.6, 2.6, 2.2]} intensity={1.7} color="#fff1d8" />
    <Suspense fallback={null}><Character look={look} motion={motion} scale={1} faceSize={faceSize} /></Suspense>
  </>;
}

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
}

const stay = () => {};
export default function CharacterCreator({ initial, mode = "create", title, askName, owned = STARTERS, onShop, onDone, onClose }: CreatorProps) {
  // A dialog (lib/game/useWorldDialog): the world's keys hold still under it (G no longer opens the emotes over it); Escape
  // closes the wardrobe, never the first-login creator.
  const root = useWorldDialog<HTMLElement>(true, onClose ?? stay, undefined, true);
  const [look, setLook] = useState(initial);
  const tabs = useMemo(() => (mode === "wardrobe" ? TABS.filter(t => WARDROBE_TABS.includes(t.id)) : TABS), [mode]);
  const [tabId, setTabId] = useState(tabs[0].id);
  const [page, setPage] = useState(0);
  const [yaw, setYaw] = useState(-0.4);
  const [lastAccessory, setLastAccessory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const tab = tabs.find(t => t.id === tabId)!;
  // Identity (face, hair styles, the free colours) is always free; clothes and dyes are owned (ruling on audit item 22).
  const has = (id: string | null) => { const ref = id && partRef(id); return !ref || owned.has(ref); };
  const hasHair = (i: number) => i < FREE_HAIR_COLOURS || owned.has(dyeRef(i));
  const crafted = (id: string | null) => !!id && !!PART_BY_ID.get(id)?.item; // unlocked by a crafted item, never sold
  const [lockNote, setLockNote] = useState<string | null>(null);
  const items = mode === "create" ? tab.items.filter(has) : tab.items;
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const cells = items.slice(page * PAGE, page * PAGE + PAGE);
  const target = colourTarget(tab.id, look, lastAccessory);
  const [name, setName] = useState(askName?.current === "You" ? "" : askName?.current ?? "");
  const [nameNote, setNameNote] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { root.current?.querySelector<HTMLButtonElement>("[role=tab]")?.focus(); }, [root]);
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

  const choose = (id: string | null) => {
    setLockNote(has(id) ? null : `${tab.name(id)} is ${crafted(id) ? "made at the workbench" : "sold in the shop"}.`);
    if (!has(id)) return;
    setLook(l => tab.apply(l, id));
    if (tab.id === "accessory" && id) setLastAccessory(id);
  };
  const paint = (i: number) => {
    const locked = tab.swatch === "hair" && !hasHair(i);
    setLockNote(locked ? "That colour is a hair dye from the shop." : null);
    if (!locked) setLook(l => {
      if (tab.swatch === "skin") return { ...l, skin: i };
      if (tab.swatch === "hair") return { ...l, hair: i };
      return target ? { ...l, colors: { ...l.colors, [target]: i } } : l;
    });
  };
  const swatches = !tab.swatch ? [] : tab.swatch === "hair" && mode === "create" ? PALETTE.hair.slice(0, FREE_HAIR_COLOURS) : PALETTE[tab.swatch];
  const swatchOn = (i: number) => tab.swatch === "skin" ? look.skin === i : tab.swatch === "hair" ? look.hair === i : target !== null && partColor(look, target) === i;
  const confirm = async (final: CharacterLook) => {
    setSaving(true);
    // The typed name goes with the look unless the check already said it's taken: confirming inside the check's 400 ms,
    // or pressing Skip, used to drop it. The server checks again; a failure is surfaced (PlayerCharacterUI).
    const wanted = askName && name.trim() && name.trim() !== askName.current && nameNote?.ok !== false ? name.trim() : null;
    await onDone(final, wanted);
    setSaving(false);
  };

  return <section ref={root} className={styles.creator} role="dialog" aria-modal="true" aria-labelledby="creator-title" data-mode={mode}>
    <div className={styles.preview}>
      <h1 id="creator-title">{title ?? (mode === "wardrobe" ? "Your closet" : "Make your character")}</h1>
      <View className={styles.stage}><Stage look={look} framing="body" yaw={yaw} faceSize={1024} /></View>
      <div className={styles.turn} aria-label="Turn the character">
        <button onClick={() => setYaw(y => y - Math.PI / 4)} aria-label="Turn left">⟲</button>
        <button onClick={() => setYaw(y => y + Math.PI / 4)} aria-label="Turn right">⟳</button>
      </div>
      {askName && <VillageField label="Your name on the island" hint="Letters and numbers; everyone in the world sees it." value={name} maxLength={24}
        onChange={e => { setName(e.target.value); setNameNote(null); }} error={nameNote && !nameNote.ok && !mentionsSignIn(nameNote.text) ? nameNote.text : undefined} className={styles.name} />}
      {askName && nameNote?.ok && <p className={styles.nameOk} role="status">{nameNote.text}</p>}
      {askName && nameNote && !nameNote.ok && mentionsSignIn(nameNote.text) && <p className={styles.nameOk} role="status"><SignInText text={nameNote.text} /></p>}
    </div>
    <div className={styles.picker}>
      <div role="tablist" aria-label="Categories" className={styles.tabs}>
        {tabs.map(t => <button key={t.id} role="tab" aria-selected={t.id === tabId} onClick={() => { setTabId(t.id); setPage(0); setLockNote(null); }}>{t.label}</button>)}
      </div>
      {items.length > 0 && <ul className={styles.grid} aria-label={tab.label} data-tab={tab.id}>
        {cells.map(id => <li key={id ?? "none"}>
          <button aria-pressed={tab.on(look, id)} onClick={() => choose(id)} data-locked={!has(id) || undefined}
            aria-label={has(id) ? spoken(tab, id, items) : `${spoken(tab, id, items)} (${crafted(id) ? "crafted" : "in the shop"})`} title={tab.name(id)}>
            <View as="span" className={styles.thumb}><Stage look={tab.apply(look, id)} framing={tab.framing} /></View>
            <span className={styles.label}>{has(id) ? null : <Lock size={11} strokeWidth={2.6} aria-hidden className={styles.lock} />}{tab.name(id)}</span>
          </button>
        </li>)}
      </ul>}
      {lockNote && <p className={styles.lockNote} role="status">{lockNote}{onShop && <button onClick={onShop}>Visit the shop</button>}</p>}
      {pages > 1 && <div className={styles.pager}>
        <button onClick={() => setPage(p => (p + pages - 1) % pages)} aria-label="Previous page">‹</button>
        <span>{page + 1} / {pages}</span>
        <button onClick={() => setPage(p => (p + 1) % pages)} aria-label="Next page">›</button>
      </div>}
      {swatches.length > 0 && <div className={styles.swatches} role="group" aria-label={`${tab.swatch} colours`}>
        {swatches.map((hex, i) => {
          const locked = tab.swatch === "hair" && !hasHair(i);
          return <button key={hex} style={{ background: hex }} aria-pressed={swatchOn(i)} aria-label={`${tab.swatch} colour ${i + 1}${locked ? " (hair dye in the shop)" : ""}`}
            data-locked={locked || undefined} disabled={tab.swatch === "outfit" && !target} onClick={() => paint(i)} />;
        })}
      </div>}
      <div className={styles.actions}>
        {mode === "create" && <VillageButton variant="quiet" onClick={() => setLook(randomLook(Math.random, owned))}>Surprise me</VillageButton>}
        {mode === "create" && <VillageButton variant="quiet" disabled={saving} onClick={() => void confirm(randomLook(Math.random, owned))}>Skip</VillageButton>}
        {onClose && <VillageButton variant="quiet" onClick={onClose}>Close</VillageButton>}
        <VillageButton disabled={saving} onClick={() => void confirm(look)}>{mode === "wardrobe" ? "Wear this" : "That's me"}</VillageButton>
      </div>
    </div>
    <Canvas className={styles.canvas} eventSource={root as React.RefObject<HTMLElement>} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
      <View.Port />
    </Canvas>
  </section>;
}
