/**
 * Friend codes (specs/v1-drop.md §3: add people who aren't online): one per player, 8 characters from an alphabet
 * without look-alikes (no 0 or O, no 1, I or L), shown as ABCD-EFGH. The database checks the same set
 * (20261013170000_world_friends: `^[2-9A-HJKMNP-Z]{8}$`); /api/world/friends makes one on first use and tries again on
 * the rare collision. 31^8 is about 850 billion codes.
 */
export const FRIEND_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const FRIEND_CODE_LENGTH = 8;
const CODE_RE = /^[2-9A-HJKMNP-Z]{8}$/;

/** A crypto-strong 0..1 where the platform has it. */
function strongRandom(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  return Math.random();
}

/** A fresh code. `random` returns 0..1 (a value of 1 still lands inside the alphabet). */
export function makeFriendCode(random: () => number = strongRandom): string {
  let out = "";
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    const k = Math.min(FRIEND_CODE_ALPHABET.length - 1, Math.floor(random() * FRIEND_CODE_ALPHABET.length));
    out += FRIEND_CODE_ALPHABET[Math.max(0, k)];
  }
  return out;
}

/** A stored code (exactly as the database keeps it). */
export const isFriendCode = (s: unknown): s is string => typeof s === "string" && CODE_RE.test(s);

/** What someone typed as a code: any case, with spaces and dashes; null when it can't be one. */
export function parseFriendCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s\-‐-―_.]/g, "");
  return CODE_RE.test(code) ? code : null;
}

/** ABCD-EFGH. */
export const formatFriendCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
