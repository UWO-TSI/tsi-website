"use client";

/**
 * The backpack (specs/game-ui.md milestone 2), in the flat UI (specs/polish/flat-ui.md step 3, round 2): the Bag on I,
 * the shop overlay's panel. An icon rail filters it (everything in your pockets, fish, bugs, forage and fruit,
 * materials, then what you own beyond them: tools, clothes, furniture). The pockets are white item cards (drag to
 * rearrange, or onto the tool wheel's pins; shift-click in the chest). A click opens a small panel beside the grid,
 * David's "lil tab on the side": the item's name, a small picture, what it's worth and good for, and what you can do
 * with it; the grid stays in view. The grid is shared with the storage chest (ChestSheet). The server owns the stock
 * and the sizes (lib/game/bagStore); the grid's arrangement and the New marks are this device's.
 */
import { RodRadar, RodSlots, RodStage, TackleRadar, equippedTackle, rodLine, rodOf } from "@/components/economy/RodGear";
import { tackleByKey } from "@/lib/game/rods";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Apple, ArrowDownWideNarrow, Backpack, Bug, Fish, Gem, Lock, LockOpen, Pin, PinOff, Shirt, Sofa, Wrench, X } from "lucide-react";
import { ConfirmDialog, SignInText } from "@/components/gui";
import { CardGrid, DarkButton, DetailView, FlatPanel, GhostButton, IconRail, InfoHead, ItemCard, NUDGE_GRID, Quiet, STAGE, SidePanel, StatusLine, WithSide, flatStyles as f, useNudge } from "@/components/gui/flat";
import { Amount } from "@/components/economy/Amount";
import { arrange, itemInfo, slotCounts, stackSize, type Slot } from "@/lib/collections/bag";
import type { BagView } from "@/lib/collections/service";
import { RECIPES, outputName } from "@/lib/crafting/recipes";
import { speciesSellPrice } from "@/lib/wallet/rules";
import { iconUrl, shopIcon } from "@/lib/icons/keys";
import { pinnable } from "@/lib/game/itemModels";
import { MAX_PINS } from "@/lib/game/toolWheel";
import { togglePin, useHeld } from "@/lib/game/heldStore";
import { AudioManager } from "@/lib/game/audio";
import { ApiError } from "@/lib/apiClient";
import { useLoad } from "@/components/economy/EconomySheets";
import { cap } from "@/components/economy/ShopOverlay";
import { bagWrite, loadBag, saveOrder, seeBag, sortBag, stockOf, swapSlots, useBag } from "@/lib/game/bagStore";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";
import type { InventoryRow } from "@/lib/wallet/store";
import type { InventoryView } from "@/lib/wallet/service";
import { DROPS } from "@/lib/game/drops";
import s from "./Bag.module.css";

const KIND: Record<string, string> = { fish: "Fish", sea: "Sea creature", bug: "Bug", fruit: "Fruit", mineral: "Material", flower: "Flower", shell: "Shell", mushroom: "Mushroom", wood: "Material" };
export const nameOf = (key: string) => itemInfo(key)?.name ?? key.replace(/_/g, " ");
const rarityOf = (key: string) => itemInfo(key)?.rarity ?? "common";
const kindOf = (key: string) => { const sp = itemInfo(key); return (sp?.sub && KIND[sp.sub]) || (sp && KIND[sp.category]) || "Item"; };
const usedIn = (key: string) => RECIPES.filter(r => key in r.ingredients).map(outputName);
export const errText = (e: unknown) => (e instanceof ApiError ? e.message : "Couldn't reach the island. Try again.");
const DRAG = "application/x-tsi-slot";
export type Dragged = { pane: "bag" | "chest"; i: number; key: string; qty: number };

// ── The grid ─────────────────────────────────────────────────────────

/** The item's kind under its name, after a dot in its rarity's colour (the one rarity palette). */
function KindLine({ itemKey }: { itemKey: string }) {
  return <><i className={f.rarity} style={{ background: `var(--gui-rarity-${rarityOf(itemKey)})` }} aria-hidden />{kindOf(itemKey)}</>;
}

