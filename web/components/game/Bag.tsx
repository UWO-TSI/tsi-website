"use client";

/**
 * The backpack (specs/game-ui.md milestone 2), in the flat UI (specs/polish/flat-ui.md step 3): the Bag on I, the shop
 * overlay's panel. An icon rail down the left: your pockets, then what you own beyond them (tools, clothes, furniture).
 * The pockets are white item cards (drag to rearrange, or onto the tool wheel's pins; shift-click in the chest), and an
 * item opens on the white studio stage, turning where it has a model, with what it's worth and good for and what you
 * can do with it. The grid is shared with the storage chest (ChestSheet). The server owns the stock and the sizes
 * (lib/game/bagStore); the grid's arrangement and the New marks are this device's.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ArrowDownWideNarrow, Backpack, Lock, LockOpen, Pin, PinOff, Shirt, Sofa, Wrench, X } from "lucide-react";
import { ConfirmDialog } from "@/components/gui";
import { CardGrid, DarkButton, DetailView, FlatPanel, GhostButton, IconRail, InfoHead, ItemCard, PayRow, Quiet, STAGE, StatusLine, flatStyles as f } from "@/components/gui/flat";
import { Amount } from "@/components/economy/Amount";
import ItemViewer from "@/components/economy/ItemViewer";
import { SignInText } from "@/components/gui";
import { arrange, itemInfo, slotCounts, stackSize, type Slot } from "@/lib/collections/bag";
import type { BagView } from "@/lib/collections/service";
import { RECIPES, outputName } from "@/lib/crafting/recipes";
import { sellPrice, speciesClass } from "@/lib/wallet/rules";
import { iconUrl, shopIcon } from "@/lib/icons/keys";
import { itemModel, keyModel } from "@/lib/icons/itemModel";
import { pinnable } from "@/lib/game/itemModels";
import { MAX_PINS } from "@/lib/game/toolWheel";
import { togglePin, useHeld } from "@/lib/game/heldStore";
import { AudioManager } from "@/lib/game/audio";
import { ApiError } from "@/lib/apiClient";
import { bagWrite, loadBag, saveOrder, seeBag, sortBag, stockOf, swapSlots, useBag } from "@/lib/game/bagStore";
import { httpEconomyTransport } from "@/lib/wallet/transport";
import type { InventoryRow } from "@/lib/wallet/store";
import type { InventoryView } from "@/lib/wallet/service";
import { DROPS } from "@/lib/game/drops";
import s from "./Bag.module.css";

const KIND: Record<string, string> = { fish: "Fish", sea: "Sea creature", bug: "Bug", fruit: "Fruit", mineral: "Material", flower: "Flower", shell: "Shell", mushroom: "Mushroom", wood: "Material" };
export const nameOf = (key: string) => itemInfo(key)?.name ?? key.replace(/_/g, " ");
const rarityOf = (key: string) => itemInfo(key)?.rarity ?? "common";
const kindOf = (key: string) => { const sp = itemInfo(key); return (sp?.sub && KIND[sp.sub]) || (sp && KIND[sp.category]) || "Item"; };
const priceOf = (key: string) => { const c = speciesClass(key); return c ? sellPrice(c.category, c.rarity) : null; };
const usedIn = (key: string) => RECIPES.filter(r => key in r.ingredients).map(outputName);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const errText = (e: unknown) => (e instanceof ApiError ? e.message : "Couldn't reach the island. Try again.");
const DRAG = "application/x-tsi-slot";
export type Dragged = { pane: "bag" | "chest"; i: number; key: string; qty: number };

// ── The grid ─────────────────────────────────────────────────────────

/** The item's kind under its name, after a dot in its rarity's colour (the one rarity palette). */
function KindLine({ itemKey }: { itemKey: string }) {
  return <><i className={s.rarity} style={{ background: `var(--gui-rarity-${rarityOf(itemKey)})` }} aria-hidden />{kindOf(itemKey)}</>;
}

/**
 * Slots as white item cards: the real icon, the name, its kind, the stack in the pill, New and locked marks. Click picks
 * one (shift-click: `onShift`); drag moves it to another slot of this pane (`onSwap`), to the other pane (`onMoveIn`
 * there) or to a wheel pin. An empty slot is a dashed space; a slot past the size (a member over it) is ringed.
 */
