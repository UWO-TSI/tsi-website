/**
 * World display names (row 222): chosen in the creator, unique across the
 * world, filtered. The real name stays on the profile only.
 *
 * Uniqueness is by `nameKey`: Unicode NFKC, lower-case, separators and
 * apostrophes dropped, common digit look-alikes folded. So "Maya Chen",
 * "maya_chen" and "MAYA-CH3N" are the same name. The database enforces it
 * with a unique index on the key (20260926150700_identity.sql).
 */
import { containsProfanity } from "@/lib/moderation/profanity";

export const NAME_MIN = 3;
export const NAME_MAX = 16;
export const NAME_CHANGE_COOLDOWN_DAYS = 30;

const RESERVED = ["admin", "administrator", "moderator", "mod", "staff", "tsi", "tethos", "oracle", "keeper", "system", "support", "official", "villagehall", "president", "exec", "null", "undefined", "anonymous", "member", "guest"];
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s" };

/** Collapse spaces and trim; keep the member's casing for display. */
export function cleanName(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function nameKey(name: string): string {
  return cleanName(name).toLowerCase().replace(/[\s_\-'.]/g, "").replace(/[01345784@$]/g, (c) => LEET[c] ?? c);
}

export type NameCheck = { ok: true; name: string; key: string } | { ok: false; error: string; code: "length" | "characters" | "profanity" | "reserved" };

export function checkName(raw: unknown): NameCheck {
  const name = typeof raw === "string" ? cleanName(raw) : "";
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, code: "length", error: `Names are ${NAME_MIN}–${NAME_MAX} characters.` };
  // Letters from any script, digits, spaces and a few joiners; must start and end with a letter or digit.
  if (!/^[\p{L}\p{N}](?:[\p{L}\p{N} _\-'.]*[\p{L}\p{N}])?$/u.test(name) || /[ _\-'.]{2,}/.test(name)) {
    return { ok: false, code: "characters", error: "Use letters and numbers, with single spaces, dashes, dots, apostrophes or underscores between them." };
  }
  const key = nameKey(name);
  if (key.length < NAME_MIN) return { ok: false, code: "length", error: `Names need at least ${NAME_MIN} letters or numbers.` };
  const spaced = name.toLowerCase().replace(/[_\-'.]/g, " ");
  if (containsProfanity(spaced) || containsProfanity(key) || RESERVED_BAD.some((b) => key.includes(b))) return { ok: false, code: "profanity", error: "Please pick a different name." };
  if (RESERVED.some((r) => key === r || (r.length >= 5 && key.includes(r)))) return { ok: false, code: "reserved", error: "That name is reserved." };
  return { ok: true, name, key };
}

// Substring matches for slurs that hide inside a joined-up name (the shared
// filter matches whole words only).
const RESERVED_BAD = ["fuck", "shit", "cunt", "nigg", "fag", "retard", "whore", "slut", "bitch", "kike", "chink", "tranny"];

export function canChangeName(lastChangedAt: string | null, now: Date, isFirst: boolean): { ok: true } | { ok: false; until: string } {
  if (isFirst || !lastChangedAt) return { ok: true };
  const until = Date.parse(lastChangedAt) + NAME_CHANGE_COOLDOWN_DAYS * 86_400_000;
  return now.getTime() >= until ? { ok: true } : { ok: false, until: new Date(until).toISOString() };
}
