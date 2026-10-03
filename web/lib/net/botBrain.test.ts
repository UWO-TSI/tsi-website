import { describe, expect, it } from "vitest";
import { checkName } from "@/lib/identity/names";
import { parseLook } from "@/lib/game/character/look";
import { classKit } from "@/lib/combat/classes";
import { STEP } from "@/lib/game/movement/sim";
import {
  AREAS, AREA_BOUNDS, CARD_FAMILIES, EMOTE_CLIP_NAMES, EV, EV_KINDS, LOOK_MAX_BYTES, PACKET_FLAG, SANITY, SEND, decodePose, hasFlag, inAreaBounds,
  isClipEv, isHeld, isSeatKey, parseSlowState, type Area, type Pose, type SlowState,
} from "./protocol";
import { BENCH_SLOT, Bot, benchKey, benchSlot, botCard, botWorld, createBots, type BotOutbox } from "./botBrain";

const STEP_MS = STEP * 1000;

/** Every message a group of bots sends over `ms` of play, stepped in lockstep. */
function play(n: number, seed: number, ms: number) {
  const bots = createBots(n, seed, 0);
  const poses: { bot: number; pose: Pose }[] = [], slows: { bot: number; at: number; patch: SlowState }[] = [];
  const outs: BotOutbox[] = bots.map((b, i) => ({
    pose: p => { const d = decodePose(p); expect(d, `bot ${i} sent a malformed packet`).not.toBeNull(); poses.push({ bot: i, pose: { ...d!, ev: [...d!.ev] } }); },
    slow: patch => { expect(parseSlowState(patch), JSON.stringify(patch)).not.toBeNull(); slows.push({ bot: i, at: b.time, patch }); },
  }));
  for (let t = STEP_MS; t <= ms; t += STEP_MS) for (let i = 0; i < bots.length; i++) bots[i].advance(t, outs[i]);
  return { bots, poses, slows };
}

/**
 * The island room's movement checks (realtime/src/rooms/sanity.ts judge), from the contract's SANITY: bounds, the
 * speed caps, rising and falling, the teleport window and the 1 s average, the teleport flag's budget, the pause reset.
 */
function violations(poses: Pose[], area: Area) {
  const out: string[] = [];
  let base: Pose | null = null;
  let hist: { T: number; D: number }[] = [];
  const flags: number[] = [];
  const reset = (p: Pose) => { base = p; hist = [{ T: 0, D: 0 }]; };
  for (const p of poses) {
    if (!inAreaBounds(area, p.x, p.y, p.z)) { out.push(`bounds at ${p.t}`); continue; }
    if (!base) { reset(p); continue; }
    const b: Pose = base;
    if (hasFlag(p.flags, PACKET_FLAG.teleport)) {
      while (flags.length && p.t - flags[0] >= 60_000) flags.shift();
      const last = flags[flags.length - 1];
      if ((last === undefined || p.t - last >= SANITY.teleportGapMs) && flags.length < SANITY.teleportPerMinute) { flags.push(p.t); reset(p); continue; }
      out.push(`flag over budget at ${p.t}`);
    }
    const dt = p.t - b.t;
    if (dt > SANITY.dtMaxMs) { reset(p); continue; }
    if (dt < SANITY.dtMinMs) { out.push(`too soon (${dt} ms) at ${p.t}`); continue; }
    const sec = dt / 1000, h = Math.hypot(p.x - b.x, p.z - b.z), dy = p.y - b.y, hs = h / sec;
    let bad = "";
    if (hs > SANITY.speed) bad = `speed ${hs.toFixed(1)}`;
    else if (dy / sec > Math.max(SANITY.rise, SANITY.climbRatio * hs)) bad = `rise ${(dy / sec).toFixed(1)}`;
    else if (-dy / sec > SANITY.fall) bad = `fall ${(-dy / sec).toFixed(1)}`;
    else if (dt <= SANITY.teleportWindowMs && Math.hypot(h, dy) > Math.max(SANITY.teleportDist, (SANITY.speedAvg * dt) / 1000)) bad = `teleport ${h.toFixed(2)} u`;
    else {
      const last = hist[hist.length - 1], T = last.T + dt, D = last.D + h;
      for (let i = hist.length - 1; i >= 0; i--) if (T - hist[i].T >= SANITY.speedAvgWindowMs) {
        if (((D - hist[i].D) / (T - hist[i].T)) * 1000 > SANITY.speedAvg) bad = `average ${(((D - hist[i].D) / (T - hist[i].T)) * 1000).toFixed(1)}`;
        break;
      }
    }
    if (bad) { out.push(`${bad} at ${p.t} (dt ${dt})`); continue; }
    const last = hist[hist.length - 1];
    hist.push({ T: last.T + dt, D: last.D + h });
    if (hist.length > 64) hist.shift();
    base = p;
  }
  return out;
}

