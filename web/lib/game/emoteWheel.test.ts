import { describe, expect, it } from "vitest";
import { CLIP_BY_NAME } from "@/lib/game/character/look";
import { isLoop } from "@/lib/game/character/clips";
import { EMOTE_CLIP_NAMES } from "@/lib/net/protocol";
import { DANCE_RING, EMOTE_RING, TAP_MS, closeWheel, createWheel, flipRing, holdShown, openForClick, pickAt, playChoice, pressWheel, releaseWheel, ringOf } from "./emoteWheel";

describe("the emote wheel's rings (specs/v1-drop.md §3)", () => {
  it("has the decided main ring and eight dances, every one a clip the rig has", () => {
    expect(EMOTE_RING.map(e => e.id)).toEqual(["wave", "cheer", "clap", "laugh", "sit", "sleep", "bow", "shrug"]);
    expect(DANCE_RING.map(e => e.name)).toEqual(["Happy bounce", "Little spin", "Shuffle", "Sway", "Wiggle", "Goofy flail", "Robot", "Sprinkler"]);
    for (const e of [...EMOTE_RING, ...DANCE_RING]) expect(CLIP_BY_NAME.has(e.clip), e.clip).toBe(true);
  });
  it("dances loop and travel as emotes; sit and sleep are held poses, not one-shots", () => {
    for (const d of DANCE_RING) {
      expect(isLoop(d.clip), d.clip).toBe(true);
      expect(EMOTE_CLIP_NAMES as readonly string[]).toContain(d.clip);
    }
    for (const e of EMOTE_RING) if (!e.held) expect(EMOTE_CLIP_NAMES as readonly string[], e.clip).toContain(e.clip);
    expect(EMOTE_RING.filter(e => e.held).map(e => e.id)).toEqual(["sit", "sleep"]);
  });
});

describe("the emote wheel's input: hold G, release to pick, tap repeats", () => {
  it("opens the ring only after a hold, and a release on a petal plays it", () => {
    let w = pressWheel(createWheel(), 1000);
    expect(holdShown(w, 1000 + TAP_MS - 1)).toBe(false);
    expect(holdShown(w, 1000 + TAP_MS)).toBe(true);
    w = pickAt(w, 2);
    const r = releaseWheel(w, 1000 + TAP_MS + 300);
    expect(r.act).toEqual({ kind: "play", entry: EMOTE_RING[2] });
    expect(r.state.open).toBe(false);
    expect(r.state.last?.id).toBe("clap");
  });
  it("a quick tap repeats the last emote, and does nothing to the ring", () => {
    let w = releaseWheel(pickAt(pressWheel(createWheel(), 0), 0), 500).state;
    const tap = releaseWheel(pressWheel(w, 2000), 2000 + TAP_MS - 20);
    expect(tap.act).toEqual({ kind: "play", entry: EMOTE_RING[0] });
    expect(tap.state.open).toBe(false);
    w = tap.state;
    expect(w.last?.id).toBe("wave");
  });
  it("a tap with nothing to repeat leaves the ring open for a click", () => {
    const r = releaseWheel(pressWheel(createWheel(), 0), 60);
    expect(r.act.kind).toBe("none");
    expect(r.state.open).toBe("click");
    const picked = playChoice(pickAt(r.state, 5));
    expect(picked.act).toEqual({ kind: "play", entry: EMOTE_RING[5] });
    // The key again closes it; so does the phone's button opening it the same way.
    expect(pressWheel(r.state, 1200).open).toBe(false);
    expect(openForClick(createWheel()).open).toBe("click");
  });
  it("letting go over the centre (or nothing) after the ring showed plays nothing", () => {
    const r = releaseWheel(pressWheel(createWheel(), 0), TAP_MS + 400);
    expect(r.act.kind).toBe("none");
    expect(r.state.open).toBe(false);
  });
  it("the centre flips the ring to the dances and back; a dance picked is remembered as the last", () => {
    let w = flipRing(pressWheel(createWheel(), 0));
    expect(w.ring).toBe("dances");
    expect(ringOf(w)).toBe(DANCE_RING);
    expect(w.choice).toBeNull();
    w = pickAt(w, 6);
    const r = releaseWheel(w, TAP_MS + 500);
    expect(r.act).toEqual({ kind: "play", entry: DANCE_RING[6] });
    expect(r.state.last?.clip).toBe("DanceRobot");
    // It opens on the ring you used last.
    expect(pressWheel(r.state, 9000).ring).toBe("dances");
    expect(flipRing(pressWheel(r.state, 9000)).ring).toBe("emotes");
  });
  it("Esc closes without playing; picks outside the ring are ignored", () => {
    const w = pickAt(pressWheel(createWheel(), 0), 3);
    expect(closeWheel(w).open).toBe(false);
    expect(pickAt(w, 8).choice).toBeNull();
    expect(pickAt(w, -1).choice).toBeNull();
  });
  it("a release with the wheel already closed does nothing (a key up after Esc)", () => {
    const r = releaseWheel(createWheel(), 100);
    expect(r.act.kind).toBe("none");
  });
});
