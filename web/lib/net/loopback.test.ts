import { describe, expect, it } from "vitest";
import { AREAS, FLAG, createPose, encodePose, inAreaBounds, type RosterEntry } from "./protocol";
import { createRemoteSample, type RemoteChange } from "./types";
import { MAX_BOTS, createLoopback, loopbackFromSearch } from "./loopback";
import { parseNetsim } from "./interp";

/** A loopback on a hand-driven clock. */
function manual(bots: number, o: { seed?: number; netsim?: ReturnType<typeof parseNetsim> } = {}) {
  let now = 0;
  const lb = createLoopback({ bots, seed: o.seed ?? 1, netsim: o.netsim ?? null, clock: () => now, timer: false });
  const run = (ms: number, frame = 1000 / 60, each?: () => void) => {
    for (const end = now + ms; now < end;) { now = Math.min(end, now + frame); lb.advance(); each?.(); }
  };
  return { lb, run, at: () => now };
}

describe("?bots=N", () => {
  it("parses the count (and an optional seed)", () => {
    expect(loopbackFromSearch("?bots=24")).toEqual({ bots: 24, seed: 1 });
    expect(loopbackFromSearch("?bots=0&seed=9")).toEqual({ bots: 0, seed: 9 });
    for (const s of ["", "?bots=", "?bots=-1", "?bots=2.5", `?bots=${MAX_BOTS + 1}`, "?bots=x"]) expect(loopbackFromSearch(s), s).toBeNull();
  });
});

