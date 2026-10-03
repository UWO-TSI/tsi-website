// Soak (specs/multiplayer.md §7), run by hand, never in the default suite:
//
//   cd realtime && NODE_OPTIONS=--expose-gc npm run soak -- --bots 40 --minutes 10 --kill-every 150
//
// The server runs in this process (so the measurements are its own); the bots run in a
// child process (scripts/bots.ts, real SDK clients with dev tokens). Every --kill-every
// seconds, 10 random sockets are cut server-side (a network drop: 1006 on both ends) and
// each must be back inside 25 s with its player kept. Reported: event-loop delay p99
// (target < 20 ms), heap growth after warm-up (< 10%), messages in per second, bytes out
// per client per second, strikes (0 for honest bots), and at the end each bot's last pose
// against the server's state (within 1 cm).
import { spawn } from "node:child_process";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { matchMaker, Room } from "@colyseus/core";
import { listen } from "@colyseus/tools";
import { WebSocketClient } from "@colyseus/ws-transport";
import * as N from "@net/protocol";
import { createApp } from "../src/app.config";
import { devUid } from "../src/auth/verify";
import { parseEnv } from "../src/env";

const arg = (k: string, d: number) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
};
const BOTS = arg("bots", 40);
const MINUTES = arg("minutes", 30);
const KILL_EVERY_S = arg("kill-every", 300);
const PORT = arg("port", 2567);
const WARMUP_S = 60;
const KILLS = 10;
const RECONNECT_DEADLINE_MS = 25_000;
const gc = (globalThis as { gc?: () => void }).gc;