/**
 * Slots as white item cards: the real icon, the name, its kind, the stack in the pill, New and locked marks. Click picks
 * one (shift-click: `onShift`); drag moves it to another slot of this pane (`onSwap`), to the other pane (`onMoveIn`
 * there) or to a wheel pin. An empty slot is a dashed space; a slot past the size (a member over it) is ringed. The
 * slots move as the kit's cards do (a hover grows one and its neighbours step aside; the picked one stays out).
 */
export function Grid({ pane, slots, counts, capacity, selected, locked, fresh, label, only, onPick, onShift, onSwap, onMoveIn }: {
  pane: "bag" | "chest"; slots: readonly Slot[]; counts: readonly (number | null)[]; capacity: number; selected: number | null;
  locked?: ReadonlySet<string>; fresh?: ReadonlySet<string>; label: string;
  /** A filter (the rail's fish, bugs...): only its stacks, no empty slots, and no rearranging (the slots aren't all shown). */
  only?: ((key: string) => boolean) | null;
  onPick: (i: number) => void; onShift?: (i: number) => void; onSwap?: (from: number, to: number) => void; onMoveIn?: (d: Dragged) => void;
}) {
  const shift = useRef(false);
  const nudge = useNudge();
  const drop = (e: DragEvent, to: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData(DRAG);
    if (!raw) return;
    const from = JSON.parse(raw) as Dragged;
    if (from.pane !== pane) onMoveIn?.(from);
    else if (to !== null && to !== from.i && !only) onSwap?.(from.i, to);
  };
  return <ul ref={nudge} className={`${s.grid} ${NUDGE_GRID}`} aria-label={label} data-pane={pane} onDragOver={e => e.preventDefault()} onDrop={e => drop(e, null)}>
    {slots.map((key, i) => {
      if (only && (!key || !only(key))) return null;
      const lock = !!key && !!locked?.has(key), n = counts[i] ?? 0;
      return <li key={i} className={s.slot} data-over={i >= capacity || undefined} onDragOver={e => e.preventDefault()} onDrop={e => drop(e, i)}>
        {key ? <ItemCard size="sm" arrow={false} picture={iconUrl(key)} px={40} name={nameOf(key)} line={<KindLine itemKey={key} />} pill={n > 1 ? `×${n}` : null}
          tag={fresh?.has(key) ? "New" : null} selected={selected === i} className={s.card}
          label={`${nameOf(key)}${n > 1 ? `, ${n}` : ""}, ${rarityOf(key)}${lock ? ", locked" : ""}${fresh?.has(key) ? ", new" : ""}`} draggable
          onDragStart={e => { e.dataTransfer.setData(DRAG, JSON.stringify({ pane, i, key, qty: n || 1 } satisfies Dragged)); e.dataTransfer.effectAllowed = "move"; }}
          onClickCapture={e => { shift.current = e.shiftKey; }} onClick={() => (shift.current && onShift ? onShift(i) : onPick(i))} />
          : <span className={s.empty} aria-label="Empty slot" role="img" />}
        {lock && <Lock className={s.lock} size={12} strokeWidth={2.6} aria-hidden />}
      </li>;
    })}
  </ul>;
}

/** Slots used of the size, with a thin bar: full and over said plainly. */
export function Readout({ used, capacity, label }: { used: number; capacity: number; label: string }) {
  const state = used > capacity ? "over" : used >= capacity ? "full" : undefined;
  return <span className={s.readout} data-state={state} role="meter" aria-label={`${label}: ${used} of ${capacity} slots`} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={Math.min(used, capacity)}>
    <span className={s.bar} aria-hidden><i style={{ width: `${Math.min(100, (used / Math.max(capacity, 1)) * 100)}%` }} /></span>
    <span className={s.readoutText} aria-hidden><b>{used}</b>/{capacity}{state === "over" ? ` · over by ${used - capacity}` : state === "full" ? " · full" : ""}</span>
  </span>;
}

/** The bag's grid as this device keeps it, brought up to the stock (and kept, so a hole stays where you left it). */
export function useBagGrid(view: BagView | null, order: readonly Slot[]) {
  const stock = useMemo(() => stockOf(view), [view]);
  const slots = useMemo(() => (view ? arrange(stock, order, view.capacity) : []), [view, stock, order]);
  const counts = useMemo(() => slotCounts(slots, stock), [slots, stock]);
  const locked = useMemo(() => new Set(view?.items.filter(r => r.locked).map(r => r.item_key)), [view]);
  useEffect(() => { if (view) saveOrder(slots); }, [view, slots]);
  return { stock, slots, counts, locked };
}

