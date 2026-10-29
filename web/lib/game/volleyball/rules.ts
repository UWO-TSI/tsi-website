/**
 * Rally scoring (specs/minigames/beach-volleyball.md §5): one set to 21, win by 2, sides switch every 7 points, the
 * rally's winner serves, and a team winning the serve back hands it to its other player (beach rotation). Pure.
 */
import type { Side } from "./court";

export type Team = 0 | 1;
export const TARGET = 21, SWITCH_EVERY = 7;

export interface Score {
  points: [number, number];
  serving: Team;
  /** Which of each team's two players (0 or 1) serves when that team serves next. */
  server: [0 | 1, 0 | 1];
  /** The side (z sign) team 0 plays on; team 1 has the other. */
  side0: Side;
}

export const newScore = (serving: Team = 0, side0: Side = -1): Score => ({ points: [0, 0], serving, server: [0, 0], side0 });
export const sideOfTeam = (s: Score, t: Team): Side => (t === 0 ? s.side0 : (-s.side0 as Side));
export const teamOnSide = (s: Score, side: Side): Team => (side === s.side0 ? 0 : 1);

export function winnerOf(points: readonly [number, number]): Team | null {
  const [a, b] = points;
  if (Math.max(a, b) < TARGET || Math.abs(a - b) < 2) return null;
  return a > b ? 0 : 1;
}

/** The rally's winner scores and serves; returns the new score and whether the teams switch sides now. */
export function awardRally(s: Score, winner: Team): { score: Score; switched: boolean; over: Team | null } {
  const points: [number, number] = [...s.points];
  points[winner]++;
  const server: [0 | 1, 0 | 1] = [...s.server];
  // Won the serve back: the other player serves (the one who served last stays put while the team keeps serving).
  if (winner !== s.serving) server[winner] = (server[winner] ^ 1) as 0 | 1;
  const over = winnerOf(points);
  const switched = !over && (points[0] + points[1]) % SWITCH_EVERY === 0;
  return { score: { points, serving: winner, server, side0: switched ? (-s.side0 as Side) : s.side0 }, switched, over };
}

/**
 * The rotation's first step: the team that serves first starts with its player 0; the other team, when it first wins
 * the serve, should also start with its player 0, so its index begins on 1 (awardRally flips it on the way in).
 */
export function openingScore(serving: Team, side0: Side): Score {
  const s = newScore(serving, side0);
  s.server[serving === 0 ? 1 : 0] = 1;
  return s;
}

/** Who loses the rally when the ball lands at a point on `landSide`: in, that side; out, whoever touched it last. */
export function landingLoser(s: Score, landedIn: boolean, landSide: Side, lastTeam: Team | null): Team {
  if (landedIn || lastTeam === null) return teamOnSide(s, landSide);
  return lastTeam;
}
