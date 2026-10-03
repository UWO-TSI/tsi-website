// specs/multiplayer.md §6 world chat: every limit and refusal of the pure checks (src/rooms/chat.ts).
// The room-level behaviour (delivery, blocks, notices on the wire, the log) is in world-chat.test.ts.
import { describe, expect, it } from "vitest";
import { CHAT, CHAT_REFUSALS } from "@net/protocol";
import { checkChat, createChatMeter, inSlowMode, recordChat, refusalNotice, type ChatMeter, type ChatSender } from "../src/rooms/chat";

const T0 = Date.parse("2026-10-03T16:00:00Z");
const DAY = 86_400_000;
const member: ChatSender = { mutedUntil: null, createdAt: T0 - 400 * DAY, member: true };
const newPublic: ChatSender = { mutedUntil: null, createdAt: T0 - 3_600_000, member: false };

/** Says `text` at `at`, recording it when it goes out. */
function say(meter: ChatMeter, sender: ChatSender, text: string, at: number) {
  const v = checkChat(meter, sender, text, at);
  if (v.ok) recordChat(meter, v.text, at);
  return v;
}
const reason = (v: ReturnType<typeof checkChat>) => (v.ok ? "ok" : v.reason);

describe("checkChat", () => {
  it("accepts a line, cleaned", () => {
    expect(checkChat(createChatMeter(), member, "  hi   all ​ ", T0)).toEqual({ ok: true, text: "hi all" });
  });

  it("muted: refused while the mute runs, with its end in the notice; fine after", () => {
    const muted = { ...member, mutedUntil: Date.parse("2026-10-10T19:30:00Z") };
    const v = checkChat(createChatMeter(), muted, "hello", T0);
    expect(v).toMatchObject({ ok: false, reason: "muted" });
    expect(!v.ok && v.notice).toMatch(/^You can't chat until Oct 10, 2026, 3:30/);
    expect(reason(checkChat(createChatMeter(), muted, "hello", Date.parse("2026-10-10T19:30:01Z")))).toBe("ok");
  });

  it("empty and long: measured after cleaning", () => {
    for (const blank of ["", "   ", "​⁠", "́́", "\n\t"]) expect(reason(checkChat(createChatMeter(), member, blank, T0)), JSON.stringify(blank)).toBe("empty");
    expect(reason(checkChat(createChatMeter(), member, "x".repeat(CHAT.maxLength), T0))).toBe("ok");
    expect(reason(checkChat(createChatMeter(), member, "x".repeat(CHAT.maxLength + 1), T0))).toBe("long");
    expect(reason(checkChat(createChatMeter(), member, `  ${"x".repeat(CHAT.maxLength)}​  `, T0))).toBe("ok");
  });

  it(`fast: ${CHAT.gapMs} ms apart`, () => {
    const m = createChatMeter();
    expect(reason(say(m, member, "one", T0))).toBe("ok");
    expect(reason(say(m, member, "two", T0 + CHAT.gapMs - 1))).toBe("fast");
    expect(reason(say(m, member, "two", T0 + CHAT.gapMs))).toBe("ok");
  });

  it(`fast: ${CHAT.perMinute} a minute`, () => {
    const m = createChatMeter();
    for (let i = 0; i < CHAT.perMinute; i++) expect(reason(say(m, member, `line ${i}`, T0 + i * 2000))).toBe("ok");
    expect(reason(say(m, member, "one more", T0 + CHAT.perMinute * 2000))).toBe("fast");
    // The first line leaves the window a minute after it was said.
    expect(reason(say(m, member, "one more", T0 + 60_000))).toBe("ok");
  });

  it(`fast: ${CHAT.perHour} an hour`, () => {
    const m = createChatMeter();
    for (let i = 0; i < CHAT.perHour; i++) expect(reason(say(m, member, `line ${i}`, T0 + i * 15_000))).toBe("ok"); // 4 a minute
    const after = T0 + CHAT.perHour * 15_000;
    expect(reason(say(m, member, "and another", after))).toBe("fast");
    expect(reason(say(m, member, "and another", T0 + 3_600_000))).toBe("ok");
  });

  it(`slow mode: ${CHAT.slowModePerMinute} a minute for a public account younger than a day`, () => {
    expect(inSlowMode(newPublic, T0)).toBe(true);
    expect(inSlowMode({ ...newPublic, member: true }, T0)).toBe(false);
    expect(inSlowMode(newPublic, newPublic.createdAt + CHAT.slowModeAccountMs)).toBe(false);
    const m = createChatMeter();
    expect(reason(say(m, newPublic, "hi", T0))).toBe("ok");
    expect(reason(say(m, newPublic, "hello", T0 + 1000))).toBe("slow"); // the gap reads as slow mode too
    expect(reason(say(m, newPublic, "hello", T0 + 20_000))).toBe("ok");
    expect(reason(say(m, newPublic, "anyone?", T0 + 40_000))).toBe("slow");
    expect(reason(say(m, newPublic, "anyone?", T0 + 60_000))).toBe("ok");
    // A day on, the member limits.
    const later = newPublic.createdAt + CHAT.slowModeAccountMs;
    const m2 = createChatMeter();
    for (let i = 0; i < CHAT.perMinute; i++) expect(reason(say(m2, newPublic, `l${i}`, later + i * 2000))).toBe("ok");
  });

  it(`repeat: not the same text within ${CHAT.repeatMs / 1000} s, whatever its case`, () => {
    const m = createChatMeter();
    expect(reason(say(m, member, "anyone fishing?", T0))).toBe("ok");
    expect(reason(say(m, member, "Anyone  FISHING?", T0 + 5000))).toBe("repeat");
    expect(reason(say(m, member, "anyone fishing?", T0 + CHAT.repeatMs - 1))).toBe("repeat");
    expect(reason(say(m, member, "anyone fishing?", T0 + CHAT.repeatMs))).toBe("ok");
  });

  it("filtered: the shared word filter, normalized", () => {
    for (const bad of ["what the fuck", "f*ck this", "s h i t", "you b!tch"]) expect(reason(checkChat(createChatMeter(), member, bad, T0)), bad).toBe("filtered");
    for (const fine of ["Scunthorpe", "a class assassin", "Dickens"]) expect(reason(checkChat(createChatMeter(), member, fine, T0)), fine).toBe("ok");
  });

  it("url: refused from accounts younger than a week, plain text after", () => {
    const sixDays = { ...member, createdAt: T0 - 6 * DAY };
    const week = { ...member, createdAt: T0 - CHAT.urlAccountMs };
    for (const link of ["see example.com", "discord.gg/abc", "https://x.io/y", "www.site.org"]) {
      expect(reason(checkChat(createChatMeter(), sixDays, link, T0)), link).toBe("url");
      expect(reason(checkChat(createChatMeter(), week, link, T0)), link).toBe("ok");
    }
    expect(reason(checkChat(createChatMeter(), sixDays, "e.g. the cafe at 5.30", T0))).toBe("ok");
  });

  it("refused lines don't count against the limits", () => {
    const m = createChatMeter();
    for (let i = 0; i < 20; i++) say(m, member, "fuck", T0 + i);
    expect(m.times).toEqual([]);
    expect(reason(say(m, member, "hello", T0 + 50))).toBe("ok");
  });

  it("every reason has words", () => {
    for (const r of CHAT_REFUSALS) expect(refusalNotice(r).length).toBeGreaterThan(5);
    expect(refusalNotice("muted")).toBe("You can't chat right now.");
  });
});
