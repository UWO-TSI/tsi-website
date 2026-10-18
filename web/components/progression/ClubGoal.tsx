"use client";

/**
 * A club goal in the cleaner cream menus (specs/polish/flat-ui.md round 2, step 7): what the club is building, one bar
 * for how far it has come, who chipped in, what everyone gets, and Contribute. On the journal's page it sits on the
 * sheet with no box (`look` "page"); on the notice board it is a notice pinned up on paper (`look` "notice"). A goal
 * waiting on another is one line (`UpNextGoal`). The monument's four stages are the bar's quarter marks.
 */
import { Gift, Lock } from "lucide-react";
import type { GoalProgressView } from "@/lib/progression/types";
import { Button, Card, Progress } from "@/components/gui";
import { rewardName } from "./GoalCard";
import m from "./menus.module.css";

/** What a goal's header says it is. */
export const goalKind = (g: Pick<GoalProgressView, "goal_type" | "cycle">) => (g.goal_type === "story" ? "Club goal" : `Seasonal goal · ${g.cycle}`);
/** Waiting on another goal: the open board shows it as one line under "Up next". */
export const isUpNext = (g: Pick<GoalProgressView, "completed" | "open" | "locked_by">) => !g.completed && !g.open && !!g.locked_by;

export default function ClubGoal({ goal, look = "page", onContribute }: { goal: GoalProgressView; look?: "page" | "notice"; onContribute?: (slug: string) => void }) {
  const myRoom = Math.max(0, goal.caps.member_total - goal.my_points);
  const body = <>
    <p className={m.kicker}>{goal.completed ? `${goalKind(goal)} · complete` : goalKind(goal)}</p>
    <h3 className={m.goalTitle}>{goal.title}</h3>
    <p className={m.text}>{goal.summary}</p>
    <p className={m.goalLine}><span><b>{goal.points.toLocaleString()}</b> of {goal.target_points.toLocaleString()} pts</span><b>{goal.percent}%</b></p>
    <Progress value={goal.percent} max={100} label={`${goal.title} progress`} valueText={`${goal.percent}%`} kind="xp" className={m.goalBar} />
    <p className={m.goalNumbers}>
      <span>{goal.contributors} {goal.contributors === 1 ? "member" : "members"} chipped in</span>
      <span>Your share <b>{goal.my_points.toLocaleString()}</b> pts</span>
    </p>
    {goal.event.rewards.length ? <p className={m.reward}><Gift size={16} aria-hidden="true" />
      <span>{goal.completed ? "Everyone got " : "When it fills, everyone gets "}<b>{goal.event.rewards.map(rewardName).join(", ")}</b></span></p> : null}
    {!goal.completed && goal.open && onContribute ? <div className={m.actions}>
      <Button onClick={() => onContribute(goal.slug)} disabled={myRoom <= 0}>{myRoom <= 0 ? "You've given the most you can" : "Contribute"}</Button>
      <span className={m.aside}>A club event check-in adds {goal.weights.event} pts</span>
    </div> : null}
  </>;
  if (look === "notice") return <Card as="article" pinned tilt={-0.4} className={m.notice} aria-label={goal.title} data-testid="goal-notice">{body}</Card>;
  return <article className={m.goal} aria-label={goal.title} data-testid="goal-page">{body}</article>;
}

/** A goal waiting on another: its name and what it waits for. */
export function UpNextGoal({ goal, waitingOnTitle }: { goal: GoalProgressView; waitingOnTitle?: string }) {
  return <p className={m.upNext} aria-label={`${goal.title}, up next`}>
    <Lock size={14} aria-hidden="true" /><span><b>{goal.title}</b> opens when {waitingOnTitle ?? "the goal before it"} is complete.</span>
  </p>;
}
