import { describe, expect, it } from "vitest";
import { CHAT, type ChatLine } from "./protocol";
import { BUBBLE_MS, CHAT_LOG_MAX, ChatStore, RECENT_LINES, RECENT_MS, RESTORE_MS, TYPING_IDLE_MS, talkBeat } from "./chat";

const ME = "11111111-1111-4111-8111-111111111111", ANN = "22222222-2222-4222-8222-222222222222", BO = "33333333-3333-4333-8333-333333333333";
let n = 0;
const line = (uid: string, sid: number, text: string, name = uid === ANN ? "Ann" : uid === BO ? "Bo" : "Me"): ChatLine =>
  ({ id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, sid, uid, name, area: 0, text, t: 1000 + n });
function rig() {
  let now = 1_000_000;
  const store = new ChatStore(() => now);
  return { store, at: (ms: number) => { now = ms; }, step: (ms: number) => { now += ms; }, now: () => now };
}

describe("the chat log", () => {
  it("keeps the session's last CHAT_LOG_MAX lines, yours marked, newest last", () => {
    const { store } = rig();
    store.setSelf(ME);
    for (let i = 0; i < CHAT_LOG_MAX + 7; i++) store.receive(line(i % 2 ? ANN : ME, i % 2 ? 2 : 1, `line ${i}`));
    const log = store.entries();
    expect(log).toHaveLength(CHAT_LOG_MAX);
    expect(log[log.length - 1]).toMatchObject({ kind: "line", text: `line ${CHAT_LOG_MAX + 6}`, mine: true });
    expect(log[0]).toMatchObject({ text: "line 7" });
    expect(log.filter(e => e.kind === "line" && e.mine).length).toBeGreaterThan(0);
  });

  it("hands React a new snapshot only when something changes, and tells its listeners", () => {
    const { store } = rig();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    const a = store.entries();
    expect(store.entries()).toBe(a);
    store.receive(line(ANN, 2, "hi"));
    expect(store.entries()).not.toBe(a);
    expect(calls).toBe(1);
    off();
    store.receive(line(ANN, 2, "again"));
    expect(calls).toBe(1);
  });

  it("the last RECENT_LINES lines said within RECENT_MS show at the bottom left", () => {
    const { store, step } = rig();
    for (let i = 0; i < 8; i++) { store.receive(line(ANN, 2, `l${i}`)); step(1000); }
    expect(store.recent().map(e => e.kind === "line" && e.text)).toEqual(["l3", "l4", "l5", "l6", "l7"].slice(-RECENT_LINES));
    step(RECENT_MS - 2500);
    expect(store.recent().map(e => e.kind === "line" && e.text)).toEqual(["l6", "l7"]);
    step(2000);
    expect(store.recent()).toEqual([]);
  });
});

describe("mute (this session only)", () => {
  it("drops a muted player's lines and bubbles, hides what they said, and lets them back on unmute", () => {
    const { store } = rig();
    store.receive(line(ANN, 2, "before"));
    store.receive(line(BO, 3, "bo here"));
    store.mute(ANN);
    expect(store.isMuted(ANN)).toBe(true);
    expect(store.entries().map(e => e.kind === "line" && e.text)).toEqual(["bo here"]);
    expect(store.receive(line(ANN, 2, "while muted"))).toBe(false);
    expect(store.bubble(2, ANN)).toBeNull();
    store.unmute(ANN);
    expect(store.receive(line(ANN, 2, "after"))).toBe(true);
    expect(store.entries().map(e => e.kind === "line" && e.text)).toEqual(["before", "bo here", "after"]);
  });
  it("never mutes yourself", () => {
    const { store } = rig();
    store.setSelf(ME);
    store.mute(ME);
    expect(store.isMuted(ME)).toBe(false);
  });
});

