// Load bots (specs/multiplayer.md §5.9, §7): real @colyseus/sdk clients with `dev:bot-NN`
// tokens (the server needs DEV_AUTH=1, never in production). Each bot drives the real
// movement sim (web/lib/game/movement/sim.ts) on flat ground around a point, walks,
// sprints, dashes, hops, slides and emotes, and sends what the client's sender sends:
// poses at 10 Hz on the ground and 15 Hz in a move state, an event packet at once (30 ms
// apart), one on stopping, nothing while still; `s` now and then; clock pings.
//
//   npm --prefix realtime run bots -- --n 24 --area village --near 4,-6
//   flags: --url ws://localhost:2567  --radius 12  --seconds 0 (forever)  --prefix bot  --quiet
//          --report: after --seconds, stop, print one JSON line {type:"report", bots:[...]}, stay
//          connected until SIGTERM (the soak compares the server's state with it)
import { Client, type Room } from "@colyseus/sdk";
import * as N from "@net/protocol";
import { createMoveState, MOVE_TUNING, NO_INPUT, STEP, stepMove, type MoveInput, type MoveState, type MoveWorld } from "../../web/lib/game/movement/sim";

type Args = {
  n: number;
  area: N.Area;
  near: [number, number];
  url: string;
  radius: number;
  seconds: number;
  prefix: string;
  report: boolean;
  quiet: boolean;
};

export function parseArgs(argv: string[]): Args {
  const get = (k: string) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const area = (get("area") ?? "village") as N.Area;
  if (!N.AREAS.includes(area)) throw new Error(`--area must be one of ${N.AREAS.join(", ")}`);
  const near = (get("near") ?? "0,0").split(",").map(Number) as [number, number];
  return {
    n: Number(get("n") ?? 8),
    area,
    near,
    url: get("url") ?? "ws://localhost:2567",
    radius: Number(get("radius") ?? 12),
    seconds: Number(get("seconds") ?? 0),
    prefix: get("prefix") ?? "bot",
    report: argv.includes("--report"),
    quiet: argv.includes("--quiet"),
  };
}

const FLAT: MoveWorld = { top: () => 0, wet: () => false };
const EMOTES = N.EMOTE_CLIP_NAMES;
const STOPPED = new Set([N.CLOSE.kicked, N.CLOSE.replaced, N.CLOSE.version, N.CLOSE.removed, N.HTTP_REFUSAL.auth, N.HTTP_REFUSAL.origin]);

/** A small seeded generator, so each bot's wander is repeatable. */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 2 ** 32;
}

export type BotReport = {
  name: string;
  sessionId: string;
  roomId: string;
  /** The last pose sent, as wire integers (cm). */
  last: { x: number; y: number; z: number } | null;
  poses: number;
  events: number;
  drops: number;
  reconnects: number;
  maxReconnectMs: number;
  left: number | null;
};

export class Bot {
  room?: Room;
  private sim: MoveState;
  private goal: [number, number];
  private sprint = false;
  private idleUntil = 0;
  private nextDash = 0;
  private nextJump = 0;
  private slideUntil = 0;
  private nextSlow = 0;
  private acc = 0;
  private jumpPressed = false;
  private dashPressed = false;
  private pending: (number | string)[] = [];
  private lastSend = 0;
  private lastSentMoving = false;
  private firstPose = true;
  private prev: [number, number, number];
  private seq = 0;
  private clock: N.ClockSample[] = [];
  private offset = 0;
  private nextPing = 0;
  private droppedAt = 0;
  private stopped = false;
  private still = false;
  private readonly rand: () => number;
  readonly stats: BotReport;

  constructor(readonly name: string, private readonly a: Args) {
    this.rand = rng(name);
    const [x, z] = this.pick();
    this.sim = createMoveState(x, z, FLAT, this.rand() * Math.PI * 2);
    this.prev = [this.sim.x, this.sim.y, this.sim.z];
    this.goal = this.pick();
    this.stats = { name, sessionId: "", roomId: "", last: null, poses: 0, events: 0, drops: 0, reconnects: 0, maxReconnectMs: 0, left: null };
  }

  private pick(): [number, number] {
    const half = N.AREA_BOUNDS[this.a.area].half - 4;
    const clamp = (v: number) => Math.max(-half, Math.min(half, v));
    const r = this.a.radius * Math.sqrt(this.rand()), th = this.rand() * Math.PI * 2;
    return [clamp(this.a.near[0] + r * Math.cos(th)), clamp(this.a.near[1] + r * Math.sin(th))];
  }

