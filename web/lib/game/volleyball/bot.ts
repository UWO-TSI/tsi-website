/**
 * The bots (specs/minigames/beach-volleyball.md §6): who takes the ball, where to stand, when to jump, and a press when
 * the ball is as good as it will get (or it's going off). Errors come from one skill value: a plan to wait for a lower
 * quality, the odd misjudged ball. Every bot press goes through the same `press` as yours.
 */
import { NO_INPUT, type MoveInput } from "@/lib/game/movement/sim";
import { ballAt, timeToHeight } from "./ball";
import { COURT, sideOf, type Side } from "./court";
import { COURT_TUNING, HAND, BLOCK_TIME, attackSpot, partnerOf, press, rand, reachOf, serverOf, setSpot, sideOfPlayer, startDive, type Match, type Touch } from "./match";
import type { Team } from "./rules";

/** The open sand on `side`: the spot furthest from that side's players (a little random), in from the lines. */
export function openSpot(m: Match, side: Side): { x: number; z: number } {
  let best = { x: 0, z: side * COURT.halfLength * 0.6 }, score = -1;
  const hw = COURT.halfWidth - 0.6, hl = COURT.halfLength - 0.6;
  for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) {
    const x = -hw + (2 * hw * a) / 4, z = side * (1.2 + ((hl - 1.2) * b) / 3);
    let d = Infinity;
    for (let i = 0; i < 4; i++) if (sideOfPlayer(m, i) === side) d = Math.min(d, Math.hypot(m.players[i].s.x - x, m.players[i].s.z - z));
    const s = d + rand(m) * 0.6;
    if (s > score) { score = s; best = { x, z }; }
  }
  return best;
}

const hash01 = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

/** The touch a team makes next (1 to 3). */
const nextTouch = (m: Match, t: Team) => (m.touchTeam === t ? m.touches + 1 : 1);

/** Per team, who takes the ball now: re-picked whenever its flight changes (match.ts). -1: not that team's ball. */
export function pickReceivers(m: Match): [number, number] {
  const out: [number, number] = [-1, -1];
  if (m.phase !== "rally") return out;
  for (const t of [0, 1] as Team[]) {
    const side = sideOfPlayer(m, t * 2), mine = [t * 2, t * 2 + 1];
    let r = -1;
    // Their ball while it's on their side with touches left: not ours yet (its crossing re-picks).
    const theirs = m.touchTeam === (t ^ 1) && sideOf(m.ball.z) !== side;
    if (m.touchTeam === t && m.touches < 3) r = m.lastBlock ? mine.find(i => i !== m.lastTouch) ?? -1 : partnerOf(m.lastTouch);
    else if (!theirs && m.landing && sideOf(m.landing.z) === side) {
      const called = mine.find(i => m.players[i].call > 0);
      const at = timeToHeight(m.ball, HAND.bump), pt = at === null ? m.ball : ballAt(m.ball, at);
      const near = mine.reduce((a, b) => (Math.hypot(m.players[a].s.x - pt.x, m.players[a].s.z - pt.z) <= Math.hypot(m.players[b].s.x - pt.x, m.players[b].s.z - pt.z) ? a : b));
      r = called ?? near;
      // A ball going out: a good bot leaves it.
      if (m.landing && !m.landing.in && m.players[r].bot && rand(m) > (1 - m.players[r].skill) * 0.3) r = -1;
    }
    out[t] = r;
    if (r >= 0 && m.players[r].bot) {
      const p = m.players[r];
      p.want = 0.95 - rand(m) * (1 - p.skill) * 0.8;
      p.miss = rand(m) < (1 - p.skill) * 0.12;
      p.lastQ = 0;
    }
  }
  return out;
}

function steer(p: Match["players"][number], x: number, z: number, jump = false): MoveInput {
  const dx = x - p.s.x, dz = z - p.s.z, d = Math.hypot(dx, dz);
  if (d < 0.12) return { ...NO_INPUT, jump, jumpPressed: jump };
  const k = Math.min(1, d * 2) / d;
  return { ...NO_INPUT, x: dx * k, z: dz * k, sprint: d > 2, jump, jumpPressed: jump };
}