type Line = Record<string, unknown>;
const out = (o: Line) => console.log(JSON.stringify({ at: new Date().toISOString(), ...o }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Metering, soak only ─────────────────────────────────────────────
let framesIn = 0, bytesIn = 0, bytesOut = 0;
type OnMessage = (this: unknown, client: unknown, buffer: Buffer) => void;
const proto = Room.prototype as unknown as { _onMessage: OnMessage };
const onMessage = proto._onMessage;
proto._onMessage = function (client, buffer) {
  framesIn++;
  bytesIn += buffer?.byteLength ?? 0;
  return onMessage.call(this, client, buffer);
};
const raw = WebSocketClient.prototype.raw;
WebSocketClient.prototype.raw = function (data: Uint8Array | Buffer, ...rest: unknown[]) {
  bytesOut += data.byteLength;
  return (raw as (...a: unknown[]) => void).call(this, data, ...rest);
};

type IslandInternals = { clients: { get(id: string): { ref: { terminate(): void } } | undefined } & Iterable<{ sessionId: string; ref: { terminate(): void } }>; state: { players: Map<string, { uid: string; x: number; y: number; z: number }> & { forEach: (fn: (p: { uid: string; x: number; y: number; z: number }, k: string) => void) => void; get(k: string): unknown } }; sessions: Map<string, { track: { strikes: number } }> };
const islands = async (): Promise<IslandInternals[]> =>
  (await matchMaker.query({ name: N.ROOM_NAME })).map((r) => matchMaker.getLocalRoomById(r.roomId) as unknown as IslandInternals).filter(Boolean);

async function main() {
  const logs: Line[] = [];
  await listen(
    createApp({
      env: parseEnv({ NODE_ENV: "development", DEV_AUTH: "1", PORT: String(PORT) }),
      kickForMovement: true,
      log: (event, fields) => {
        logs.push({ event, ...fields });
        out({ event, ...fields });
      },
    }),
    PORT,
  );
  out({ event: "soak-start", bots: BOTS, minutes: MINUTES, killEvery: KILL_EVERY_S, gc: !!gc });

  const botsPath = fileURLToPath(new URL("../scripts/bots.ts", import.meta.url));
  const child = spawn("npx", ["tsx", botsPath, "--n", String(BOTS), "--url", `ws://127.0.0.1:${PORT}`, "--seconds", String(MINUTES * 60), "--report", "--quiet", "--radius", "14"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: ["ignore", "pipe", "inherit"],
  });
  type Report = { bots: { name: string; last: { x: number; y: number; z: number } | null; drops: number; reconnects: number; maxReconnectMs: number; left: number | null }[] };
  const got: { report: Report | null } = { report: null };
  let buf = "";
  child.stdout.on("data", (d: Buffer) => {
    buf += d.toString();
    for (let i = buf.indexOf("\n"); i >= 0; i = buf.indexOf("\n")) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      try {
        const j = JSON.parse(line);
        if (j.type === "report") got.report = j;
      } catch {
        if (line.trim()) out({ event: "bots", line });
      }
    }
  });

  // Strikes: any session ever holding one (they decay 1 per 10 s; sampled every second).
  const struck = new Set<string>();
  let maxStrikes = 0;
  const strikeTimer = setInterval(async () => {
    for (const r of await islands())
      for (const [k, s] of r.sessions) {
        if (s.track.strikes > 0) struck.add(k);
        maxStrikes = Math.max(maxStrikes, s.track.strikes);
      }
  }, 1000);

  // Warm-up, then the measured window.
  await sleep(WARMUP_S * 1000);
  gc?.();
  const heap0 = process.memoryUsage().heapUsed;
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  const t0 = Date.now(), f0 = framesIn, bi0 = bytesIn, bo0 = bytesOut;
  let clientSeconds = 0;
  const ccuTimer = setInterval(() => (clientSeconds += matchMaker.stats.local.ccu), 1000);
  const rooms0 = await islands();
  out({ event: "warm", rooms: rooms0.length, clients: matchMaker.stats.local.ccu, heapMB: +(heap0 / 2 ** 20).toFixed(1) });

  // Per-minute lines and the kill rounds.
  const kills: { ok: number; failed: number; worstMs: number } = { ok: 0, failed: 0, worstMs: 0 };
  const minuteTimer = setInterval(() => {
    out({ event: "minute", loopP99ms: +(loop.percentile(99) / 1e6).toFixed(2), heapMB: +(process.memoryUsage().heapUsed / 2 ** 20).toFixed(1), clients: matchMaker.stats.local.ccu, framesPerS: Math.round((framesIn - f0) / ((Date.now() - t0) / 1000)) });
  }, 60_000);
  const end = t0 + (MINUTES * 60 - WARMUP_S) * 1000;
  let nextKill = Date.now() + KILL_EVERY_S * 1000 - WARMUP_S * 1000;
  while (Date.now() < end - 30_000) {
    await sleep(Math.max(0, Math.min(nextKill, end - 30_000) - Date.now()));
    if (Date.now() >= end - 30_000) break;
    nextKill += KILL_EVERY_S * 1000;
    const live: { room: IslandInternals; sessionId: string }[] = [];
    for (const room of await islands()) for (const c of room.clients) live.push({ room, sessionId: c.sessionId });
    const victims = live.sort(() => Math.random() - 0.5).slice(0, KILLS);
    const cut = Date.now();
    for (const v of victims) v.room.clients.get(v.sessionId)?.ref.terminate();
    const back = await Promise.all(
      victims.map(async (v) => {
        while (Date.now() - cut < RECONNECT_DEADLINE_MS) {
          await sleep(100);
          if (v.room.clients.get(v.sessionId) && v.room.state.players.get(v.sessionId)) return Date.now() - cut;
        }
        return -1;
      }),
    );
    for (const ms of back) ms >= 0 ? (kills.ok++, (kills.worstMs = Math.max(kills.worstMs, ms))) : kills.failed++;
    out({ event: "kill-round", cut: victims.length, back: back.filter((m) => m >= 0).length, worstMs: Math.max(...back) });
  }

  // The bots stop at MINUTES; wait for their report, then hold the state against it.
  while (!got.report) await sleep(250);
  const report = got.report;
  await sleep(1000);
  clearInterval(minuteTimer);
  clearInterval(ccuTimer);
  clearInterval(strikeTimer);
  loop.disable();
  const seconds = (Date.now() - t0) / 1000;
  gc?.();
  const heap1 = process.memoryUsage().heapUsed;

  const byUid = new Map<string, { x: number; y: number; z: number }>();
  for (const room of await islands()) room.state.players.forEach((p) => byUid.set(p.uid, { x: p.x, y: p.y, z: p.z }));
  let matched = 0, mismatched = 0, missing = 0;
  for (const b of report.bots) {
    const s = byUid.get(devUid(b.name));
    if (!s || !b.last) {
      missing++;
      continue;
    }
    if (Math.abs(s.x - b.last.x) <= 1 && Math.abs(s.y - b.last.y) <= 1 && Math.abs(s.z - b.last.z) <= 1) matched++;
    else mismatched++;
  }

  const summary = {
    event: "soak-summary",
    bots: BOTS,
    minutes: MINUTES,
    measuredSeconds: Math.round(seconds),
    rooms: (await islands()).length,
    loopP50ms: +(loop.percentile(50) / 1e6).toFixed(2),
    loopP99ms: +(loop.percentile(99) / 1e6).toFixed(2),
    loopMaxMs: +(loop.max / 1e6).toFixed(2),
    heapStartMB: +(heap0 / 2 ** 20).toFixed(1),
    heapEndMB: +(heap1 / 2 ** 20).toFixed(1),
    heapGrowthPct: +(((heap1 - heap0) / heap0) * 100).toFixed(1),
    messagesInPerS: Math.round((framesIn - f0) / seconds),
    bytesInPerS: Math.round((bytesIn - bi0) / seconds),
    bytesOutPerClientPerS: Math.round((bytesOut - bo0) / Math.max(1, clientSeconds)),
    strikes: { sessions: struck.size, max: +maxStrikes.toFixed(2) },
    kicks: logs.filter((l) => l.event === "kick").length,
    errors: logs.filter((l) => l.event === "error").length,
    kills,
    botDrops: report.bots.reduce((n, b) => n + b.drops, 0),
    botReconnects: report.bots.reduce((n, b) => n + b.reconnects, 0),
    botsLeft: report.bots.filter((b) => b.left !== null).map((b) => `${b.name}:${b.left}`),
    finalState: { matched, mismatched, missing },
  };
  out(summary);
  child.kill("SIGTERM");
  await sleep(1500);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