describe("cards", () => {
  it("are seeded: the same seed and index give the same card, others differ", () => {
    expect(botCard(7, 3)).toEqual(botCard(7, 3));
    expect(botCard(7, 3)).not.toEqual(botCard(8, 3));
    expect(botCard(7, 3).look).not.toBe(botCard(7, 4).look);
  });
  it("carry world names only, valid looks, kits of their family, and a mix of members, public accounts and phones", () => {
    const cards = Array.from({ length: 48 }, (_, i) => botCard(1, i));
    for (const c of cards) {
      expect(checkName(c.name), c.name).toMatchObject({ ok: true });
      expect(c.look.length).toBeGreaterThan(0);
      expect(c.look.length).toBeLessThanOrEqual(LOOK_MAX_BYTES);
      expect(JSON.parse(c.look)).toEqual(parseLook(JSON.parse(c.look))); // already a valid look
      if (c.kit) expect(CARD_FAMILIES[c.family]).toBe(classKit(c.kit)!.family);
      expect(AREAS).toContain(c.area);
      expect(c.mobile).toBe(c.role === "rest");
    }
    expect(new Set(cards.map(c => c.name)).size).toBe(cards.length);
    expect(cards.some(c => c.badge === 1) && cards.some(c => c.badge === 0)).toBe(true);
    expect(cards.filter(c => c.mobile).length).toBeGreaterThan(3);
    expect(cards.filter(c => c.area === "cafe").length).toBeGreaterThan(3);
  });
});

describe("the bots' village", () => {
  it("has places to go, two benches of two slots, glide spots at the shore and the café's seats", () => {
    const w = botWorld();
    expect(w.points.length).toBeGreaterThan(10);
    for (const [x, z] of w.points) expect(w.standable(x, z)).toBe(true);
    expect(w.benches.length).toBeGreaterThanOrEqual(2);
    for (const b of w.benches) {
      const [ax, az] = benchSlot(b, 0), [bx, bz] = benchSlot(b, 1);
      expect(Math.hypot(ax - bx, az - bz)).toBeCloseTo(2 * BENCH_SLOT, 6);
      expect(isSeatKey(benchKey(b, 1))).toBe(true);
    }
    expect(w.shores.length).toBeGreaterThan(4);
    for (const s of w.shores) expect(w.move.wet(s.x + s.dx * 2, s.z + s.dz * 2)).toBe(true);
    expect(w.cafeSeats.length).toBe(20);
    expect(w.cafeSeats.every(s => isSeatKey(s.key))).toBe(true);
    // Each group of bots has its own claims.
    expect(botWorld().taken).not.toBe(w.taken);
  });
});

