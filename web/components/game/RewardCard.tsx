"use client";

/**
 * The shared reward card (specs/polish/forage-craft-museum.md deliverable 1): a bug, a forage find, a dig (or its purse) or a
 * craft gets the flat kit's reward pop (RewardPop; specs/design-bible.md UI) with the item's own art, its name, its
 * rarity as the card's outline and its size, a spring in and its chime (lib/game/reward.ts); a bottle's recipe is paper
 * (a scroll), as it is in the world. It sits beside the pickup's fly-in (BagButton): the token flies from the
 * middle of the screen into the Bag while the card stands to its right and says what it was. One card at a time; one
 * that arrives while another is up waits its turn, cutting the first short (never under MIN_MS). A click puts it away.
 */
import { useEffect, useRef, useState } from "react";
import { HairlineRow, HairlineRows, RewardPop } from "@/components/gui/flat";
import { AudioManager } from "@/lib/game/audio";
import { RARITY_META } from "@/lib/game/fishing";
import { REWARD_EVENTS, rewardHold, rewardOf, rewardSound, type Reward } from "@/lib/game/reward";
import styles from "./RewardCard.module.css";

/** The out animation's length, and how long a card shows at least when the next one is waiting (ms). */
const OUT_MS = 260, MIN_MS = 1400;

/** A bottle's note: a paper scroll between two wooden rollers that unrolls to show the recipe, what it makes on top. */
function Scroll({ reward, leaving, onClose }: { reward: Reward; leaving: boolean; onClose: () => void }) {
  const { name, icon, title, note, ingredients } = reward;
  return <article className={styles.scroll} data-leaving={leaving || undefined} onClick={onClose} data-testid="reward-card" data-kind="bottle">
    <span className={styles.roller} aria-hidden="true" />
    <div className={styles.paper}>
      <p className={styles.title}>{title}</p>
      <div className={styles.scrollArt} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" width={72} height={72} />
      </div>
      <h3 className={styles.name}>{name}</h3>
      {ingredients && ingredients.length > 0 && <ul className={styles.ingredients} aria-label="What it takes">{ingredients.map(i => <li key={i.key}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={i.icon} alt="" width={24} height={24} /><span>{i.name}</span><b>×{i.count}</b>
      </li>)}</ul>}
      {note && <p className={styles.note}>{note}</p>}
    </div>
    <span className={styles.roller} data-bottom aria-hidden="true" />
  </article>;
}

function Card({ reward, leaving, onClose }: { reward: Reward; leaving: boolean; onClose: () => void }) {
  const { kind, name, icon, rarity, size, title, note, isNew, ingredients } = reward;
  if (kind === "bottle") return <Scroll reward={reward} leaving={leaving} onClose={onClose} />;
  // The flat kit's reward pop (specs/design-bible.md UI 4, 7): the rarity as its outline, never a fill.
  return <RewardPop picture={icon} title={title} name={name} rarity={rarity} kind={kind} isNew={isNew} leaving={leaving} onClose={onClose}
    rarityLabel={rarity ? RARITY_META[rarity].label : null} facts={size ? <span>{size} cm</span> : null} note={note || null}>
    {ingredients && ingredients.length > 0 && <HairlineRows>{ingredients.map(i => <HairlineRow key={i.key} art={i.icon} title={i.name} end={`×${i.count}`} />)}</HairlineRows>}
  </RewardPop>;
}

/** The card's run, written outside React's render (events and timers): what shows, since when, what waits. */
interface Run { queue: Reward[]; current: Reward | null; leaving: boolean; shownAt: number; leaveAt: number; timer: number; id: number }

export default function RewardCard() {
  const [shown, setShown] = useState<{ reward: Reward; id: number; leaving: boolean } | null>(null);
  const run = useRef<Run>({ queue: [], current: null, leaving: false, shownAt: 0, leaveAt: 0, timer: 0, id: 0 });
  const dismiss = useRef<() => void>(() => {});
  useEffect(() => {
    const r = run.current;
    const schedule = (fn: () => void, ms: number) => { window.clearTimeout(r.timer); r.timer = window.setTimeout(fn, Math.max(0, ms)); };
    const next = () => {
      r.current = r.queue.shift() ?? null;
      r.leaving = false;
      if (!r.current) { setShown(null); return; }
      r.shownAt = performance.now();
      r.leaveAt = r.shownAt + rewardHold(r.current);
      setShown({ reward: r.current, id: ++r.id, leaving: false });
      const s = rewardSound(r.current);
      AudioManager.playSFX(s.name, { rate: s.rate, gain: s.gain });
      schedule(leave, r.leaveAt - r.shownAt);
    };
    const leave = () => {
      if (!r.current || r.leaving) return;
      r.leaving = true;
      setShown(c => (c ? { ...c, leaving: true } : c));
      schedule(next, OUT_MS);
    };
    dismiss.current = leave;
    const on = (e: Event) => {
      const reward = rewardOf(e.type, (e as CustomEvent<unknown>).detail);
      if (!reward) return;
      r.queue.push(reward);
      if (!r.current) { next(); return; }
      if (r.leaving) return;
      // One is up: it gives way after its least time (or sooner, if it was going anyway).
      const at = Math.min(r.leaveAt, r.shownAt + MIN_MS);
      if (at < r.leaveAt) { r.leaveAt = at; schedule(leave, at - performance.now()); }
    };
    for (const name of REWARD_EVENTS) window.addEventListener(name, on);
    return () => { for (const name of REWARD_EVENTS) window.removeEventListener(name, on); window.clearTimeout(r.timer); };
  }, []);
  return <div className={styles.layer} role="status" aria-live="polite">
    {shown && <Card key={shown.id} reward={shown.reward} leaving={shown.leaving} onClose={() => dismiss.current()} />}
  </div>;
}
