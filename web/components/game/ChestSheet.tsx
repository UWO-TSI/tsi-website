"use client";

/**
 * The home storage chest (specs/game-ui.md §6): any wooden chest in your house opens it (E). Your bag and the chest
 * side by side; shift-click or drag a stack across, or store every material at once. Each move is the server's
 * (storage_move, once per key); a full bag or chest refuses it.
 */
import { useEffect, useMemo, useState } from "react";
import { Archive } from "lucide-react";
import { Button, Loading, Sheet } from "@/components/gui";
import { isMaterial, slotCounts, sortSlots, type Slot } from "@/lib/collections/bag";
import { AudioManager } from "@/lib/game/audio";
import { bagWrite, loadBag, stockOf, swapSlots, useBag } from "@/lib/game/bagStore";
import { Grid, Readout, errText, nameOf, useBagGrid } from "./Bag";
import s from "./Bag.module.css";

const CHEST_MIN = 20, COLUMNS = 5;
/** The storage chest (a wooden chest in your house, E): your bag and the chest side by side. */
export function ChestSheet({ open, onClose, keys }: { open: boolean; onClose: () => void; keys?: string }) {
  const bag = useBag();
  const { view } = bag;
  const { stock, slots, counts, locked } = useBagGrid(view, bag.order);
  const chestStock = useMemo(() => stockOf(view, "chest"), [view]);
  const chest = useMemo(() => {
    const sorted = sortSlots(chestStock);
    return [...sorted, ...Array<Slot>(Math.max(CHEST_MIN, Math.ceil((sorted.length + 1) / COLUMNS) * COLUMNS) - sorted.length).fill(null)];
  }, [chestStock]);
  const chestCounts = useMemo(() => slotCounts(chest, chestStock), [chest, chestStock]);
  const [sel, setSel] = useState<{ pane: "bag" | "chest"; i: number } | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) void loadBag(); }, [open]);
  const move = async (key: string, qty: number, to: "chest" | "bag") => {
    if (busy) return;
    setBusy(true);
    try {
      await bagWrite({ action: to === "chest" ? "store" : "take", item: key, qty });
      AudioManager.playSFX(to === "chest" ? "click" : "blip1", { rate: 1.1, gain: 0.35 });
      setSel(null);
      setNote(null);
    } catch (e) { setNote({ ok: false, text: errText(e) }); }
    finally { setBusy(false); }
  };
  const storeAll = async () => {
    setBusy(true);
    try {
      const before = Object.entries(stock).filter(([k, n]) => n > 0 && isMaterial(k) && !locked.has(k)).length;
      await bagWrite({ action: "store_materials" });
      AudioManager.playSFX("confirm", { gain: 0.4 });
      setSel(null);
      setNote({ ok: true, text: before ? "Every material is in the chest." : "No materials to store." });
    } catch (e) { setNote({ ok: false, text: errText(e) }); }
    finally { setBusy(false); }
  };
  const picked = sel && (sel.pane === "bag" ? { key: slots[sel.i], qty: counts[sel.i] } : { key: chest[sel.i], qty: chestCounts[sel.i] });
  const pick = (pane: "bag" | "chest") => (i: number) => { setSel(sel?.pane === pane && sel.i === i ? null : { pane, i }); setNote(null); };
  const shift = (pane: "bag" | "chest") => (i: number) => {
    const key = pane === "bag" ? slots[i] : chest[i], qty = pane === "bag" ? counts[i] : chestCounts[i];
    if (key && qty) void move(key, qty, pane === "bag" ? "chest" : "bag");
  };
  const off = !view || bag.local;
  return <Sheet open={open} onClose={onClose} title="Storage chest" icon={<Archive size={22} aria-hidden />} size="xl" keys={keys} testId="chest-sheet"
    footer={<>
      <span className={s.footHint}>Shift-click or drag a stack across to move it.</span>
      {picked?.key && <Button size="sm" disabled={busy || off} onClick={() => void move(picked.key!, picked.qty ?? 1, sel!.pane === "bag" ? "chest" : "bag")}>
        {sel!.pane === "bag" ? "Store" : "Take"} {picked.qty && picked.qty > 1 ? `${picked.qty} × ` : ""}{nameOf(picked.key)}</Button>}
    </>}>
    {!view ? <Loading label="Opening the chest…" /> : <>
      {bag.local && <p className={s.hint}>Sign in to keep a storage chest.</p>}
      {note && <p className={note.ok ? s.ok : s.bad} role="status">{note.text}</p>}
      <div className={s.panes}>
        <section className={s.pane} aria-label="Your bag">
          <header className={s.paneHead}>
            <h3>Your bag</h3>
            <Readout used={view.used} capacity={view.capacity} label="Your bag" />
            <Button size="sm" variant="secondary" disabled={busy || off} onClick={() => void storeAll()}>Store all materials</Button>
          </header>
          <div className={s.pocket}>
            <Grid pane="bag" slots={slots} counts={counts} capacity={view.capacity} selected={sel?.pane === "bag" ? sel.i : null} locked={locked} label="Your bag"
              onPick={pick("bag")} onShift={off ? undefined : shift("bag")} onSwap={(a, b) => swapSlots(slots, a, b)}
              onMoveIn={d => !off && void move(d.key, d.qty, "bag")} />
          </div>
        </section>
        <section className={s.pane} aria-label="Storage chest">
          <header className={s.paneHead}>
            <h3>Storage chest</h3>
            <Readout used={view.chest_used} capacity={view.chest_capacity} label="Storage chest" />
          </header>
          <div className={s.pocket} data-chest>
            <Grid pane="chest" slots={chest} counts={chestCounts} capacity={view.chest_capacity} selected={sel?.pane === "chest" ? sel.i : null} label="Storage chest"
              onPick={pick("chest")} onShift={off ? undefined : shift("chest")} onMoveIn={d => !off && void move(d.key, d.qty, "chest")} />
          </div>
        </section>
      </div>
    </>}
  </Sheet>;
}