  async connect(): Promise<void> {
    const client = new Client(this.a.url);
    client.http.options.credentials = "omit";
    client.auth.token = `${N.DEV_TOKEN_PREFIX}${this.name}`;
    const room = await client.joinOrCreate(N.ROOM_NAME, { v: N.PROTOCOL, area: N.AREAS.indexOf(this.a.area), mobile: false, showClass: true });
    this.room = room;
    this.stats.sessionId = room.sessionId;
    this.stats.roomId = room.roomId;
    this.firstPose = true;
    this.clock.length = 0;
    this.nextPing = 0;
    room.onMessage(N.MSG.pong, (m) => {
      const p = N.parsePong(m);
      if (!p) return;
      this.clock.push({ sent: p.client, received: Date.now(), server: p.server });
      this.offset = N.estimateClockOffset(this.clock) ?? this.offset;
    });
    room.onMessage(N.MSG.event, () => {});
    room.onMessage(N.MSG.sys, () => {});
    room.onDrop(() => {
      this.stats.drops++;
      this.droppedAt = Date.now();
    });
    room.onReconnect(() => {
      this.stats.reconnects++;
      this.stats.maxReconnectMs = Math.max(this.stats.maxReconnectMs, Date.now() - this.droppedAt);
      this.firstPose = true;
    });
    room.onLeave((code) => {
      this.room = undefined;
      this.stats.left = code;
      if (this.stopped || STOPPED.has(code as never)) return;
      // Dropped for good (restart, grace over): rejoin after a short random wait.
      setTimeout(() => this.connect().catch(() => {}), 2000 + this.rand() * 3000);
    });
  }

  /** One render frame: step the sim, then send whatever the sender would. */
  frame(dtMs: number, now: number): void {
    const room = this.room;
    if (!room || !room.connection?.isOpen) return;
    const epoch = (room.state as { epoch?: number } | undefined)?.epoch;
    if (!epoch) return;

    if (now >= this.nextPing) {
      room.send(N.MSG.ping, [Date.now()]);
      this.nextPing = now + (this.clock.length < N.CLOCK.burst ? N.CLOCK.burstGapMs : N.CLOCK.everyMs);
    }

    this.acc += Math.min(250, dtMs) / 1000;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.sim = stepMove(this.sim, this.input(now), STEP, FLAT, MOVE_TUNING);
      this.jumpPressed = this.dashPressed = false;
      for (const e of this.sim.events) {
        const kind = (N.EV as Record<string, number>)[e.kind];
        if (kind !== undefined && this.pending.length < N.EV_MAX * 3) this.pending.push(kind, e.kind === "land" ? e.drop : 0, 0);
      }
    }

    const s = this.sim;
    const moved = Math.hypot(s.x - this.prev[0], s.y - this.prev[1], s.z - this.prev[2]);
    this.prev = [s.x, s.y, s.z];
    const moving = moved / (dtMs / 1000) > 0.05;
    const moveState = s.mode === "air" || s.mode === "glide" || s.mode === "slide" || s.mode === "skid" || s.dashT > 0;
    const interval = 1000 / (moveState ? N.SEND.moveHz : N.SEND.groundHz);
    const since = now - this.lastSend;
    if (since < N.SEND.eventGapMs) return;
    const send =
      this.firstPose || this.pending.length > 0 || (moving && since >= interval) || (!moving && this.lastSentMoving);
    if (!send) return;
    this.sendPose(room, now + this.offset - epoch);
    this.lastSentMoving = moving;