export function Grid({ pane, slots, counts, capacity, selected, locked, fresh, label, onPick, onShift, onSwap, onMoveIn }: {
  pane: "bag" | "chest"; slots: readonly Slot[]; counts: readonly (number | null)[]; capacity: number; selected: number | null;
  locked?: ReadonlySet<string>; fresh?: ReadonlySet<string>; label: string;
  onPick: (i: number) => void; onShift?: (i: number) => void; onSwap?: (from: number, to: number) => void; onMoveIn?: (d: Dragged) => void;
}) {
  const shift = useRef(false);
  const drop = (e: DragEvent, to: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData(DRAG);
    if (!raw) return;
    const from = JSON.parse(raw) as Dragged;
    if (from.pane !== pane) onMoveIn?.(from);
    else if (to !== null && to !== from.i) onSwap?.(from.i, to);
  };
  return <ul className={s.grid} aria-label={label} data-pane={pane} onDragOver={e => e.preventDefault()} onDrop={e => drop(e, null)}>
    {slots.map((key, i) => {
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

type Shelf = "pockets" | "tools" | "outfits" | "furniture";
const SHELVES: { id: Shelf; label: string; icon: ReactNode }[] = [
  { id: "pockets", label: "Pockets", icon: <Backpack size={22} /> },
  { id: "tools", label: "Tools", icon: <Wrench size={22} /> },
  { id: "outfits", label: "Clothes", icon: <Shirt size={22} /> },
  { id: "furniture", label: "Furniture and finishes", icon: <Sofa size={22} /> },
];

/** The Bag (I): your pockets, and on the rail's other shelves what you own that takes no pocket. */
export function BagSheet({ open, onClose, keys }: { open: boolean; onClose: () => void; keys?: string }) {
  const [shelf, setShelf] = useState<Shelf>("pockets");
  const bag = useBag();
  useEffect(() => { if (open) void loadBag(); }, [open]);
  // You looked: the New marks go as the bag closes.
  const close = () => { seeBag(); onClose(); };
  const view = bag.view;
  return <FlatPanel open={open} onClose={close} title="Bag" keys={keys} testId="bag-sheet"
    purse={view ? <Readout used={view.used} capacity={view.capacity} label="Pockets" /> : undefined}
    rail={<IconRail label="Bag" value={shelf} onChange={setShelf} items={SHELVES.map(x => ({ ...x, badge: x.id === "pockets" ? bag.fresh.length : undefined }))} />}>
    {shelf === "pockets" ? <Pockets /> : <Owned key={shelf} group={shelf} />}
  </FlatPanel>;
}

function Pockets() {
  const bag = useBag();
  const { view } = bag;
  const { stock, slots, counts, locked } = useBagGrid(view, bag.order);
  const fresh = useMemo(() => new Set(bag.fresh), [bag.fresh]);
  const [sel, setSel] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  if (!view) return bag.error ? <StatusLine error>Your bag didn&apos;t load. <button type="button" className={s.retry} onClick={() => void loadBag()}>Try again</button></StatusLine>
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
  const filled = slots.flatMap((k, i) => (k ? [i] : []));
  const confirm = <ConfirmDialog open={dropping && !!key} title={key ? `Drop ${qty > 1 ? `${qty} × ` : ""}${nameOf(key)}?` : "Drop it?"} confirmLabel="Drop" danger busy={busy}
    onCancel={() => setDropping(false)}
    onConfirm={() => { setDropping(false); if (key) void run(async () => { await bagWrite({ action: "drop", item: key, qty }); setOpen(false); setSel(null); return `Dropped ${nameOf(key)}.`; }); }}>
    <p>It&apos;s gone for good: nobody can pick it up again.</p>
  </ConfirmDialog>;
  if (open && key && sel !== null) return <>
    <Details itemKey={key} qty={qty} total={stock[key] ?? 0} view={view} locked={locked.has(key)} busy={busy || bag.local} note={note}
      steps={filled.length > 1 ? (() => {
        const at = filled.indexOf(sel), prev = filled[(at - 1 + filled.length) % filled.length], next = filled[(at + 1) % filled.length];
        return { prev: { label: `Previous: ${nameOf(slots[prev]!)}`, onClick: () => { setSel(prev); setNote(null); } }, next: { label: `Next: ${nameOf(slots[next]!)}`, onClick: () => { setSel(next); setNote(null); } } };
      })() : null}
      onBack={() => { setOpen(false); setNote(null); }}
      onLock={() => run(async () => { await bagWrite({ action: "lock", item: key, locked: !locked.has(key) }); return null; })}
      onDrop={() => setDropping(true)} />
    {confirm}
  </>;
  return <div className={s.pockets}>
    <div className={s.head}>
      <h3 className={f.shelfTitle}>Pockets</h3>
      <GhostButton onClick={() => { sortBag(); setSel(null); setNote(null); AudioManager.playSFX("click", { rate: 1.2, gain: 0.35 }); }} disabled={!view.items.length}>
        <span className={s.withIcon}><ArrowDownWideNarrow size={15} aria-hidden /> Sort</span>
      </GhostButton>
    </div>
    {over ? <p className={s.warn} role="status">Over by {view.used - view.capacity}: you keep everything, but you can&apos;t pick anything up until you make room.</p>
      : view.used >= view.capacity && view.items.length > 0 && <p className={s.warn} role="status">{DROPS.homeIsland ? "Full: only what tops up a stack you have still fits. Sell, drop or store something in the chest at home, or get a bigger pocket at the shop." : "Full: only what tops up a stack you have still fits. Sell or drop something, or get a bigger pocket at the shop."}</p>}
    {bag.local && <p className={s.hint}><SignInText text={DROPS.homeIsland ? "Saved on this device. Sign in to keep a backpack and a storage chest." : "Saved on this device. Sign in to keep a backpack."} /></p>}
    {note && <StatusLine error={!note.ok}>{note.text}</StatusLine>}
    <Pins stock={stock} onNote={setNote} />
    <Grid pane="bag" slots={slots} counts={counts} capacity={view.capacity} selected={sel} locked={locked} fresh={fresh} label="Your pockets"
      onPick={i => { setSel(i); setOpen(true); setNote(null); AudioManager.playSFX("blip1", { rate: 1.2, gain: 0.25 }); }}
      onSwap={(a, b) => { swapSlots(slots, a, b); setSel(b); AudioManager.playSFX("blip1", { rate: 1.3, gain: 0.3 }); }} />
    <p className={s.hint}>{view.items.length ? "Click something to look at it. Drag to rearrange, or onto the tool wheel's pins." : "Your pockets are empty. Catch, pick or dig something up."}
      {DROPS.homeIsland ? " Out of room? The wooden chest in your house holds 200 more." : ""}</p>
    {confirm}
  </div>;
}

/** The picked item on the white studio stage: what it is, what it's worth and good for, and what you can do with it. */
function Details({ itemKey, qty, total, view, locked, busy, note, steps, onBack, onLock, onDrop }: {
  itemKey: string; qty: number; total: number; view: BagView; locked: boolean; busy: boolean; note: { ok: boolean; text: string } | null;
  steps: Parameters<typeof DetailView>[0]["steps"]; onBack: () => void; onLock: () => void; onDrop: () => void;
}) {
  const { pins } = useHeld();
  const spec = useMemo(() => keyModel(itemKey), [itemKey]);
  const sp = itemInfo(itemKey), price = priceOf(itemKey), recipes = usedIn(itemKey), museum = view.museum[itemKey];
  const best = view.items.find(r => r.item_key === itemKey)?.best_size_cm ?? null;
  const pinned = pins.includes(itemKey), stack = stackSize(itemKey);
  return <DetailView testId="bag-detail" onBack={onBack} backLabel="Pockets" steps={steps} hint={spec ? "Drag to turn" : null}
    stage={<ItemViewer key={itemKey} spec={spec} picture={iconUrl(itemKey)} name={nameOf(itemKey)} className={STAGE.stage} pictureClassName={STAGE.picture} />}
    info={<>
      <InfoHead kind={<><i className={s.rarity} style={{ background: `var(--gui-rarity-${rarityOf(itemKey)})` }} aria-hidden />{cap(rarityOf(itemKey))} · {kindOf(itemKey)}{locked ? " · Locked" : ""}</>}
        title={nameOf(itemKey)}
        text={locked ? "Locked: the shop won't buy it and dropping skips it, and it stays in your bag when you store all materials." : price ? <>Sells for <Amount n={price} /> each at the shop&apos;s counter.</> : "The shop doesn't buy it."} />
      <PayRow>
        {pinnable(itemKey) && <DarkButton onClick={() => { togglePin(itemKey); AudioManager.playSFX(pinned ? "exit" : "confirm", { rate: 1.2, gain: 0.35 }); }}>
          <span className={s.withIcon}>{pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />} {pinned ? "Unpin from the wheel" : "Pin to the wheel"}</span></DarkButton>}
        <GhostButton disabled={busy} onClick={onLock}><span className={s.withIcon}>{locked ? <LockOpen size={14} aria-hidden /> : <Lock size={14} aria-hidden />} {locked ? "Unlock" : "Lock"}</span></GhostButton>
        <GhostButton disabled={busy || locked} onClick={onDrop}>Drop</GhostButton>
      </PayRow>
      {note && <StatusLine error={!note.ok}>{note.text}</StatusLine>}
    </>}
    specs={[
      ["In your bag", `${total.toLocaleString()}${total > qty ? ` (this stack ${qty})` : ""}`],
      ["Size", best !== null ? `Your biggest: ${best} cm` : stack > 1 ? `Stacks to ${stack} in a slot` : "A slot each"],
      ...(sp?.donatable ? [["Museum", museum === "you" ? "On show: you donated it" : museum ? "Already on show" : "The museum still needs one"] as const] : []),
      ["Used in", recipes.length ? recipes.slice(0, 4).join(", ") + (recipes.length > 4 ? ` and ${recipes.length - 4} more` : "") : "No recipes"],
    ]} />;
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
const SLOT_NAME: Record<string, string> = { rod: "Fishing rod", net: "Bug net", shovel: "Shovel", outfit: "Outfit", hair: "Hair dye", accessory: "Accessory" };
const rowPicture = (r: InventoryRow) => r.item.sprite_url ?? shopIcon(r.item);

/** One shelf of what you own (tools, clothes, furniture and finishes): cards, and each one on the stage. */
function Owned({ group }: { group: Exclude<Shelf, "pockets"> }) {
  const transport = httpEconomyTransport;
  const [data, setData] = useState<InventoryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => transport.inventory().then(d => { setData(d); setError(null); }, e => setError(e instanceof ApiError && e.status === 401 ? "Sign in first." : errText(e))), [transport]);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (id: string, on: boolean) => {
    setBusy(true);
    try { await transport.equip(id, on); await load(); }
    catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };
  if (!data) return error ? <StatusLine error><SignInText text={error} /></StatusLine> : <Quiet>Opening your bag…</Quiet>;
  const rows = data.groups[group] ?? [];
  const row = rows.find(r => r.item.id === picked) ?? null;
  const title = SHELVES.find(x => x.id === group)!.label;
  if (row) {
    const i = rows.indexOf(row), prev = rows[(i - 1 + rows.length) % rows.length], next = rows[(i + 1) % rows.length];
    const spec = itemModel(row.item);
    return <DetailView testId="bag-owned-detail" onBack={() => setPicked(null)} backLabel={title} hint={spec ? "Drag to turn" : null}
      stage={<ItemViewer key={row.item.id} spec={spec} picture={rowPicture(row)} name={row.item.display_name} className={STAGE.stage} pictureClassName={STAGE.picture} />}
      steps={rows.length > 1 ? { prev: { label: `Previous: ${prev.item.display_name}`, onClick: () => setPicked(prev.item.id) }, next: { label: `Next: ${next.item.display_name}`, onClick: () => setPicked(next.item.id) } } : null}
      info={<>
        <InfoHead kind={row.item.slot ? SLOT_NAME[row.item.slot] ?? cap(row.item.slot) : cap(String(row.item.category))} title={row.item.display_name} text={row.item.description || undefined} />
        {error && <StatusLine error><SignInText text={error} /></StatusLine>}
      </>}
      pay={row.item.slot ? { action: { label: busy ? "One moment…" : row.equipped ? "Unequip" : "Equip", disabled: busy, onClick: () => void toggle(row.item.id, !row.equipped) } } : null}
      fine={row.item.slot ? (row.equipped ? "You're wearing it." : null) : USE_HINT[group] ? `${USE_HINT[group]}.` : null}
      specs={[["You own", row.qty.toLocaleString()], ["Kind", row.item.slot ? SLOT_NAME[row.item.slot] ?? cap(row.item.slot) : cap(String(row.item.category))],
        ["Status", row.item.slot ? (row.equipped ? "Equipped" : "In your closet") : USE_HINT[group] ?? "Yours"]]} />;
  }
  return <>
    {error && <StatusLine error><SignInText text={error} /></StatusLine>}
    {rows.length === 0 ? <Quiet>{SHELF_EMPTY[group]}</Quiet>
      : <CardGrid title={title} min={180} phoneMin={150}>{rows.map(r => <ItemCard key={r.item.id} size="md" picture={rowPicture(r)} name={r.item.display_name}
        line={r.item.slot ? SLOT_NAME[r.item.slot] ?? cap(r.item.slot) : USE_HINT[group] ?? cap(String(r.item.category))}
        pill={r.equipped ? "Equipped" : r.qty > 1 ? `×${r.qty}` : null} onClick={() => setPicked(r.item.id)} label={`${r.item.display_name}${r.equipped ? ", equipped" : ""}`} />)}</CardGrid>}
  </>;
}
