/**
 * The word blocklist for member-written text (guestbook, NPC chat, letters,
 * names, table chat). Whole-word, case-insensitive.
 */
const BLOCKLIST = [
  "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "pussy", "slut", "whore",
  "fag", "faggot", "nigger", "nigga", "retard", "tranny", "kike", "spic", "chink", "gook",
];

const PATTERNS = BLOCKLIST.map((bad) => new RegExp(`\\b${bad}\\b`, "i"));

export function containsProfanity(text: string): boolean {
  return PATTERNS.some((re) => re.test(text));
}