describe("the loopback NetSource", () => {
  it("is off until started, joined while started, off again after leave; listeners hear each change", () => {
    const { lb } = manual(4);
    let heard = 0;
    const off = lb.subscribe(() => heard++);
    expect(lb.status()).toEqual({ kind: "off" });
    lb.start("village");
    expect(lb.status()).toEqual({ kind: "joined", shard: 1 });
    expect(lb.status()).toBe(lb.status()); // a stable snapshot
    lb.leave();
    expect(lb.status()).toEqual({ kind: "off" });
    expect(lb.remotes.size).toBe(0);
    off();
    lb.start("village");
    expect(heard).toBe(2);
  });

  it("has everyone in the roster, you included in your area while joined, as one array until it changes", () => {
    const { lb, run } = manual(12);
    expect(lb.roster().length).toBe(12);
    lb.start("cafe");
    const r1 = lb.roster();
    expect(r1.length).toBe(13);
    const me = r1.find(e => e.uid === "local")!;
    expect(me).toMatchObject({ name: "You", area: AREAS.indexOf("cafe") });
    run(100);
    expect(lb.roster()).toBe(r1);
    lb.setArea("hq");
    expect(lb.roster()).not.toBe(r1);
    expect(lb.roster().find(e => e.uid === "local")!.area).toBe(AREAS.indexOf("hq"));
    const bots = lb.roster().filter((e: RosterEntry) => e.uid !== "local");
    expect(bots.some(e => e.flags & FLAG.mobile)).toBe(true);
    expect(bots.some(e => e.badge === 1) && bots.some(e => e.badge === 0)).toBe(true);
    for (const e of bots) expect(e.name).toMatch(/^[A-Za-z]+ \d\d$/);
  });

  it("shows the bots in your area and nobody in a private one", () => {
    const { lb, run } = manual(24);
    const changes: [RemoteChange, number][] = [];
    lb.remotes.subscribe((c, e) => changes.push([c, e.sid]));
    lb.start("village");
    run(500);
    const village = lb.remotes.size, cafe = lb.bots.filter(b => b.card.area === "cafe").length;
    expect(village).toBe(24 - cafe);
    for (let i = 0; i < lb.remotes.size; i++) expect(lb.remotes.at(i).player.area).toBe("village");
    lb.setArea("cafe");
    expect(lb.remotes.size).toBe(cafe);
    lb.setArea("ruins");
    expect(lb.remotes.size).toBe(0);
    lb.setArea("village");
    expect(lb.remotes.size).toBe(village);
    expect(changes.filter(c => c[0] === "add").length).toBe(village * 2 + cafe);
    expect(lb.roster().length).toBe(25); // the roster keeps everyone wherever they are
  });

  it("delivers motion through the codec and the interpolation ring: positions in the village, events, slow state", () => {
    const { lb, run, at } = manual(24, { seed: 3 });
    lb.start("village");
    const out = createRemoteSample();
    const kinds = new Set<string>();
    let snaps = 0, frames = 0;
    run(40_000, 1000 / 60, () => {
      for (let i = 0; i < lb.remotes.size; i++) {
        const s = lb.remotes.at(i).sample(at(), out);
        frames++;
        expect(Number.isFinite(s.x + s.y + s.z + s.yaw)).toBe(true);
        expect(inAreaBounds("village", s.x, s.y, s.z)).toBe(true);
        for (let k = 0; k < s.eventCount; k++) kinds.add(s.events[k].kind);
        if (s.snapped) snaps++;
      }
    });
    for (const k of ["play", "jump", "land", "dash", "stop"]) expect(kinds, k).toContain(k);
    expect(snaps).toBeGreaterThanOrEqual(lb.remotes.size); // each one's first frame, and the teleports
    expect(snaps).toBeLessThan(frames / 100);
    // A resting phone sits with its seat's pose and claim.
    const phone = Array.from({ length: lb.remotes.size }, (_, i) => lb.remotes.at(i)).find(e => e.player.mobile);
    expect(phone?.player).toMatchObject({ pose: "Sit", mobile: true });
    expect(phone?.player.seat).toMatch(/^bench:/);
    expect(phone!.sample(at(), out).pose).toBe("Sit");
  });

  it("is the same world for the same seed, however the time is chunked", () => {
    const a = manual(10, { seed: 5 }), b = manual(10, { seed: 5 });
    a.lb.start("village"); b.lb.start("village");
    a.run(20_000, 10);
    b.run(20_000, 47);
    expect(b.lb.bots.map(x => x.position)).toEqual(a.lb.bots.map(x => x.position));
  });

  it("with netsim, what arrives is late: the render lag grows by the latency", () => {
    const plain = manual(6), slow = manual(6, { netsim: parseNetsim("?netsim=lat:120,jit:60,loss:0.03") });
    for (const m of [plain, slow]) { m.lb.start("village"); m.run(8000, 1000 / 60, () => { for (let i = 0; i < m.lb.remotes.size; i++) m.lb.remotes.at(i).sample(m.at(), createRemoteSample()); }); }
    const lag = (m: typeof plain) => { let s = 0; for (let i = 0; i < m.lb.remotes.size; i++) s += m.lb.remotes.at(i).renderLag; return s / m.lb.remotes.size; };
    expect(lag(slow) - lag(plain)).toBeGreaterThan(100);
  });

  it("takes your pose and slow state only while joined; an area in `s` moves your view", () => {
    const { lb } = manual(8);
    const packet = encodePose({ ...createPose(), t: 10, x: 1 });
    lb.sendPose(packet);
    lb.sendSlow({ held: "" });
    expect(lb.sent).toEqual({ poses: 0, slow: [] });
    lb.start("village");
    lb.sendPose(packet);
    lb.sendPose([-1, 0, 0]); // malformed: dropped
    lb.sendSlow({ held: "rod:rod_flimsy" });
    lb.sendSlow({ held: "not a held item" });
    expect(lb.sent.poses).toBe(1);
    expect(lb.sent.slow).toEqual([{ held: "rod:rod_flimsy" }]);
    lb.sendSlow({ area: AREAS.indexOf("ruins") });
    expect(lb.remotes.size).toBe(0);
  });

  it("the registry is walked with at(i): the same entries, nothing new, while nobody comes or goes", () => {
    const { lb, run, at } = manual(16);
    lb.start("village");
    run(1000);
    const entries = Array.from({ length: lb.remotes.size }, (_, i) => lb.remotes.at(i)), out = createRemoteSample(), events = out.events;
    run(5000, 1000 / 60, () => { for (let i = 0; i < lb.remotes.size; i++) expect(lb.remotes.at(i).sample(at(), out)).toBe(out); });
    expect(Array.from({ length: lb.remotes.size }, (_, i) => lb.remotes.at(i))).toEqual(entries);
    expect(out.events).toBe(events);
  });
});