describe("bots", () => {
  const { bots, poses, slows } = play(24, 1, 120_000);

  it("are deterministic by seed", () => {
    const again = play(6, 1, 20_000), other = play(6, 2, 20_000), first = play(6, 1, 20_000);
    expect(JSON.stringify(again.poses)).toBe(JSON.stringify(first.poses));
    expect(JSON.stringify(again.slows)).toBe(JSON.stringify(first.slows));
    expect(JSON.stringify(other.poses)).not.toBe(JSON.stringify(first.poses));
  });

  it("send honest traces: nothing the island room's sanity checks would strike", () => {
    for (let i = 0; i < bots.length; i++) {
      const mine = poses.filter(p => p.bot === i).map(p => p.pose);
      expect(mine.length).toBeGreaterThan(0);
      expect(violations(mine, bots[i].card.area), `${bots[i].card.name}`).toEqual([]);
    }
  });

  it("(the checker itself strikes a jump, a fast sample and a flag over budget)", () => {
    const mine = poses.filter(p => p.bot === 0).map(p => p.pose);
    const moved = mine.map((p, k) => (k === 40 ? { ...p, x: p.x + 5 } : p));
    expect(violations(moved, "village").length).toBeGreaterThan(0);
    const rushed = mine.map((p, k) => (k === 40 ? { ...p, t: mine[39].t + 5 } : p));
    expect(violations(rushed, "village").some(v => v.startsWith("too soon"))).toBe(true);
    const flagged = mine.slice(0, 30).map((p, k) => ({ ...p, t: k * 100, x: k * 3, flags: PACKET_FLAG.teleport }));
    expect(violations(flagged, "village").some(v => v.startsWith("flag over budget"))).toBe(true);
  });

  it("keep the sender's rates: 10 Hz on the ground, 15 Hz moving through the air, events at once but 30 ms apart", () => {
    for (let i = 0; i < bots.length; i++) {
      const mine = poses.filter(p => p.bot === i).map(p => p.pose);
      for (let k = 1; k < mine.length; k++) {
        const gap = mine[k].t - mine[k - 1].t;
        expect(gap).toBeGreaterThanOrEqual(SEND.eventGapMs - 1);
        // A timed packet waits a full interval; anything sooner carries events, a teleport or the stop.
        const early = gap < 1000 / SEND.moveHz - 1;
        if (early) expect(mine[k].ev.length > 0 || mine[k].flags !== 0 || (mine[k].vx === 0 && mine[k].vy === 0 && mine[k].vz === 0), `${bots[i].card.name} ${mine[k].t}`).toBe(true);
      }
    }
    const perBotPerSecond = poses.length / bots.length / 120;
    expect(perBotPerSecond).toBeGreaterThan(2);
    expect(perBotPerSecond).toBeLessThan(15);
  });

  it("walk, run, hop, dash, slide, glide, splash, emote and sit", () => {
    const kinds = new Set<string>(), clips = new Set<string>();
    for (const { pose } of poses) for (let i = 0; i < pose.ev.length; i += 3) {
      const k = pose.ev[i] as number;
      kinds.add(EV_KINDS[k]);
      if (isClipEv(k)) clips.add(pose.ev[i + 1] as string);
    }
    for (const k of ["play", "ghost", "stop", "jump", "hop", "land", "dash", "slide", "stand", "glide", "furl", "splash", "respawn", "roll"]) expect(kinds, k).toContain(k);
    for (const c of EMOTE_CLIP_NAMES) expect(clips, c).toContain(c);
    expect(clips).toContain("Jump");
    const moves = new Set(poses.map(p => p.pose.move));
    for (const m of [1, 3, 5]) expect(moves, `move ${m}`).toContain(m); // Air, Glide, Slide
    const speeds = poses.map(p => Math.hypot(p.pose.vx, p.pose.vz));
    expect(speeds.some(s => s > 5 && s < 8)).toBe(true); // walking
    expect(speeds.some(s => s > 10)).toBe(true); // running and dashing
    // Sitting: a Sit pose with a bench slot's key, and the teleport flag on the snap onto it.
    const sits = slows.filter(s => s.patch.pose === "Sit" && s.patch.seat?.startsWith("bench:"));
    expect(sits.length).toBeGreaterThan(2);
    expect(poses.some(p => hasFlag(p.pose.flags, PACKET_FLAG.teleport))).toBe(true);
    // Standing up clears the claim.
    expect(slows.some(s => s.patch.seat === "" && s.patch.pose === "")).toBe(true);
  });

  it("carry only what the contract allows: seat keys, held items, emote and clip names, lengths in range", () => {
    for (const { patch } of slows) {
      if (patch.seat !== undefined) expect(patch.seat === "" || isSeatKey(patch.seat)).toBe(true);
      if (patch.held !== undefined) expect(isHeld(patch.held)).toBe(true);
    }
    for (const { pose } of poses) for (let i = 0; i < pose.ev.length; i += 3) {
      const k = pose.ev[i] as number;
      // A drop or a rise, as the kit measured it (a landing on a lip a touch higher reads a hair below 0).
      if (k === EV.land || k === EV.roll || k === EV.splash || k === EV.mantle) expect(pose.ev[i + 1]).toBeGreaterThan(-0.5);
      expect(pose.ev[i + 2]).toBeGreaterThanOrEqual(0);
    }
  });

  it("phones rest on a bench slot, flagged mobile, and emote from it; café bots study at a seat", () => {
    const phones = bots.filter(b => b.card.mobile);
    expect(phones.length).toBeGreaterThan(0);
    for (const b of phones) {
      const i = bots.indexOf(b);
      const first = slows.find(s => s.bot === i)!;
      expect(first.patch).toMatchObject({ pose: "Sit" });
      expect(first.patch.seat).toMatch(/^bench:/);
      expect(poses.some(p => p.bot === i && p.pose.ev.some((v, k) => k % 3 === 1 && (EMOTE_CLIP_NAMES as readonly unknown[]).includes(v)))).toBe(true);
    }
    const studiers = bots.filter(b => b.card.role === "study");
    expect(studiers.length).toBeGreaterThan(0);
    for (const b of studiers) {
      const first = slows.find(s => s.bot === bots.indexOf(b))!.patch;
      expect(first).toMatchObject({ pose: "Study", study: 2 });
      expect(first.seat).toMatch(/^study:cafe-/);
      expect(inAreaBounds("cafe", ...b.position)).toBe(true);
      expect(Math.abs(b.position[0])).toBeLessThanOrEqual(AREA_BOUNDS.cafe.half);
    }
    // Two bots never claim the same seat at once.
    const held = new Map<string, number>();
    for (const s of slows) {
      if (s.patch.seat === undefined) continue;
      for (const [k, v] of held) if (v === s.bot) held.delete(k);
      if (s.patch.seat) {
        expect(held.has(s.patch.seat), s.patch.seat).toBe(false);
        held.set(s.patch.seat, s.bot);
      }
    }
  });

  it("a bot stepped in one go or in pieces ends in the same place", () => {
    const [a] = createBots(1, 9, 0), [b] = createBots(1, 9, 0), none: BotOutbox = { pose: () => {}, slow: () => {} };
    a.advance(30_000, none);
    for (let t = 0; t < 30_000; t += 37) b.advance(t, none);
    b.advance(30_000, none);
    expect(b.position).toEqual(a.position);
    expect(b).toBeInstanceOf(Bot);
  });
});
