"use client";

/**
 * The decorate panel (homes; specs/polish/flat-ui.md step 5): the furniture catalogue in the flat UI, docked at the side
 * so the room shows. The pieces you own (/api/economy/inventory) as small white cards, filtered from an icon rail (floor
 * pieces, rugs, wall pieces, and indoors the walls and floors); Rotate and Put away for the piece in hand; the
 * wallpaper and flooring as cards to pick. No detail view: a card is picked up to place.
 */
import { useState, type ReactNode } from "react";
import { Frame, LayoutGrid, PaintRoller, RectangleHorizontal, Sofa } from "lucide-react";
import { useOwned } from "@/components/economy/EconomySheets";
import { GhostButton, IconRail, ItemCard } from "@/components/gui/flat";
import { CATALOGUE, type Mount } from "@/lib/homes/catalogue";
import { FLOORINGS, FREE_FINISHES, placedCounts, WALLPAPERS, type HomeLayoutDoc, type RoomDoc } from "@/lib/homes/layout";
import { STARTER_FURNITURE } from "@/lib/wallet/catalogue";
import type { Selection } from "./useDecorate";
import { iconUrl } from "@/lib/icons/keys";
import s from "./DecorateSheet.module.css";

const TITLE = (id: string) => id.replace(/\d+$/, "").replace(/^simple/, "simple ").replace(/(\w)/, c => c.toUpperCase());
/** Signed out (or still loading): the starter pieces, as a new account has. */
const STARTER_OWNED = new Map(Object.entries(STARTER_FURNITURE));
type Filter = "all" | Mount | "finishes";
const FILTERS: { id: Filter; label: string; icon: ReactNode }[] = [
  { id: "all", label: "Everything", icon: <LayoutGrid size={20} /> }, { id: "floor", label: "Furniture", icon: <Sofa size={20} /> },
  { id: "rug", label: "Rugs", icon: <RectangleHorizontal size={20} /> }, { id: "wall", label: "On the wall", icon: <Frame size={20} /> },
  { id: "finishes", label: "Wallpaper and flooring", icon: <PaintRoller size={20} /> },
];

/** Decorate panel: the pieces and finishes you own (/api/economy/inventory), rotate / put away. */
export default function DecorateSheet({ indoor, selected, layout, room, onChoose, onRotate, onPutAway, onDone, onFinish, onShop }: {
  indoor: boolean; selected: Selection | null; layout: HomeLayoutDoc; room: RoomDoc | null;
  onChoose: (piece: string) => void; onRotate: () => void; onPutAway: () => void; onDone: () => void;
  onFinish: (key: "wallpaper" | "flooring", value: string) => void; onShop: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const owned = useOwned() ?? STARTER_OWNED;
  const placed = placedCounts(layout);
  const pieces = CATALOGUE.filter(item => owned.has(item.id) && (item.where === "both" || item.where === (indoor ? "indoor" : "outdoor")));
  const finishes = (all: readonly string[], current: string) => all.filter(f => FREE_FINISHES.includes(f) || owned.has(f) || f === current);
  // Only the filters with something in them; the walls and floors indoors.
  const filters = FILTERS.filter(x => x.id === "all" || (x.id === "finishes" ? indoor && !!room : pieces.some(p => p.mount === x.id)));
  const shown = filters.some(x => x.id === filter) ? filter : "all";
  return <section className={s.dock} aria-label="Decorate" data-testid="decorate-panel">
    <header className={s.head}>
      <h2>Decorate {indoor ? "your room" : "your island"}</h2>
      <GhostButton onClick={onDone}><kbd className={s.key}>F</kbd> Done</GhostButton>
    </header>
    <p className={s.hint}>Pick a piece, then click the floor to place it. Click a placed piece to pick it up.</p>
    <div className={s.actions}>
      <GhostButton onClick={onRotate} disabled={!selected}><kbd className={s.key}>R</kbd> Rotate</GhostButton>
      <GhostButton onClick={onPutAway} disabled={!selected}><kbd className={s.key}>X</kbd> Put away</GhostButton>
    </div>
    <IconRail label="Show" orientation="horizontal" value={shown} onChange={setFilter} items={filters} className={s.rail} />
    {shown === "finishes" && room ? <div className={s.finishes}>
      <Finish label="Wallpaper" testId="wallpaper" options={finishes(WALLPAPERS, room.wallpaper)} value={room.wallpaper} picture={w => iconUrl(`wall-${w}`)} onPick={w => onFinish("wallpaper", w)} />
      <Finish label="Flooring" testId="flooring" options={finishes(FLOORINGS, room.flooring)} value={room.flooring} picture={f => iconUrl(`floor-${f}`)} onPick={f => onFinish("flooring", f)} />
    </div> : <ul className={s.grid} aria-label="Your pieces">
      {pieces.filter(item => shown === "all" || item.mount === shown).map(item => {
        const left = (owned.get(item.id) ?? 0) - (placed.get(item.id) ?? 0);
        const pick = selected?.piece === item.id;
        return <li key={item.id}><ItemCard size="sm" arrow={false} picture={iconUrl(item.id)} px={40} name={item.label}
          line={`${item.size[0]}×${item.size[1]}${item.mount === "wall" ? " · wall" : item.mount === "rug" ? " · rug" : ""}`} pill={`${left} left`}
          selected={pick} disabled={left < 1} data-piece={item.id} className={s.card} onClick={() => onChoose(item.id)}
          label={`${item.label}, ${left} left`} /></li>;
      })}
    </ul>}
    <GhostButton className={s.shop} onClick={onShop}>More furniture in the shop</GhostButton>
  </section>;
}

/** A finish to pick (the wallpaper, the flooring): its swatches as small cards, the one on the walls ringed. */
function Finish({ label, testId, options, value, picture, onPick }: {
  label: string; testId: string; options: readonly string[]; value: string; picture: (id: string) => string; onPick: (id: string) => void;
}) {
  return <div className={s.finish}>
    <h3>{label}</h3>
    <div className={s.swatches} role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map(o => <ItemCard key={o} size="sm" arrow={false} picture={picture(o)} px={40} name={TITLE(o)} selected={o === value} className={s.card}
        role="radio" aria-checked={o === value} onClick={() => onPick(o)} label={`${label}: ${TITLE(o)}`} />)}
    </div>
  </div>;
}
