"use client";

/**
 * Wardrobe (decision 210): the same sheet opens from the closet at home and
 * the shop's fitting room. ACNH character-card layout (reference:
 * specs/references/characters/david/hair-acnh.png): pastel triangle-pattern
 * cards with the character portrait, one card per choice, grouped by slot.
 * Portrait is the current 2D player sprite until the Blender set lands.
 */
import { useState } from "react";
import { WARDROBE_STUB, loadOutfit, saveOutfit, type Outfit, type WardrobeSlot } from "@/lib/game/wardrobe";
import { useMenuTab } from "@/lib/game/useMenuTab";
import styles from "../DefaultIslandWorld.module.css";

const SLOTS: { slot: WardrobeSlot; label: string }[] = [
  { slot: "hair", label: "Hair" }, { slot: "top", label: "Tops" }, { slot: "bottom", label: "Bottoms" }, { slot: "accessory", label: "Accessories" },
];

function Portrait({ outfit, small = false }: { outfit: Outfit; small?: boolean }) {
  const pick = (slot: WardrobeSlot) => WARDROBE_STUB.find(i => i.id === outfit[slot])!;
  return <div className={styles.portrait} data-small={small}>
    <div className={styles.portraitHair} style={{ background: pick("hair").color }} data-style={outfit.hair} />
    <div className={styles.portraitFace} />
    {outfit.accessory === "acc-glasses" && <div className={styles.portraitGlasses} />}
    {outfit.accessory === "acc-cap" && <div className={styles.portraitCap} style={{ background: pick("accessory").color }} />}
    <div className={styles.portraitTop} style={{ background: pick("top").color }} />
    {!small && <div className={styles.portraitBottom} style={{ background: pick("bottom").color }} />}
  </div>;
}

export default function WardrobeSheet({ open, onClose, place }: { open: boolean; onClose: () => void; place: "closet" | "fitting" }) {
  const [outfit, setOutfit] = useState<Outfit>(loadOutfit);
  const [slot, setSlot] = useState<WardrobeSlot>("hair");
  useMenuTab(open, SLOTS.map(s => s.slot), slot, setSlot);
  if (!open) return null;
  const choose = (id: string) => { const next = { ...outfit, [slot]: id }; setOutfit(next); saveOutfit(next); };
  return <section className={styles.wardrobe} role="dialog" aria-modal="false" aria-labelledby="wardrobe-title" data-testid="wardrobe-sheet">
    <header><h2 id="wardrobe-title">{place === "closet" ? "Your closet" : "Fitting room"}</h2><button onClick={onClose} aria-label="Close">×</button></header>
    <div className={styles.wardrobeBody}>
      <div className={styles.characterCard}><Portrait outfit={outfit} /><p>{SLOTS.map(s => WARDROBE_STUB.find(i => i.id === outfit[s.slot])!.name).join(" · ")}</p></div>
      <div>
        <div role="tablist" className={styles.wardrobeTabs}>{SLOTS.map(s => <button key={s.slot} role="tab" aria-selected={slot === s.slot} onClick={() => setSlot(s.slot)}>{s.label}</button>)}</div>
        <ul className={styles.wardrobeGrid}>{WARDROBE_STUB.filter(i => i.slot === slot).map(item => <li key={item.id}>
          <button aria-pressed={outfit[slot] === item.id} onClick={() => choose(item.id)}>
            <Portrait small outfit={{ ...outfit, [slot]: item.id }} />
            <span>{item.name}</span>
          </button>
        </li>)}</ul>
        <small className={styles.hint}>{place === "fitting" ? "Try anything on; buying outfits comes with the shop update." : "Everything you own, in one place."}</small>
      </div>
    </div>
  </section>;
}