// ── The Bag sheet ────────────────────────────────────────────────────

type Shelf = "pockets" | Exclude<BagKind, "other"> | "tools" | "outfits" | "furniture";
type BagKind = "fish" | "bugs" | "forage" | "materials" | "other";
/** Which of the rail's filters a pocket item is under. */
export function bagKind(key: string): BagKind {
  const c = itemInfo(key)?.category;
  return c === "fish" || c === "sea" ? "fish" : c === "bug" ? "bugs" : c === "fruit" || c === "nature" ? "forage" : c === "mineral" ? "materials" : "other";
}
const SHELVES: { id: Shelf; label: string; icon: ReactNode }[] = [
  { id: "pockets", label: "Everything in your pockets", icon: <Backpack size={22} /> },
  { id: "fish", label: "Fish and sea creatures", icon: <Fish size={22} /> },
  { id: "bugs", label: "Bugs", icon: <Bug size={22} /> },
  { id: "forage", label: "Forage and fruit", icon: <Apple size={22} /> },
  { id: "materials", label: "Materials", icon: <Gem size={22} /> },
  { id: "tools", label: "Tools", icon: <Wrench size={22} /> },
  { id: "outfits", label: "Clothes", icon: <Shirt size={22} /> },
  { id: "furniture", label: "Furniture and finishes", icon: <Sofa size={22} /> },
];
const POCKET_FILTERS = new Set<Shelf>(["pockets", "fish", "bugs", "forage", "materials"]);

/** The Bag (I): your pockets, filtered from the rail, and on its last shelves what you own that takes no pocket. */
export function BagSheet({ open, onClose, keys, transport, initialShelf = "pockets" }: {
  open: boolean; onClose: () => void; keys?: string;
  /** What you own comes from here (the dev harness passes its memory store). */
  transport?: EconomyTransport; initialShelf?: Shelf;
}) {
  const [shelf, setShelf] = useState<Shelf>(initialShelf);
  const bag = useBag();
  useEffect(() => { if (open) void loadBag(); }, [open]);
  // You looked: the New marks go as the bag closes.
  const close = () => { seeBag(); onClose(); };
  const view = bag.view;
  // The filters for what the pockets hold now (everything, always), then what you own.
  const kinds = useMemo(() => new Set(view?.items.map(r => bagKind(r.item_key))), [view]);
  const shelves = SHELVES.filter(x => !POCKET_FILTERS.has(x.id) || x.id === "pockets" || kinds.has(x.id as BagKind));
  const shown = shelves.some(x => x.id === shelf) ? shelf : "pockets";
  return <FlatPanel open={open} onClose={close} title="Bag" keys={keys} testId="bag-sheet" contentKey={shown}
    purse={view ? <Readout used={view.used} capacity={view.capacity} label="Pockets" /> : undefined}
    rail={<IconRail label="Bag" value={shown} onChange={setShelf} items={shelves.map(x => ({ ...x, badge: x.id === "pockets" ? bag.fresh.length : undefined }))} />}>
    {POCKET_FILTERS.has(shown) ? <Pockets filter={shown === "pockets" ? null : shown as BagKind} title={SHELVES.find(x => x.id === shown)!.label} />
      : <Owned group={shown as "tools" | "outfits" | "furniture"} transport={transport} />}
  </FlatPanel>;
}

