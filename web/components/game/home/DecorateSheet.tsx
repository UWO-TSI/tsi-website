"use client";

import { CATALOGUE } from "@/lib/homes/catalogue";
import { FLOORINGS, WALLPAPERS, type RoomDoc } from "@/lib/homes/layout";
import type { Selection } from "./useDecorate";
import styles from "../DefaultIslandWorld.module.css";

const TITLE = (id: string) => id.replace(/\d+$/, "").replace(/^simple/, "simple ").replace(/(\w)/, c => c.toUpperCase());

/** Decorate panel: catalogue stub (inventory later), rotate / put away, room finishes. */
export default function DecorateSheet({ indoor, selected, room, onChoose, onRotate, onPutAway, onDone, onFinish }: {
  indoor: boolean; selected: Selection | null; room: RoomDoc | null;
  onChoose: (piece: string) => void; onRotate: () => void; onPutAway: () => void; onDone: () => void;
  onFinish: (key: "wallpaper" | "flooring", value: string) => void;
}) {
  const pieces = CATALOGUE.filter(item => item.where === "both" || item.where === (indoor ? "indoor" : "outdoor"));
  return <section className={styles.decorate} aria-label="Decorate">
    <header><h2>Decorate {indoor ? "your room" : "your island"}</h2><button onClick={onDone}><kbd>F</kbd> Done</button></header>
    <p className={styles.hint}>Pick a piece, then click the floor to place it. Click a placed piece to pick it up.</p>
    <div className={styles.decorateActions}>
      <button onClick={onRotate} disabled={!selected}><kbd>R</kbd> Rotate</button>
      <button onClick={onPutAway} disabled={!selected}><kbd>X</kbd> Put away</button>
    </div>
    <ul className={styles.catalogue}>
      {pieces.map(item => <li key={item.id}><button aria-pressed={selected?.piece === item.id} onClick={() => onChoose(item.id)} data-piece={item.id}>
        {item.label}<small>{item.size[0]}×{item.size[1]}{item.mount === "wall" ? " · wall" : item.mount === "rug" ? " · rug" : ""}</small>
      </button></li>)}
    </ul>
    {indoor && room && <div className={styles.finishes}>
      <label className={styles.preset}><span>Wallpaper</span>
        <select value={room.wallpaper} onChange={e => onFinish("wallpaper", e.target.value)} data-testid="wallpaper">{WALLPAPERS.map(w => <option key={w} value={w}>{TITLE(w)}</option>)}</select></label>
      <label className={styles.preset}><span>Flooring</span>
        <select value={room.flooring} onChange={e => onFinish("flooring", e.target.value)} data-testid="flooring">{FLOORINGS.map(f => <option key={f} value={f}>{TITLE(f)}</option>)}</select></label>
    </div>}
  </section>;
}
