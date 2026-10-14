import { describe, expect, it } from "vitest";
import { BUBBLE_MS, ChatStore } from "@/lib/net/chat";
import type { RemoteEntry, RemotePlayer } from "@/lib/net/types";
import { createRig } from "./drive";
import { FULL, HIDDEN } from "./lod";
import { driveTalk } from "./talk";

const UID = "22222222-2222-4222-8222-222222222222";
const player = { uid: UID, name: "Ann" } as RemotePlayer;
function setup() {
  let now = 1_000_000;
  const chat = new ChatStore(() => now), r = createRig({ sid: 4, player, sample: (_n, o) => o } as RemoteEntry);
  r.lod.tier = FULL;
  const say = (text: string) => chat.receive({ id: `00000000-0000-4000-8000-00000000000${text.length % 10}`, sid: 4, uid: UID, name: "Ann", area: 0, text, t: 1 });
  return { chat, r, say, step: (ms: number) => { now += ms; } };
}

describe("a remote's talking while their bubble shows (v1 chat)", () => {
  it("moves the mouth for the line, gestures (an upper-body Chat), hops a little, and stops with the bubble", () => {
    const { chat, r, say, step } = setup();
    say("hello there everyone");
    let gestures = 0, hopped = 0;
    for (let ms = 0; ms <= BUBBLE_MS + 500; ms += 16) {
      r.motion.lift = 0; r.motion.upper = null;
      driveTalk(r, chat);
      if (ms === 0) expect(r.motion.talk).toBeGreaterThan(1);
      if (r.motion.upper === "Chat") gestures++;
      if (r.motion.lift > 0) hopped++;
      step(16);
    }
    expect(gestures).toBeGreaterThanOrEqual(2);
    expect(hopped).toBeGreaterThan(5);
    r.motion.lift = 0; r.motion.upper = null;
    driveTalk(r, chat);
    expect(r.motion.lift).toBe(0);
    expect(r.motion.upper).toBeNull();
  });

  it("a new line starts the mouth again; sitting, flying or hidden, no gestures or hops", () => {
    const { chat, r, say, step } = setup();
    say("one");
    driveTalk(r, chat);
    r.motion.talk = 0;
    step(1500);
    say("two, a little longer");
    driveTalk(r, chat);
    expect(r.motion.talk).toBeGreaterThan(1);
    for (const set of [() => { r.seated = true; }, () => { r.seated = false; r.motion.move = "Glide"; }, () => { r.motion.move = null; r.lod.tier = HIDDEN; }]) {
      set();
      let moved = false;
      for (let ms = 0; ms < 3000; ms += 16) { r.motion.lift = 0; r.motion.upper = null; driveTalk(r, chat); if (r.motion.upper || r.motion.lift) moved = true; step(16); }
      expect(moved).toBe(false);
      say(`again ${Math.random()}`);
    }
  });
});
