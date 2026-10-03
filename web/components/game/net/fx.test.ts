import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ParticlePool } from "@/lib/game/fx/particles";
import type { EvKind } from "@/lib/net/protocol";
import { createRemoteSample, type RemoteSample } from "@/lib/net/types";
import { REMOTE_JUICE, createFxState, moveAt, remoteDashTrail, remoteJuice, type FxGround } from "./fx";

const ground: FxGround = { surface: () => 1, wet: () => false };
const sample = (o: Partial<RemoteSample> = {}) => Object.assign(createRemoteSample(), { x: 2, y: 0, z: 3, vx: 4, vz: 0, ...o });
/** Particles one event throws on a fresh pool. */
function thrown(kind: EvKind, value = 0, o: Partial<RemoteSample> = {}, prev: EvKind | null = null, next: EvKind | null = null) {
  const pool = new ParticlePool(256);
  remoteJuice(pool, ground, createFxState(), kind, value, sample(o), 0, 0, prev, next);
  return pool.alive;
}

describe("a remote's movement juice (spec §5.6)", () => {
  it("throws the take-off, the landing by its drop, the slide's spray, the leaf, the splash and the hands on a ledge", () => {
    for (const kind of ["jump", "hop", "long", "dashjump", "slidejump", "dashslide", "landslide", "glide", "furl"] as const) expect(thrown(kind), kind).toBeGreaterThan(0);
    expect(thrown("land", 1)).toBeGreaterThan(0);
    expect(thrown("land", 2.4)).toBeGreaterThan(thrown("land", 1));
    expect(thrown("splash", 1.2)).toBeGreaterThan(0);
    expect(thrown("mantle", 1.5)).toBeGreaterThan(0);
  });

  it("throws nothing for a lip too small to feel, a landing that launches a hop, or a furl a landing follows", () => {
    expect(thrown("land", 0.1)).toBe(0);
    expect(thrown("land", 1, {}, null, "hop")).toBe(0);
    expect(thrown("furl", 0, {}, null, "land")).toBe(0);
    expect(thrown("land", 0.1, {}, "furl")).toBeGreaterThan(0); // out of a glide: the leaf's soft set-down
  });

  it("finds a move's neighbours past the clips journaled between them (a landing's hop, a furl before a landing)", () => {
    const s = createRemoteSample();
    (["land", "play", "ghost", "hop"] as const).forEach((kind, i) => Object.assign(s.events[i], { kind, value: kind === "play" ? "Jump" : 0, t: 0 }));
    s.eventCount = 4;
    expect(moveAt(s, 1, 1)).toBe("hop");
    expect(moveAt(s, 2, -1)).toBe("land");
    expect(moveAt(s, 4, 1)).toBeNull();
    expect(moveAt(s, -1, -1)).toBeNull();
  });

  it("leaves the rest of the kit's moves alone", () => {
    for (const kind of ["slide", "stand", "roll", "skid", "bonk", "respawn"] as const) expect(thrown(kind, 1), kind).toBe(0);
  });

  it("is lighter than your own: 0.7 of it", () => {
    expect(REMOTE_JUICE).toBe(0.7);
    const pool = new ParticlePool(256), full = new ParticlePool(256);
    remoteJuice(pool, ground, createFxState(), "land", 2.4, sample(), 0, 0, null, null);
    remoteJuice(full, ground, createFxState(), "land", 2.4, sample(), 0, 0, null, null, 1);
    expect(pool.alive).toBeLessThanOrEqual(full.alive);
  });

  it("streaks after a dash while it lasts, and stops at a teleport", () => {
    const pool = new ParticlePool(256), f = createFxState(), s = sample({ vx: 18 });
    remoteJuice(pool, ground, f, "dash", 0, s, 0, 0, null, null);
    const burst = pool.alive;
    expect(burst).toBeGreaterThan(2);
    for (let i = 0; i < 6; i++) remoteDashTrail(pool, f, s, 0, 1 / 60);
    expect(pool.alive).toBeGreaterThan(burst);
    for (let i = 0; i < 30; i++) remoteDashTrail(pool, f, s, 0, 1 / 60);
    expect(f.dashT).toBeLessThanOrEqual(0);
    remoteJuice(pool, ground, f, "dash", 0, s, 0, 0, null, null);
    remoteDashTrail(pool, f, sample({ snapped: true }), 0, 1 / 60);
    expect(f.dashT).toBe(0);
  });

  it("never plays a sound, kicks the camera, flashes or slows time for someone else's move", () => {
    const src = ["fx.ts", "drive.ts", "RemoteAvatars.tsx"].map(f => readFileSync(new URL(`./${f}`, import.meta.url), "utf8")).join("\n");
    expect(src).not.toMatch(/AudioManager|playSFX|shakeCamera|applyFov|juiceFovOffset|slowMotion|useFlash|flash\(/);
  });
});