    if (now >= this.nextSlow) {
      this.nextSlow = now + 20_000 + this.rand() * 40_000;
      room.send(N.MSG.slow, { held: this.rand() < 0.5 ? "" : "rod:basic-rod" });
    }
  }

  private sendPose(room: Room, t: number): void {
    const s = this.sim;
    const move = s.mode === "air" ? (s.vy > 0 ? "Air" : "Fall") : s.mode === "glide" ? "Glide" : s.mode === "skid" ? "Skid" : s.mode === "slide" ? "Slide" : s.crouch ? (Math.hypot(s.vx, s.vz) > 0.1 ? "CrouchWalk" : "CrouchIdle") : null;
    const pose: N.Pose = {
      seq: (this.seq = (this.seq + 1) & 0xffff),
      t,
      x: s.x,
      y: s.y,
      z: s.z,
      vx: s.vx,
      vy: s.vy,
      vz: s.vz,
      yaw: s.facing,
      move: N.moveIndex(move),
      air: s.mode === "air" ? 0.5 : 0,
      leaf: 0,
      lift: 0,
      flags: this.firstPose ? N.PACKET_FLAG.teleport : 0,
      ev: this.pending,
    };
    const packet = N.encodePose(pose, []);
    room.send(N.MSG.pose, packet);
    this.stats.poses++;
    this.stats.events += this.pending.length / 3;
    this.stats.last = { x: packet[2] as number, y: packet[3] as number, z: packet[4] as number };
    this.pending = [];
    this.firstPose = false;
    this.lastSend = Date.now();
  }

  /** Stop where you stand: the sender's stop packet goes out, then nothing. */
  stop(): void {
    this.still = true;
  }

  leave(): Promise<unknown> {
    this.stopped = true;
    return this.room ? this.room.leave().catch(() => {}) : Promise.resolve();
  }

  private input(now: number): MoveInput {
    const s = this.sim;
    if (this.still) return NO_INPUT;
    if (now < this.idleUntil) return NO_INPUT;
    const dx = this.goal[0] - s.x, dz = this.goal[1] - s.z, d = Math.hypot(dx, dz);
    if (d < 1) {
      // Arrived: idle a while, sometimes with an emote, then pick the next spot and pace.
      this.idleUntil = now + 1000 + this.rand() * 3000;
      if (this.rand() < 0.3 && this.pending.length < N.EV_MAX * 3) this.pending.push(N.EV.play, EMOTES[Math.floor(this.rand() * EMOTES.length)], 0);
      this.goal = this.pick();
      this.sprint = this.rand() < 0.45;
      return NO_INPUT;
    }
    const speed = Math.hypot(s.vx, s.vz);
    if (this.sprint && now >= this.nextDash && d > 6) {
      this.nextDash = now + 2000 + this.rand() * 4000;
      this.dashPressed = true;
    }
    if (now >= this.nextJump && d > 3) {
      this.nextJump = now + 2500 + this.rand() * 5000;
      this.jumpPressed = true;
    }
    if (this.sprint && speed > MOVE_TUNING.walkSpeed * 1.2 && this.slideUntil < now && this.rand() < 0.002) this.slideUntil = now + 400 + this.rand() * 500;
    const k = Math.min(1, d / 2) / d;
    return {
      x: dx * k,
      z: dz * k,
      sprint: this.sprint,
      sneak: now < this.slideUntil,
      jump: this.jumpPressed,
      jumpPressed: this.jumpPressed,
      dashPressed: this.dashPressed,
    };
  }
}

/** Starts `a.n` bots and runs their frames until stopped. */
export async function runBots(a: Args) {
  const bots = Array.from({ length: a.n }, (_, i) => new Bot(`${a.prefix}-${String(i + 1).padStart(2, "0")}`, a));
  for (const b of bots) {
    await b.connect().catch((e: { code?: number; message?: string }) => console.error(`${b.name}: join refused ${e.code ?? ""} ${e.message ?? ""}`));
  }
  let last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now(), dt = now - last;
    last = now;
    for (const b of bots) b.frame(dt, now);
  }, 1000 / 60);
  const status = a.quiet
    ? undefined
    : setInterval(() => {
        const live = bots.filter((b) => b.room?.connection?.isOpen);
        const rooms = new Set(live.map((b) => b.room!.roomId));
        console.log(`${live.length}/${bots.length} bots in ${rooms.size} room(s), ${bots.reduce((n, b) => n + b.stats.poses, 0)} poses sent`);
      }, 10_000);
  const stop = async () => {
    clearInterval(timer);
    if (status) clearInterval(status);
    await Promise.all(bots.map((b) => b.leave()));
  };
  return { bots, stop };
}

const isMain = process.argv[1]?.endsWith("bots.ts") || process.argv[1]?.endsWith("bots.mjs");
if (isMain) {
  const a = parseArgs(process.argv.slice(2));
  const { bots, stop } = await runBots(a);
  const quit = async () => {
    await stop();
    process.exit(0);
  };
  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
  if (a.seconds > 0) {
    setTimeout(async () => {
      for (const b of bots) b.stop();
      await new Promise((r) => setTimeout(r, 1500));
      if (a.report) console.log(JSON.stringify({ type: "report", bots: bots.map((b) => b.stats) }));
      else await quit();
    }, a.seconds * 1000);
  }
}
