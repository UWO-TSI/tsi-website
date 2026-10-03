/**
 * World chat text (specs/multiplayer.md §6, row 298): how a line is cleaned before it's checked, shown or logged, and
 * whether it carries a link. Pure TypeScript that imports nothing: the realtime server bundles it, and the chat box can
 * clean a draft the same way before sending. Lines are always shown as plain text, links included (never anchors).
 */

/**
 * Hidden characters dropped from a line: C0/C1 controls, soft hyphen, zero-width space, word joiner, bidi marks and
 * overrides (which can flip how a line reads), BOM, invisible fillers and the blank braille cell. Zero-width (non-)joiners
 * stay: emoji sequences and Persian and Indic text need them.
 */
const HIDDEN = /[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\u2800\u3164\ufeff\uffa0\ufff9-\ufffb]/g;
/** Line breaks and tabs read as spaces. */
const BREAKS = /[\t\n\v\f\r\u0085\u2028\u2029]/g;
/** At most three combining marks on a letter (stacked "Zalgo" marks spill over other lines). */
const MARK_PILES = /(\p{M}{3})\p{M}+/gu;

/** A line as it's checked, shown and logged: NFC, hidden characters out, marks capped, whitespace collapsed and trimmed. */
export function cleanChatText(raw: string): string {
  return raw.normalize("NFC").replace(BREAKS, " ").replace(HIDDEN, "").replace(MARK_PILES, "$1").replace(/\s+/g, " ").trim();
}

/** Nothing anyone would see: only spaces, marks, joiners and variation selectors. */
export function isBlankChatText(text: string): boolean {
  return !/[^\s\p{M}\p{Cf}\ufe00-\ufe0f]/u.test(text);
}

// Top-level domains that read as links when written bare ("example.com"). Ones that are also everyday words (me, to,
// be, in, it, us, no, live, fun, ...) count only with a path after them ("t.me/x", "youtu.be/x").
const BARE_TLDS = [
  "com", "net", "org", "edu", "gov", "io", "gg", "ly", "ca", "co", "tv", "app", "dev", "xyz", "info", "biz", "uk", "ru", "cn", "link",
  "site", "online", "store", "shop", "club", "sh", "ai", "cc", "ws", "tk", "ml", "ga", "pw", "cx", "lol", "wtf", "zip", "mov", "tech",
  "cloud", "fm", "im", "pro", "vip", "bet", "xxx", "porn", "cam", "icu", "buzz", "mobi", "eu", "de", "fr", "jp", "kr", "au", "nz", "nl",
  "se", "pl", "br", "mx", "gl", "gd",
].join("|");
/** TLDs people spell out to dodge a filter ("discord dot gg"). */
const SPELLED_TLDS = "com|net|org|gg|io|ly|co|ca|tv|xyz|app|dev|link";

const LINK_PATTERNS = [
  /\b[a-z][a-z0-9+.-]{1,15}:\/\//,                                       // a scheme: https://, ftp://
  /\bwww\d{0,3}\./,                                                       // www.
  new RegExp(`(?:^|[^a-z0-9-])[a-z0-9-]{1,63}(?:\\.[a-z0-9-]{1,63})*\\.(?:${BARE_TLDS})(?![a-z0-9-])`), // example.com, a.b.co.uk, x@y.io
  /[a-z0-9-]\.[a-z]{2,24}\/\S/,                                            // youtu.be/x, t.me/x
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/,                                         // 1.2.3.4
  new RegExp(`\\b[a-z0-9-]{2,63}\\s*(?:\\(\\s*dot\\s*\\)|\\[\\s*dot\\s*\\]|\\{\\s*dot\\s*\\}|\\(\\.\\)|\\[\\.\\]|\\s+dot\\s+)\\s*(?:${SPELLED_TLDS})\\b`), // example (dot) com
  /\b[a-z0-9-]{2,63}\s+\.\s*(?:com|net|org|gg|io|ly|xyz)\b/,              // example .com (not "done. Org meeting")
];

/** Whether a line carries a link or something meant to be read as one (refused from accounts under 7 days old). */
export function containsLink(text: string): boolean {
  const t = text.normalize("NFKC").toLowerCase().replace(HIDDEN, "").replace(/[。｡]/g, ".");
  return LINK_PATTERNS.some((re) => re.test(t));
}
