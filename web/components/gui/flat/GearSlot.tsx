"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import PixelImage from "@/components/economy/PixelImage";
import f from "./flat.module.css";

/** One thing that fits the slot: its picture, name, what it adds, and whether it's on. */
export interface GearOption { id: string; name: string; picture: string; line?: ReactNode; on: boolean }

/**
 * A small gear slot (a rod's bait or bobber, David 2026-10-28): a white square showing what's on it, or the slot's own
 * faint icon when empty. Hover names it; a click opens the things you own that fit, and picking one puts it on (or
 * takes it off). Escape or a click elsewhere closes the list.
 */
export function GearSlot({ label, icon, options, empty, busy, onPick, testId }: {
  label: string; icon: ReactNode; options: readonly GearOption[];
  /** What the list says when you own nothing that fits. */
  empty: ReactNode;
  busy?: boolean; onPick: (id: string, on: boolean) => void; testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const on = options.find(o => o.on) ?? null;
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("pointerdown", away); window.removeEventListener("keydown", key, true); };
  }, [open]);
  return <span ref={box} className={f.slotBox} data-testid={testId}>
    <button type="button" className={f.gearSlot} data-on={on ? true : undefined} aria-haspopup="true" aria-expanded={open}
      aria-label={`${label}: ${on ? on.name : "empty"}`} onClick={() => setOpen(v => !v)}>
      {on ? <PixelImage src={on.picture} px={30} className={f.gearSlotArt} /> : <span className={f.gearSlotEmpty} aria-hidden>{icon}<Plus size={10} /></span>}
      {!open && <span className={f.radarTip} role="tooltip"><b>{label}</b>{on ? <>{on.name}{on.line ? <> · {on.line}</> : null}</> : "Empty"}</span>}
    </button>
    {open && <span className={f.slotMenu} role="menu" aria-label={label}>
      <b className={f.slotMenuHead}>{label}</b>
      {options.length === 0 ? <span className={f.slotMenuEmpty}>{empty}</span> : options.map(o =>
        <button key={o.id} type="button" role="menuitemcheckbox" aria-checked={o.on} className={f.slotOption} disabled={busy}
          onClick={() => { onPick(o.id, !o.on); setOpen(false); }}>
          <PixelImage src={o.picture} px={28} className={f.slotOptionArt} />
          <span><span className={f.slotOptionName}>{o.name}</span>{o.line ? <small>{o.line}</small> : null}</span>
          {o.on ? <Check size={15} aria-hidden /> : null}
        </button>)}
    </span>}
  </span>;
}