function Pockets({ filter, title }: { filter: BagKind | null; title: string }) {
  const bag = useBag();
  const { view } = bag;
  const { stock, slots, counts, locked } = useBagGrid(view, bag.order);
  const fresh = useMemo(() => new Set(bag.fresh), [bag.fresh]);
  const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  if (!view) return bag.error ? <StatusLine error>Your bag didn&apos;t load. <button type="button" className={f.retry} onClick={() => void loadBag()}>Try again</button></StatusLine>
    : <Quiet>Opening your bag…</Quiet>;
  const key = sel !== null ? slots[sel] ?? null : null;
  const qty = sel !== null ? counts[sel] ?? 0 : 0;
  const run = async (act: () => Promise<string | null>) => {
    setBusy(true);
    try { const text = await act(); setNote(text ? { ok: true, text } : null); }
    catch (e) { setNote({ ok: false, text: errText(e) }); }
    finally { setBusy(false); }
  };
  const over = view.used > view.capacity;
  const only = filter ? (k: string) => bagKind(k) === filter : null;
  return <div className={s.pockets}>
    <div className={s.head}>
      <h3 className={f.shelfTitle}>{title}</h3>
      {!filter && <GhostButton onClick={() => { sortBag(); setSel(null); setNote(null); AudioManager.playSFX("click", { rate: 1.2, gain: 0.35 }); }} disabled={!view.items.length}>
        <span className={f.withIcon}><ArrowDownWideNarrow size={15} aria-hidden /> Sort</span>
      </GhostButton>}
    </div>
    {over ? <p className={s.warn} role="status">Over by {view.used - view.capacity}: you keep everything, but you can&apos;t pick anything up until you make room.</p>
      : view.used >= view.capacity && view.items.length > 0 && <p className={s.warn} role="status">{DROPS.homeIsland ? "Full: only what tops up a stack you have still fits. Sell, drop or store something in the chest at home, or get a bigger pocket at the shop." : "Full: only what tops up a stack you have still fits. Sell or drop something, or get a bigger pocket at the shop."}</p>}
    {bag.local && <p className={s.hint}><SignInText text={DROPS.homeIsland ? "Saved on this device. Sign in to keep a backpack and a storage chest." : "Saved on this device. Sign in to keep a backpack."} /></p>}
    {!key && note && <StatusLine error={!note.ok}>{note.text}</StatusLine>}
    <Pins stock={stock} onNote={setNote} />
    <WithSide side={key && sel !== null ? <Details key={key} itemKey={key} qty={qty} total={stock[key] ?? 0} view={view} locked={locked.has(key)} busy={busy || bag.local} note={note}
      onClose={() => { setSel(null); setNote(null); }}
      onLock={() => run(async () => { await bagWrite({ action: "lock", item: key, locked: !locked.has(key) }); return null; })}
      onDrop={() => setDropping(true)} /> : null}>
      <Grid pane="bag" slots={slots} counts={counts} capacity={view.capacity} selected={sel} locked={locked} fresh={fresh} label="Your pockets" only={only}
        onPick={i => { setSel(sel === i ? null : i); setNote(null); AudioManager.playSFX("blip1", { rate: 1.2, gain: 0.25 }); }}
        onSwap={(a, b) => { swapSlots(slots, a, b); setSel(b); AudioManager.playSFX("blip1", { rate: 1.3, gain: 0.3 }); }} />
      <p className={s.hint}>{view.items.length ? (filter ? "Click something to see what you can do with it." : "Click something to see what you can do with it. Drag to rearrange, or onto the tool wheel's pins.") : "Your pockets are empty. Catch, pick or dig something up."}
        {DROPS.homeIsland && !filter ? " Out of room? The wooden chest in your house holds 200 more." : ""}</p>
    </WithSide>
    <ConfirmDialog open={dropping && !!key} title={key ? `Drop ${qty > 1 ? `${qty} × ` : ""}${nameOf(key)}?` : "Drop it?"} confirmLabel="Drop" danger busy={busy}
      onCancel={() => setDropping(false)}
      onConfirm={() => { setDropping(false); if (key) void run(async () => { await bagWrite({ action: "drop", item: key, qty }); setSel(null); return `Dropped ${nameOf(key)}.`; }); }}>
      <p>It&apos;s gone for good: nobody can pick it up again.</p>
    </ConfirmDialog>
  </div>;
}

