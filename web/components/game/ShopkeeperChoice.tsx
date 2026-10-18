"use client";

/**
 * The shopkeeper at the counter (specs/interiors/shop.md): E there and they ask what you're after, with two answers.
 * "In-game items" opens the shop on the game's things; "Club merch" opens it on the real club merch, as they tell you
 * it's all upstairs to see in person. Escape leaves. It opens through the one dialog system (useWorldDialog), in the
 * talk box's place at the foot of the screen.
 */
import { Button, Dialogue } from "@/components/gui";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import { PROPOSED_RESIDENTS } from "@/lib/content/residentRoster";
import talk from "./TalkBox.module.css";
import s from "./ShopkeeperChoice.module.css";

export type ShopSection = "items" | "merch";
/** What they say as they open the merch (David's line). */
export const MERCH_LINE = "It's all upstairs if you want to see it in person.";
const NAME = PROPOSED_RESIDENTS.find(r => r.slug === "shopkeeper")?.display_name ?? "The shopkeeper";

export default function ShopkeeperChoice({ open, onChoose, onClose }: { open: boolean; onChoose: (section: ShopSection) => void; onClose: () => void }) {
  const panel = useWorldDialog<HTMLDivElement>(open, onClose);
  if (!open) return null;
  return <div ref={panel} tabIndex={-1} role="dialog" aria-label={`Talking with ${NAME}`} data-gui-dialog className={talk.talk} data-phase="speaking" data-ready data-testid="shopkeeper-choice">
    <Dialogue speaker={`${NAME} · Shopkeeper`}>
      <p className={talk.line}>What are you after today?</p>
      <div className={s.choices}>
        <Button onClick={() => onChoose("items")}>In-game items</Button>
        <Button onClick={() => onChoose("merch")}>Club merch</Button>
      </div>
    </Dialogue>
  </div>;
}
