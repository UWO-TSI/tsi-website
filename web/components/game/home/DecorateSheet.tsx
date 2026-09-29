"use client";

import { useOwned } from "@/components/economy/EconomySheets";
import { CATALOGUE } from "@/lib/homes/catalogue";
import { FLOORINGS, FREE_FINISHES, placedCounts, WALLPAPERS, type HomeLayoutDoc, type RoomDoc } from "@/lib/homes/layout";
import { STARTER_FURNITURE } from "@/lib/wallet/catalogue";
import type { Selection } from "./useDecorate";
import styles from "../DefaultIslandWorld.module.css";

const TITLE = (id: string) => id.replace(/\d+$/, "").replace(/^simple/, "simple ").replace(/(\w)/, c => c.toUpperCase());
/** Signed out (or still loading): the starter pieces, as a new account has. */
const STARTER_OWNED = new Map(Object.entries(STARTER_FURNITURE));

/** Decorate panel: the pieces and finishes you own (/api/economy/inventory), rotate / put away. */
export default function DecorateSheet({ indoor, selected, layout, room, onChoose, onRotate, onPutAway, onDone, onFinish, onShop }: {
  indoor: boolean; selected: Selection | null; layout: HomeLayoutDoc; room: RoomDoc | null;
  onChoose: (piece: string) => void; onRotate: () => void; onPutAway: () => void; onDone: () => void;
  onFinish: (key: "wallpaper" | "flooring", value: string) => void; onShop: () => void;
}) {
  const owned = useOwned() ?? STARTER_OWNED;
  const placed = placedCounts(layout);
  const pieces = CATALOGUE.filter(item => owned.has(item.id) && (item.where === "both" || item.where === (indoor ? "indoor" : "outdoor")));
  const finishes = (all: readonly string[], current: string) => all.filter(f => FREE_FINISHES.includes(f) || owned.has(f) || f === current);
  return <section className={styles.decorate} aria-label="Decorate">
    <header><h2>Decorate {indoor ? "your room" : "your island"}</h2><button onClick={onDone}><kbd>F</kbd> Done</button></header>
    <p className={styles.hint}>Pick a piece, then click the floor to place it. Click a placed piece to pick it up.</p>
    <div className={styles.decorateActions}>
      <button onClick={onRotate} disabled={!selected}><kbd>R</kbd> Rotate</button>
      <button onClick={onPutAway} disabled={!selected}><kbd>X</kbd> Put away</button>
    </div>
    <ul className={styles.catalogue}>
      {pieces.map(item => {
        const left = (owned.get(item.id) ?? 0) - (placed.get(item.id) ?? 0);
        return <li key={item.id}><button aria-pressed={selected?.piece === item.id} onClick={() => onChoose(item.id)} disabled={left < 1} data-piece={item.id}>
          {item.label}<small>{left} left · {item.size[0]}×{item.size[1]}{item.mount === "wall" ? " · wall" : item.mount === "rug" ? " · rug" : ""}</small>
        </button></li>;
      })}
    </ul>
    <button className={styles.shopLink} onClick={onShop}>More furniture in the shop</button>
    {indoor && room && <div className={styles.finishes}>
      <label className={styles.preset}><span>Wallpaper</span>
        <select value={room.wallpaper} onChange={e => onFinish("wallpaper", e.target.value)} data-testid="wallpaper">{finishes(WALLPAPERS, room.wallpaper).map(w => <option key={w} value={w}>{TITLE(w)}</option>)}</select></label>
      <label className={styles.preset}><span>Flooring</span>
        <select value={room.flooring} onChange={e => onFinish("flooring", e.target.value)} data-testid="flooring">{finishes(FLOORINGS, room.flooring).map(f => <option key={f} value={f}>{TITLE(f)}</option>)}</select></label>
    </div>}
  </section>;
}
