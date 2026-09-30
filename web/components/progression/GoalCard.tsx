"use client";

import type { GoalProgressView } from "@/lib/progression/types";
import { catalogueItem } from "@/lib/homes/catalogue";
import s from "./progression.module.css";

/** A reward item's name from its shop slug: furniture from the homes catalogue, anything else from the slug. */
export function rewardName(slug: string): string {
  const piece = slug.startsWith("furn-") ? catalogueItem(slug.slice(5)) : undefined;
  const words = slug.replace(/^(furn|acc|wear|outfit)-/, "").replace(/-/g, " ");
  return piece?.label ?? words.charAt(0).toUpperCase() + words.slice(1);
}

export default function GoalCard({ goal, waitingOnTitle, onContribute }: { goal: GoalProgressView; waitingOnTitle?: string; onContribute?: (slug: string) => void }) {
  const myRoom = Math.max(0, goal.caps.member_total - goal.my_points);
  return (
    <article className={s.card} aria-label={goal.title}>
      <div className={s.row}>
        <div>
          <div className={s.eyebrow}>{goal.goal_type === "story" ? "Club goal" : `Seasonal goal · ${goal.cycle}`}</div>
          <h3>{goal.title}</h3>
        </div>
        <span className={s.status} data-s={goal.completed ? "completed" : goal.open ? "active" : "locked"}>
          {goal.completed ? "Complete" : goal.open ? `${goal.percent}%` : goal.locked_by ? "Up next" : "Closed"}
        </span>
      </div>
      <p className={s.muted}>{goal.summary}</p>
      {goal.locked_by ? <p className={s.muted}><b>Opens when {waitingOnTitle ?? "the goal before it"} is complete.</b></p> : null}
      {goal.event.rewards.length ? (
        <p className={s.muted}>
          {goal.completed ? "Everyone got: " : "When the club fills it, everyone gets: "}<b>{goal.event.rewards.map(rewardName).join(", ")}</b>
        </p>
      ) : null}
      <div className={s.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goal.percent} aria-label={`${goal.title} progress`}>
        <div className={s.fill} style={{ width: `${goal.percent}%` }} />
        <div className={s.ticks} aria-hidden>{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</div>
      </div>
      <div className={s.stats}>
        <span><b>{goal.points.toLocaleString()}</b> / {goal.target_points.toLocaleString()} pts</span>
        <span><b>{goal.contributors}</b> {goal.contributors === 1 ? "member" : "members"} chipped in</span>
        <span>Your share: <b>{goal.my_points.toLocaleString()}</b> pts</span>
      </div>
      <div className={s.stage} aria-label={`Monument stage ${goal.stage} of 4`}>
        {[1, 2, 3, 4].map((n) => <span key={n} data-on={goal.stage >= n} />)}
      </div>
      {!goal.completed && goal.open && onContribute ? (
        <div className={s.actions}>
          <button className={s.btn} onClick={() => onContribute(goal.slug)} disabled={myRoom <= 0}>
            {myRoom <= 0 ? "You've given the max" : "Contribute"}
          </button>
          <span className={s.muted} style={{ alignSelf: "center" }}>Club event check-in: {goal.weights.event} pts</span>
        </div>
      ) : null}
    </article>
  );
}
