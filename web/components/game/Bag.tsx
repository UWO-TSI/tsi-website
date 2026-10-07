"use client";

/**
 * The backpack (specs/game-ui.md milestone 2): the Bag sheet on I (the pockets' grid, an item's details, the tool
 * wheel's pins, sort; what you own beyond your pockets on its second tab), and the grid the storage chest shares
 * (ChestSheet). The server owns the stock and the sizes (lib/game/bagStore); the grid's arrangement and the New marks
 * are this device's.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ArrowDownWideNarrow, Backpack, Lock, LockOpen, Pin, PinOff } from "lucide-react";
import { Badge, Button, ConfirmDialog, IconButton, ItemTile, Loading, Progress, Sheet, SignInText, Tabs, type Rarity } from "@/components/gui";
import { InventoryBody } from "@/components/economy/EconomySheets";
import { Amount } from "@/components/economy/Amount";
import { arrange, itemInfo, slotCounts, stackSize, type Slot } from "@/lib/collections/bag";
import type { BagView } from "@/lib/collections/service";
import { RECIPES, outputName } from "@/lib/crafting/recipes";
import { sellPrice, speciesClass } from "@/lib/wallet/rules";
import { iconUrl } from "@/lib/icons/keys";
import { pinnable } from "@/lib/game/itemModels";
import { MAX_PINS } from "@/lib/game/toolWheel";
import { togglePin, useHeld } from "@/lib/game/heldStore";
import { AudioManager } from "@/lib/game/audio";
import { ApiError } from "@/lib/apiClient";
import { bagWrite, loadBag, saveOrder, seeBag, sortBag, stockOf, swapSlots, useBag } from "@/lib/game/bagStore";
import s from "./Bag.module.css";

const KIND: Record<string, string> = { fish: "Fish", sea: "Sea creature", bug: "Bug", fruit: "Fruit", mineral: "Material", flower: "Flower", shell: "Shell", mushroom: "Mushroom", wood: "Material" };
export const nameOf = (key: string) => itemInfo(key)?.name ?? key.replace(/_/g, " ");
const rarityOf = (key: string) => (itemInfo(key)?.rarity ?? "common") as Rarity;
const kindOf = (key: string) => { const sp = itemInfo(key); return (sp?.sub && KIND[sp.sub]) || (sp && KIND[sp.category]) || "Item"; };
const priceOf = (key: string) => { const c = speciesClass(key); return c ? sellPrice(c.category, c.rarity) : null; };
const usedIn = (key: string) => RECIPES.filter(r => key in r.ingredients).map(outputName);
export const errText = (e: unknown) => (e instanceof ApiError ? e.message : "Couldn't reach the island. Try again.");
const DRAG = "application/x-tsi-slot";
export type Dragged = { pane: "bag" | "chest"; i: number; key: string; qty: number };

// ── The grid ─────────────────────────────────────────────────────────

/**
 * Slots of real icons with their stack counts and rarity edges. Click picks one (shift-click: `onShift`); drag moves
 * it to another slot of this pane (`onSwap`), to the other pane (`onMoveIn` there) or to a wheel pin.
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
      const lock = !!key && !!locked?.has(key);
      return <li key={i} className={s.slot} data-over={i >= capacity || undefined} onDragOver={e => e.preventDefault()} onDrop={e => drop(e, i)}>
        {key ? <ItemTile size={58} icon={iconUrl(key)} name={nameOf(key)} count={counts[i] ?? undefined} rarity={rarityOf(key)} isNew={fresh?.has(key)} selected={selected === i}
          aria-label={lock ? `${nameOf(key)}, ${counts[i]}, locked` : undefined} draggable
          onDragStart={e => { e.dataTransfer.setData(DRAG, JSON.stringify({ pane, i, key, qty: counts[i] ?? 1 } satisfies Dragged)); e.dataTransfer.effectAllowed = "move"; }}
          onClickCapture={e => { shift.current = e.shiftKey; }} onClick={() => (shift.current && onShift ? onShift(i) : onPick(i))} />
          : <ItemTile size={58} name="" empty />}
        {lock && <Lock className={s.lock} size={13} strokeWidth={2.6} aria-hidden />}
      </li>;
    })}
  </ul>;
}

/** Slots used of the size: full and over said plainly. */
export function Readout({ used, capacity, label }: { used: number; capacity: number; label: string }) {
  const state = used > capacity ? "over" : used >= capacity ? "full" : undefined;
  return <div className={s.readout} data-state={state}>
    <Progress value={Math.min(used, capacity)} max={capacity} label={`${label}: ${used} of ${capacity} slots`} size={8} />
    <span className={s.readoutText}><b>{used}</b>/{capacity}{state === "over" ? ` · over by ${used - capacity}` : state === "full" ? " · full" : ""}</span>
  </div>;
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

/** The Bag (I): your pockets, and on the second tab what you own that takes no pocket (tools, clothes, furniture). */
export function BagSheet({ open, onClose, keys }: { open: boolean; onClose: () => void; keys?: string }) {
  const [tab, setTab] = useState<"pockets" | "owned">("pockets");
  useEffect(() => { if (open) void loadBag(); }, [open]);
  // You looked: the New marks go as the bag closes.
  const close = () => { seeBag(); onClose(); };
  return <Sheet open={open} onClose={close} title="Bag" icon={<Backpack size={22} aria-hidden />} size="lg" keys={keys} testId="bag-sheet">
    <Tabs label="Bag" value={tab} onChange={setTab} className={s.tabs}
      tabs={[{ id: "pockets", label: "Pockets" }, { id: "owned", label: "Tools, clothes and furniture" }]} />
    {tab === "pockets" ? <Pockets /> : <InventoryBody />}
  </Sheet>;
}

function Pockets() {
  const bag = useBag();
  const { view } = bag;
  const { stock, slots, counts, locked } = useBagGrid(view, bag.order);
  const fresh = useMemo(() => new Set(bag.fresh), [bag.fresh]);
  const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  if (!view) return <Loading label="Opening your bag…" />;
  const key = sel !== null ? slots[sel] ?? null : null;
  const qty = sel !== null ? counts[sel] ?? 0 : 0;
  const run = async (act: () => Promise<string | null>) => {
    setBusy(true);
    try { const text = await act(); setNote(text ? { ok: true, text } : null); }
    catch (e) { setNote({ ok: false, text: errText(e) }); }
    finally { setBusy(false); }
  };
  const over = view.used > view.capacity;
  return <div className={s.pockets}>
    <div className={s.bar}>
      <Readout used={view.used} capacity={view.capacity} label="Pockets" />
      <Button size="sm" variant="quiet" onClick={() => { sortBag(); setSel(null); setNote(null); AudioManager.playSFX("click", { rate: 1.2, gain: 0.35 }); }} disabled={!view.items.length}>
        <ArrowDownWideNarrow size={16} aria-hidden /> Sort
      </Button>
    </div>
    {over ? <p className={s.warn} role="status">Over by {view.used - view.capacity}: you keep everything, but you can&apos;t pick anything up until you make room.</p>
      : view.used >= view.capacity && view.items.length > 0 && <p className={s.warn} role="status">Full: only what tops up a stack you have still fits. Sell, drop or store something in the chest at home, or get a bigger pocket at the shop.</p>}
    {bag.local && <p className={s.hint}><SignInText text="Saved on this device. Sign in to keep a backpack and a storage chest." /></p>}
    <Pins stock={stock} onNote={setNote} />
    <div className={s.layout}>
      <div className={s.pocket}>
        <Grid pane="bag" slots={slots} counts={counts} capacity={view.capacity} selected={sel} locked={locked} fresh={fresh} label="Your pockets"
          onPick={i => { setSel(sel === i ? null : i); setNote(null); }} onSwap={(a, b) => { swapSlots(slots, a, b); setSel(b); AudioManager.playSFX("blip1", { rate: 1.3, gain: 0.3 }); }} />
        {!view.items.length && <p className={s.hint}>Your pockets are empty. Catch, pick or dig something up.</p>}
      </div>
      <Details itemKey={key} qty={qty} total={key ? stock[key] ?? 0 : 0} view={view} locked={!!key && locked.has(key)} busy={busy || bag.local} note={note}
        onLock={() => key && run(async () => { await bagWrite({ action: "lock", item: key, locked: !locked.has(key) }); return null; })}
        onDrop={() => setDropping(true)} />
    </div>
    <ConfirmDialog open={dropping && !!key} title={key ? `Drop ${qty > 1 ? `${qty} × ` : ""}${nameOf(key)}?` : "Drop it?"} confirmLabel="Drop" danger busy={busy}
      onCancel={() => setDropping(false)}
      onConfirm={() => { setDropping(false); if (key) void run(async () => { await bagWrite({ action: "drop", item: key, qty }); return `Dropped ${nameOf(key)}.`; }); }}>
      <p>It&apos;s gone for good: nobody can pick it up again.</p>
    </ConfirmDialog>
  </div>;
}

/** The picked item: what it is, what it's worth and good for, and what you can do with it. */
function Details({ itemKey, qty, total, view, locked, busy, note, onLock, onDrop }: {
  itemKey: string | null; qty: number; total: number; view: BagView; locked: boolean; busy: boolean; note: { ok: boolean; text: string } | null;
  onLock: () => void; onDrop: () => void;
}) {
  const { pins } = useHeld();
  if (!itemKey) return <aside className={s.details} data-empty>
    <p className={s.hint}>Pick something to see it here. Drag to rearrange, or onto the tool wheel&apos;s pins.</p>
    <p className={s.hint}>Out of room? The wooden chest in your house holds 200 more.</p>
    {note && <p className={note.ok ? s.ok : s.bad} role="status">{note.text}</p>}
  </aside>;
  const sp = itemInfo(itemKey), price = priceOf(itemKey), recipes = usedIn(itemKey), museum = view.museum[itemKey];
  const best = view.items.find(r => r.item_key === itemKey)?.best_size_cm ?? null;
  const pinned = pins.includes(itemKey), stack = stackSize(itemKey);
  return <aside className={s.details} aria-label={`${nameOf(itemKey)} details`}>
    <header className={s.detailsHead}>
      <ItemTile size={64} icon={iconUrl(itemKey)} name={nameOf(itemKey)} rarity={rarityOf(itemKey)} />
      <div>
        <h3>{nameOf(itemKey)}</h3>
        <p className={s.kind}><span className={s.rarityDot} style={{ background: `var(--gui-rarity-${rarityOf(itemKey)})` }} aria-hidden />{rarityOf(itemKey)} · {kindOf(itemKey)}{locked && <Badge tone="warn" className={s.lockBadge}><Lock size={12} aria-hidden /> Locked</Badge>}</p>
      </div>
    </header>
    <dl className={s.facts}>
      <dt>In your bag</dt><dd>{total.toLocaleString()}{total > qty ? ` (this stack ${qty})` : ""}</dd>
      <dt>Size</dt><dd>{best !== null ? `Your biggest: ${best} cm` : stack > 1 ? `Stacks to ${stack} in a slot` : "A slot each"}</dd>
      {/* Selling happens at the shop's counter (ShopCounter), not from the bag. */}
      <dt>Sells for</dt><dd>{price ? <><Amount n={price} /> each, at the shop&apos;s counter</> : "The shop doesn't buy it"}</dd>
      {sp?.donatable && <><dt>Museum</dt><dd>{museum === "you" ? "On show: you donated it" : museum ? "Already on show" : "The museum still needs one"}</dd></>}
      <dt>Used in</dt><dd>{recipes.length ? recipes.slice(0, 4).join(", ") + (recipes.length > 4 ? ` and ${recipes.length - 4} more` : "") : "No recipes"}</dd>
    </dl>
    <div className={s.actions}>
      {pinnable(itemKey) && <Button size="sm" variant="secondary" onClick={() => { togglePin(itemKey); AudioManager.playSFX(pinned ? "exit" : "confirm", { rate: 1.2, gain: 0.35 }); }}>
        {pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />} {pinned ? "Unpin from the wheel" : "Pin to the wheel"}</Button>}
      <Button size="sm" variant="quiet" disabled={busy} onClick={onLock}>{locked ? <LockOpen size={15} aria-hidden /> : <Lock size={15} aria-hidden />} {locked ? "Unlock" : "Lock"}</Button>
      <Button size="sm" variant="danger" disabled={busy || locked} onClick={onDrop}>Drop</Button>
    </div>
    {locked && <p className={s.hint}>Locked: the shop won&apos;t buy it and dropping skips it, and it stays in your bag when you store all materials.</p>}
    {note && <p className={note.ok ? s.ok : s.bad} role="status">{note.text}</p>}
  </aside>;
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
        <ItemTile size={40} icon={iconUrl(k)} name={nameOf(k)} count={stock[k] ?? 0} />
        <span className={s.pinName}>{nameOf(k)}</span>
        <IconButton label={`Unpin ${nameOf(k)}`} size="sm" onClick={() => togglePin(k)}><PinOff size={15} aria-hidden /></IconButton>
      </> : <span className={s.pinEmpty}>Drag here to pin</span>}
    </div>)}
  </div>;
}