/** The picked item, in the panel beside the grid: what it is, what it's worth and good for, and what you can do with it. */
function Details({ itemKey, qty, total, view, locked, busy, note, onClose, onLock, onDrop }: {
  itemKey: string; qty: number; total: number; view: BagView; locked: boolean; busy: boolean; note: { ok: boolean; text: string } | null;
  onClose: () => void; onLock: () => void; onDrop: () => void;
}) {
  const { pins } = useHeld();
  const sp = itemInfo(itemKey), price = speciesSellPrice(itemKey), recipes = usedIn(itemKey), museum = view.museum[itemKey];
  const best = view.items.find(r => r.item_key === itemKey)?.best_size_cm ?? null;
  const pinned = pins.includes(itemKey), stack = stackSize(itemKey);
  return <SidePanel testId="bag-item" onClose={onClose} picture={iconUrl(itemKey)} title={nameOf(itemKey)}
    kind={<><i className={f.rarity} style={{ background: `var(--gui-rarity-${rarityOf(itemKey)})` }} aria-hidden />{cap(rarityOf(itemKey))} · {kindOf(itemKey)}{locked ? " · Locked" : ""}</>}
    facts={[
      ["In your bag", `${total.toLocaleString()}${total > qty ? ` (this stack ${qty})` : ""}`],
      ["Sells for", price ? <><Amount n={price} /> each, at the shop&apos;s counter</> : "The shop doesn't buy it"],
      ["Size", best !== null ? `Your biggest: ${best} cm` : stack > 1 ? `Stacks to ${stack} in a slot` : "A slot each"],
      ...(sp?.donatable ? [["Museum", museum === "you" ? "On show: you donated it" : museum ? "Already on show" : "The museum still needs one"] as const] : []),
      ["Used in", recipes.length ? recipes.slice(0, 4).join(", ") + (recipes.length > 4 ? ` and ${recipes.length - 4} more` : "") : "No recipes"],
    ]}
    actions={<>
      {pinnable(itemKey) && <DarkButton onClick={() => { togglePin(itemKey); AudioManager.playSFX(pinned ? "exit" : "confirm", { rate: 1.2, gain: 0.35 }); }}>
        <span className={f.withIcon}>{pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />} {pinned ? "Unpin" : "Pin to the wheel"}</span></DarkButton>}
      <GhostButton disabled={busy} onClick={onLock}><span className={f.withIcon}>{locked ? <LockOpen size={14} aria-hidden /> : <Lock size={14} aria-hidden />} {locked ? "Unlock" : "Lock"}</span></GhostButton>
      <GhostButton disabled={busy || locked} onClick={onDrop}>Drop</GhostButton>
    </>}>
    {locked && <p className={s.hint}>Locked: the shop won&apos;t buy it and dropping skips it, and it stays in your bag when you store all materials.</p>}
    {note && <StatusLine error={!note.ok}>{note.text}</StatusLine>}
  </SidePanel>;
}

/** The tool wheel's two pins (lib/game/toolWheel): drop something you can hold here, or pin it from its details. */
function Pins({ stock, onNote }: { stock: Record<string, number>; onNote: (n: { ok: boolean; text: string } | null) => void }) {
  const { pins } = useHeld();
  const pin = (e: DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG);
    if (!raw) return;
    const { key } = JSON.parse(raw) as Dragged;
    if (!pinnable(key)) { onNote({ ok: false, text: "Only things you can hold go on the wheel: fruit, shells, rocks, ore, mushrooms and branches." }); return; }
    if (!pins.includes(key)) { togglePin(key); AudioManager.playSFX("confirm", { rate: 1.2, gain: 0.35 }); }
  };
  return <div className={s.pins} aria-label="Pinned to your tool wheel">
    <span className={s.pinsLabel}>On your tool wheel</span>
    {Array.from({ length: MAX_PINS }, (_, i) => pins[i] ?? null).map((k, i) => <div key={i} className={s.pin} onDragOver={e => e.preventDefault()} onDrop={pin} data-empty={!k || undefined}>
      {k ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl(k)} alt="" width={30} height={30} className={s.pinArt} />
        <span className={s.pinName}>{nameOf(k)} <span className={s.pinCount}>×{stock[k] ?? 0}</span></span>
        <button type="button" className={s.unpin} aria-label={`Unpin ${nameOf(k)}`} title={`Unpin ${nameOf(k)}`} onClick={() => togglePin(k)}><X size={14} aria-hidden /></button>
      </> : <span className={s.pinEmpty}>Drag here to pin</span>}
    </div>)}
  </div>;
}

// ── What you own beyond your pockets ─────────────────────────────────

