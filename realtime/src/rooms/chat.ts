// World chat checks (specs/multiplayer.md §6, M2): what happens to a `chat {text}`
// before the room sends it to the shard. Pure: the room keeps a meter per session and
// asks; nothing here touches Colyseus. Limits come from the contract (CHAT); the
// filter and the text helpers are web/lib/moderation's, bundled in (@moderation/*).
//
// Order: muted, then the text (empty, too long), then the pace (gap, per minute, per
// hour, slow mode), then a repeat, then the filter, then links from new accounts.
// Only accepted lines count against the limits.
import { CHAT, type ChatRefusal } from "@net/protocol";
import { containsProfanity } from "@moderation/profanity";
import { cleanChatText, containsLink, isBlankChatText } from "@moderation/chatText";

/** What the checks need to know about the sender (from the player card, kept current by sanctions). */
export type ChatSender = {
  /** ms since the epoch, or null. */
  mutedUntil: number | null;
  /** The account's created_at, ms since the epoch. */
  createdAt: number;
  /** An active member (the card's badge); public accounts get slow mode on their first day. */
  member: boolean;
};

/** One session's accepted lines: their times (the last hour) and recent texts (CHAT.repeatMs). */
export type ChatMeter = { times: number[]; recent: { key: string; at: number }[] };

export const createChatMeter = (): ChatMeter => ({ times: [], recent: [] });

export type ChatVerdict = { ok: true; text: string } | { ok: false; reason: ChatRefusal; notice: string };

const HOUR = 3_600_000;
const MINUTE = 60_000;

const untilFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });

/** The words the sender sees in the chat box for each refusal (the client may use its own for the reason key). */
export function refusalNotice(reason: ChatRefusal, mutedUntil: number | null = null): string {
  switch (reason) {
    case "muted":
      return mutedUntil ? `You can't chat until ${untilFormat.format(mutedUntil)}.` : "You can't chat right now.";
    case "fast":
      return "Slow down a little.";
    case "slow":
      return `New accounts can send ${CHAT.slowModePerMinute} lines a minute on their first day.`;
    case "repeat":
      return "You just said that.";
    case "long":
      return `Keep it under ${CHAT.maxLength} characters.`;
    case "empty":
      return "Write something first.";
    case "filtered":
      return "Please keep chat friendly.";
    case "url":
      return "Links unlock after your first week.";
  }
}

const refuse = (reason: ChatRefusal, mutedUntil: number | null = null): ChatVerdict => ({ ok: false, reason, notice: refusalNotice(reason, mutedUntil) });

/** How a text compares for repeats: case and spacing don't make it new. */
const repeatKey = (text: string) => text.toLowerCase();

/** Slow mode: a public account younger than CHAT.slowModeAccountMs. */
export const inSlowMode = (s: ChatSender, now: number) => !s.member && now - s.createdAt < CHAT.slowModeAccountMs;

/** Forget what no limit looks at any more. */
function prune(meter: ChatMeter, now: number): void {
  while (meter.times.length > 0 && now - meter.times[0] >= HOUR) meter.times.shift();
  while (meter.recent.length > 0 && now - meter.recent[0].at >= CHAT.repeatMs) meter.recent.shift();
}

/** Would this line go out now? Doesn't record it: call recordChat when it's sent. */
export function checkChat(meter: ChatMeter, sender: ChatSender, raw: string, now: number): ChatVerdict {
  if (sender.mutedUntil !== null && sender.mutedUntil > now) return refuse("muted", sender.mutedUntil);
  const text = cleanChatText(raw);
  if (!text || isBlankChatText(text)) return refuse("empty");
  if (text.length > CHAT.maxLength) return refuse("long");

  prune(meter, now);
  const slow = inSlowMode(sender, now);
  const last = meter.times[meter.times.length - 1];
  let lastMinute = 0;
  for (let i = meter.times.length - 1; i >= 0 && now - meter.times[i] < MINUTE; i--) lastMinute++;
  const fast = (last !== undefined && now - last < CHAT.gapMs) || lastMinute >= (slow ? CHAT.slowModePerMinute : CHAT.perMinute) || meter.times.length >= CHAT.perHour;
  if (fast) return refuse(slow ? "slow" : "fast");

  const key = repeatKey(text);
  if (meter.recent.some((r) => r.key === key)) return refuse("repeat");
  if (containsProfanity(text)) return refuse("filtered");
  if (now - sender.createdAt < CHAT.urlAccountMs && containsLink(text)) return refuse("url");
  return { ok: true, text };
}

/** Count a sent line. */
export function recordChat(meter: ChatMeter, text: string, now: number): void {
  meter.times.push(now);
  meter.recent.push({ key: repeatKey(text), at: now });
}