describe("refusals", () => {
  it("land as a kind notice of their own, never as a line, with your words back in the bar", () => {
    const { store, step } = rig();
    store.sent("hello frend");
    step(300);
    store.refused("filtered", "Please keep chat friendly.");
    const e = store.entries();
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ kind: "notice", reason: "filtered", text: "Please keep chat friendly." });
    expect(store.takeRestore()).toBe("hello frend");
    expect(store.takeRestore()).toBeNull();
  });
  it("a refusal long after the send gives nothing back, and your accepted line clears what was pending", () => {
    const { store, step } = rig();
    store.setSelf(ME);
    store.sent("one");
    step(RESTORE_MS + 1);
    store.refused("fast", "Slow down a little.");
    expect(store.takeRestore()).toBeNull();
    store.sent("two");
    store.receive(line(ME, 1, "two"));
    store.refused("fast", "Slow down a little.");
    expect(store.takeRestore()).toBeNull();
  });
  it("words its own notice when the server sent none", () => {
    const { store } = rig();
    store.refused("url", "");
    expect(store.entries()[0]).toMatchObject({ kind: "notice", reason: "url", text: expect.stringMatching(/link/i) });
  });
});

describe("bubbles", () => {
  it("show a speaker's latest line for BUBBLE_MS, for the player who said it (a reused sid isn't them)", () => {
    const { store, step } = rig();
    store.receive(line(ANN, 2, "first"));
    step(2000);
    store.receive(line(ANN, 2, "second"));
    expect(store.bubble(2, ANN)).toMatchObject({ text: "second", age: 0 });
    expect(store.bubble(2, BO)).toBeNull();
    step(BUBBLE_MS - 1);
    expect(store.bubble(2, ANN)).toMatchObject({ text: "second", age: BUBBLE_MS - 1 });
    step(1);
    expect(store.bubble(2, ANN)).toBeNull();
  });
  it("your own line bubbles over you", () => {
    const { store } = rig();
    store.setSelf(ME);
    store.receive(line(ME, 1, "hey all"));
    expect(store.selfBubble()).toMatchObject({ text: "hey all" });
    expect(store.bubble(1, ME)).toMatchObject({ text: "hey all" });
  });
  it("go with a block (lines and bubbles), as with a mute", () => {
    const { store } = rig();
    store.receive(line(BO, 3, "hm"));
    store.blocked(BO);
    expect(store.bubble(3, BO)).toBeNull();
    expect(store.entries()).toEqual([]);
  });
});

describe("the typing flag", () => {
  it("goes up with the first letter, down when the bar empties, on a send or after a quiet spell; each change once", () => {
    const { store, step } = rig();
    expect(store.draft("h")).toBe(true);
    expect(store.draft("he")).toBeNull();
    expect(store.draft("")).toBe(false);
    expect(store.draft("")).toBeNull();
    expect(store.draft("hey")).toBe(true);
    step(TYPING_IDLE_MS - 1);
    expect(store.idle()).toBeNull();
    step(1);
    expect(store.idle()).toBe(false);
    expect(store.idle()).toBeNull();
    expect(store.draft("hey!")).toBe(true);
    store.sent("hey!");
    expect(store.typing).toBe(false);
    expect(store.draft("x")).toBe(true);
    expect(store.close()).toBe(false);
    expect(store.close()).toBeNull();
  });
  it("never sends more than the server takes", () => {
    expect(CHAT.maxLength).toBe(200);
  });
});

describe("the talking animation while a bubble shows", () => {
  it("gestures soon after the line, and again now and then; hops a little now and then; all done by the end", () => {
    const step = 1 / 60;
    for (const seed of [1, 7, 42, 1234]) {
      let gestures = 0, hops = 0, maxHop = 0, wasUp = false;
      for (let t = step; t <= BUBBLE_MS / 1000 + 1; t += step) {
        const b = talkBeat(t - step, t, seed);
        if (b.gesture) gestures++;
        if (b.hop > 0 && !wasUp) hops++;
        wasUp = b.hop > 0;
        maxHop = Math.max(maxHop, b.hop);
        if (t > BUBBLE_MS / 1000) { expect(b.gesture).toBe(false); expect(b.hop).toBe(0); }
      }
      expect(gestures, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(gestures).toBeLessThanOrEqual(3);
      expect(hops).toBeGreaterThanOrEqual(1);
      expect(hops).toBeLessThanOrEqual(2);
      expect(maxHop).toBeGreaterThan(0.08);
      expect(maxHop).toBeLessThan(0.2);
    }
    expect(talkBeat(0, 0.4, 1).gesture).toBe(true);
  });
});
