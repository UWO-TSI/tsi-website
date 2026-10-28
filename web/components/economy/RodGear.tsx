"use client";

/**
 * A rod's stats and add-ons (David 2026-10-27, v1-gameplay m4 and x-shop), wherever a rod is shown: the rod shop's
 * detail and the bag's. The hex radar draws the rod's six stats with the add-ons' gains layered on in orange; the
 * slots put owned bait and a bobber on (one per slot, member_inventory.equipped), which every rod then fishes with.
 */
import { HexRadar } from "@/components/gui/flat";
import { RODS, SLOTS, STAT_INFO, STAT_KEYS, STAT_MAX, bestOwnedRod, rig, tackleByKey, type RodTier, type Tackle } from "@/lib/game/rods";
import type { InventoryRow } from "@/lib/wallet/store";
import s from "./RodGear.module.css";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const rodOf = (ref: string | null | undefined): RodTier | null => RODS.find(r => r.key === ref) ?? null;
/** The add-ons a member has on (equipped inventory rows), by key. */
export const equippedTackle = (rows: readonly InventoryRow[]): string[] =>
  rows.flatMap(r => (r.equipped && tackleByKey(r.item.catalogue_ref) ? [r.item.catalogue_ref!] : []));
/** The best rod among owned inventory rows (the starter rod is everyone's). */
export const bestRod = (rows: readonly InventoryRow[]) => bestOwnedRod(rows.flatMap(r => (r.item.catalogue_ref ? [r.item.catalogue_ref] : [])));
/** "+2 Luck, +1 Lure". */
export const gainsText = (t: Tackle) => STAT_KEYS.flatMap(k => (t.gains[k] ? [`+${t.gains[k]} ${STAT_INFO[k].label}`] : [])).join(", ");
/** What each stat does, for the detail's spec band. */
export const STAT_SPECS: [string, string][] = STAT_KEYS.map(k => [STAT_INFO[k].label, STAT_INFO[k].does]);

export function RodRadar({ rod, tackle = [] }: { rod: RodTier; tackle?: readonly string[] }) {
  const on = rig(rod, tackle);
  return <HexRadar label={`${rod.name} stats`} max={STAT_MAX}
    axes={STAT_KEYS.map(k => ({ label: STAT_INFO[k].label, base: rod.base[k], gain: on.stats[k] - rod.base[k], hint: STAT_INFO[k].does }))} />;
}

/** The add-on slots: each slot's owned add-ons, pressed when on. Pressing one puts it on (and takes off the slot's other). */
export function TackleSlots({ rows, busy, onEquip }: { rows: readonly InventoryRow[]; busy: boolean; onEquip: (itemId: string, on: boolean) => void }) {
  return <div className={s.slots} data-testid="tackle-slots">
    {SLOTS.map(slot => {
      const mine = rows.filter(r => tackleByKey(r.item.catalogue_ref)?.slot === slot);
      return <div key={slot} role="group" aria-label={`${cap(slot)} slot`} className={s.slot}>
        <span className={s.slotName}>{cap(slot)}</span>
        {mine.length === 0 ? <span className={s.empty}>Empty. {cap(slot)} is on the Tools shelf.</span>
          : mine.map(r => <button key={r.item.id} type="button" className={s.chip} aria-pressed={r.equipped} disabled={busy} onClick={() => onEquip(r.item.id, !r.equipped)}>
            {r.item.display_name}<small>{gainsText(tackleByKey(r.item.catalogue_ref)!)}</small>
          </button>)}
      </div>;
    })}
  </div>;
}
