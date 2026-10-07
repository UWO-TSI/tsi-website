import { describe, expect, it } from "vitest";
import { ACT_CLIPS, contactDelay, hitDelays, landAt } from "./actTiming";
import { CLIP_BY_NAME } from "./character/look";

describe("a gathering act's contact frame", () => {
  it("reads each act clip's contact from the clip catalogue (build_clips.py hits)", () => {
    for (const clip of ACT_CLIPS) {
      const info = CLIP_BY_NAME.get(clip)!;
      expect(info, clip).toBeTruthy();
      expect(info.hits?.length, clip).toBeGreaterThan(0);
      expect(contactDelay(clip)).toBeCloseTo(info.hits![0] * info.length * 1000, 6);
    }
    // The grab comes after the reach starts and well before the clip ends.
    expect(contactDelay("Pickup")).toBeGreaterThan(300);
    expect(contactDelay("Pickup")).toBeLessThan(CLIP_BY_NAME.get("Pickup")!.length * 1000 * 0.6);
  });

  it("gives every hammer blow and every push of a shake its own moment, in order", () => {
    const craft = hitDelays("Craft"), shake = hitDelays("Shake");
    expect(craft).toHaveLength(3);
    expect(shake).toHaveLength(3);
    for (const list of [craft, shake]) for (let i = 1; i < list.length; i++) expect(list[i]).toBeGreaterThan(list[i - 1]);
  });

  it("plays faster or slower with the clip's rate", () => {
    expect(contactDelay("Dig", 2)).toBeCloseTo(contactDelay("Dig") / 2, 6);
  });

  it("never takes a node before the clip makes contact, even when the server answered first", () => {
    expect(landAt(440, { ok: true, at: 120 })).toBe(440);
  });

  it("never takes it before the server has said yes, even when the clip made contact long ago", () => {
    expect(landAt(440, null)).toBeNull();
    expect(landAt(440, { ok: true, at: 900 })).toBe(900);
  });

  it("never takes it at all when the server refused (a full bag): the node stays where it is", () => {
    expect(landAt(440, { ok: false, at: 120 })).toBeNull();
    expect(landAt(440, { ok: false, at: 900 })).toBeNull();
  });
});