const USE_HINT: Record<string, string> = { outfits: "Wear it from your closet", furniture: "Place it at home" };
const SHELF_EMPTY: Record<string, string> = { tools: "No tools yet. The shop is by the plaza.", outfits: "No clothes yet. The shop is by the plaza.", furniture: "No furniture yet. The shop is by the plaza." };
const SLOT_NAME: Record<string, string> = { rod: "Fishing rod", net: "Bug net", shovel: "Shovel", outfit: "Outfit", hair: "Hair dye", accessory: "Accessory", bait: "Bait", bobber: "Bobber" };
const rowPicture = (r: InventoryRow) => r.item.sprite_url ?? shopIcon(r.item);

/** One shelf of what you own (tools, clothes, furniture and finishes): cards, and the picked one in the side panel. */
function Owned({ group, transport = httpEconomyTransport }: { group: "tools" | "outfits" | "furniture"; transport?: EconomyTransport }) {
  const { data, error, reload, setError } = useLoad<InventoryView>(useCallback(() => transport.inventory(), [transport]));
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = async (id: string, on: boolean) => {
    setBusy(true);
    try { await transport.equip(id, on); await reload(); window.dispatchEvent(new CustomEvent("tsi:gear-changed")); }
    catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };
  if (!data) return error ? <StatusLine error><SignInText text={error} /></StatusLine> : <Quiet>Opening your bag…</Quiet>;
  const rows = data.groups[group] ?? [];
  const row = rows.find(r => r.item.id === picked) ?? null;
  const title = SHELVES.find(x => x.id === group)!.label;
  const kind = (r: InventoryRow) => r.item.slot ? SLOT_NAME[r.item.slot] ?? cap(r.item.slot) : cap(String(r.item.category));
  // A rod opens large: the model with its add-ons hanging from the tip, the slots in the stage's corner, the radar of
  // the build (RodGear.tsx). An add-on shows its own radar.
  const rod = rodOf(row?.item.catalogue_ref), add = tackleByKey(row?.item.catalogue_ref), on = equippedTackle(rows);
  if (row && rod) return <>
    {error && <StatusLine error><SignInText text={error} /></StatusLine>}
    <DetailView testId="bag-rod" rarity={rod.rarity} onBack={() => setPicked(null)} stage={<RodStage rod={rod} tackle={on} className={STAGE.stage} />}
      corner={<RodSlots rows={rows} busy={busy} onEquip={(id, eq) => void toggle(id, eq)} />}
      info={<><InfoHead kind={rodLine(rod)} title={row.item.display_name} text={row.item.description ?? undefined} /><RodRadar rod={rod} tackle={on} /></>}
      fine="Take it out from the tool wheel." />
  </>;
  const side = row ? <SidePanel key={row.item.id} testId="bag-owned-item" onClose={() => setPicked(null)} picture={rowPicture(row)} title={row.item.display_name} kind={kind(row)}
    facts={[["You own", row.qty.toLocaleString()], ["Status", row.item.slot ? (row.equipped ? (add ? "On your rod" : "Equipped") : "In your closet") : USE_HINT[group] ?? "Yours"],
      ...(row.item.description ? [["About", row.item.description] as const] : [])]}
    actions={row.item.slot ? <DarkButton disabled={busy} onClick={() => void toggle(row.item.id, !row.equipped)}>{busy ? "One moment…" : row.equipped ? "Unequip" : "Equip"}</DarkButton> : null}>
    {error && <StatusLine error><SignInText text={error} /></StatusLine>}
    {add && <TackleRadar tackle={add} />}
  </SidePanel> : null;
  return <>
    {!row && error && <StatusLine error><SignInText text={error} /></StatusLine>}
    {rows.length === 0 ? <Quiet>{SHELF_EMPTY[group]}</Quiet>
      : <WithSide side={side}><CardGrid title={title} min={170} phoneMin={150}>{rows.map(r => <ItemCard key={r.item.id} size="md" arrow={false} rarity={rodOf(r.item.catalogue_ref)?.rarity} picture={rowPicture(r)} name={r.item.display_name}
        line={r.item.slot ? kind(r) : USE_HINT[group] ?? kind(r)} selected={r.item.id === picked}
        pill={r.equipped ? "Equipped" : r.qty > 1 ? `×${r.qty}` : null} onClick={() => setPicked(r.item.id === picked ? null : r.item.id)} label={`${r.item.display_name}${r.equipped ? ", equipped" : ""}`} />)}</CardGrid></WithSide>}
  </>;
}