export function botInput(m: Match, i: number): MoveInput {
  const p = m.players[i], side = sideOfPlayer(m, i), team = p.team, b = m.ball;
  if (p.s.mode !== "air") p.blocked = false;
  if (m.phase !== "rally" || p.down > 0 || p.dive || (m.phase as string) === "serve" && i === serverOf(m)) return NO_INPUT;
  const rec = m.receiver[team], air = p.s.mode === "air";
  if (rec === i) {
    const n = nextTouch(m, team);
    let how: Touch = n >= 3 ? "spike" : n === 2 ? "set" : "bump";
    const spikeY = COURT_TUNING.jumpHeight * 0.95 + HAND.spike;
    let t = timeToHeight(b, how === "spike" ? spikeY : HAND[how]);
    // Too low to spike (a bad set): play it over with a set.
    if (how === "spike" && t === null && !air) { how = "set"; t = timeToHeight(b, HAND.set); }
    const pt = t === null ? b : ballAt(b, t);
    let jump = false;
    if (how === "spike" && !air && t !== null && t < COURT_TUNING.jumpApexTime + 0.04 && Math.hypot(pt.x - p.s.x, pt.z - p.s.z) < 0.9) jump = true;
    if (!p.miss && (how !== "spike" || air)) {
      const q = reachOf(m, i, how);
      const prevQ = p.lastQ;
      p.lastQ = q ?? 0;
      if (q !== null && (q >= p.want || q < prevQ) && press(m, i, how)) return NO_INPUT;
    }
    // Out of reach and coming down fast: dive for it.
    const low = timeToHeight(b, HAND.dig), lp = low === null ? null : ballAt(b, low), far = lp ? Math.hypot(lp.x - p.s.x, lp.z - p.s.z) : 0;
    if (!p.miss && lp && sideOf(lp.z) === side && low! < 0.32 && far > 0.9 && far < 2.4 && how !== "spike") startDive(m, i, lp.x - p.s.x, lp.z - p.s.z);
    return steer(p, pt.x, pt.z + (how === "spike" ? side * 0.25 : 0), jump);
  }
  const mate = m.players[partnerOf(i)];
  if (rec === partnerOf(i)) {
    const n = nextTouch(m, team);
    // My partner passes: be the setter. My partner sets: approach to attack. My partner attacks: cover.
    if (n === 1) { const s = setSpot(side, mate.s.x); return steer(p, s.x, s.z); }
    if (n === 2) { const a = attackSpot(side, p.s.x); return steer(p, a.x, a.z + side * 1.4); }
    return steer(p, mate.s.x * 0.5, side * 2.5);
  }
  // Defence: the ball is theirs. One blocks in front of their attacker, the other digs deep.
  const opp = (team ^ 1) as Team, attacker = m.receiver[opp];
  if (attacker >= 0 && m.touchTeam === opp && m.touches >= 1) {
    const ax = m.players[attacker].s.x, blocker = Math.abs(m.players[team * 2].s.x - ax) <= Math.abs(m.players[team * 2 + 1].s.x - ax) ? team * 2 : team * 2 + 1;
    // Block or pull back to dig: decided once per attack (its flight), more often blocking the better the bot.
    const commit = hash01(m.flight * 31 + i) < 0.15 + 0.45 * p.skill;
    if (i === blocker && commit) {
      const a = m.players[attacker].s, jump = !air && a.mode === "air" && a.vy < 3 && Math.abs(p.s.z) < 0.8;
      if (air && !p.blocked && p.s.vy < 1.5) { p.block = BLOCK_TIME; p.blocked = true; }
      return steer(p, ax, side * 0.35, jump);
    }
    return steer(p, -ax * 0.5, side * COURT.halfLength * 0.55);
  }
  return steer(p, p.slot ? 1.3 : -1.3, side * COURT.halfLength * 0.55);
}
