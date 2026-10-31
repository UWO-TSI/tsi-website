import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readGlb } from "@/lib/game/perf/glbStats";
import { crossfade, isLoop } from "@/lib/game/character/clips";
import { VB_CLIPS, VB_CLIPS_URL, type VbClipInfo } from "./clips";

type Anim = { name: string; samplers: { input: number }[] };
const glb = readGlb(readFileSync(join(__dirname, "../../../public", VB_CLIPS_URL)));
const json = glb.json as unknown as { animations: Anim[]; accessors: { max?: number[] }[] };
const length = (a: Anim) => Math.max(...a.samplers.map(s => json.accessors[s.input].max?.[0] ?? 0));

describe("volleyball clips contract", () => {
  it("vb_clips.glb holds exactly the contract's clips, each at its duration", () => {
    expect(json.animations.map(a => a.name).sort()).toEqual(Object.keys(VB_CLIPS).sort());
    for (const a of json.animations) expect(length(a), a.name).toBeCloseTo(VB_CLIPS[a.name as keyof typeof VB_CLIPS].duration, 2);
  });

  it("every timing falls inside its clip, in order", () => {
    for (const [name, c] of Object.entries(VB_CLIPS) as [string, VbClipInfo][]) {
      for (const t of [c.contact, c.takeoff, c.apex, c.land, c.down, c.up]) {
        if (t === undefined) continue;
        expect(t, name).toBeGreaterThanOrEqual(0);
        expect(t, name).toBeLessThanOrEqual(c.duration);
      }
      if (c.takeoff !== undefined && c.land !== undefined) expect(c.takeoff, name).toBeLessThan(c.land);
      if (c.down !== undefined && c.up !== undefined) expect(c.down, name).toBeLessThan(c.up);
      if (c.contact !== undefined) expect(c.contactPoint, name).toHaveLength(3);
    }
  });

  it("the character's state machine knows them: loops, one-shots and a fast cut into a touch", () => {
    expect(isLoop("vb_ready")).toBe(true);
    expect(isLoop("vb_spectate")).toBe(true);
    expect(isLoop("vb_bump")).toBe(false);
    expect(crossfade("vb_ready", "vb_spike_hit")).toBeLessThanOrEqual(0.06);
  });
});
