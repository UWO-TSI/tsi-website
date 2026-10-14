import { describe, expect, it } from "vitest";
import { FRIEND_CODE_ALPHABET, FRIEND_CODE_LENGTH, formatFriendCode, isFriendCode, makeFriendCode, parseFriendCode } from "./friendCode";

/** The migration's CHECK (20261013170000_world_friends). */
const SQL_CHECK = /^[2-9A-HJKMNP-Z]{8}$/;

describe("friend codes (v1 friends)", () => {
  it("are 8 characters from an alphabet without look-alikes (no 0 O, 1 I L), the same set the database checks", () => {
    expect(FRIEND_CODE_LENGTH).toBe(8);
    expect(FRIEND_CODE_ALPHABET).toHaveLength(31);
    for (const c of "01OIL") expect(FRIEND_CODE_ALPHABET).not.toContain(c);
    expect(new Set(FRIEND_CODE_ALPHABET).size).toBe(FRIEND_CODE_ALPHABET.length);
    for (const c of FRIEND_CODE_ALPHABET) expect(SQL_CHECK.test(c.repeat(8)), c).toBe(true);
  });

  it("are made from any random source, every character reachable, always valid", () => {
    let i = 0;
    const steps = [0, 0.999999, 0.5, 0.25, 0.75, 0.1, 0.9, 0.333];
    const code = makeFriendCode(() => steps[i++ % steps.length]);
    expect(code).toMatch(SQL_CHECK);
    expect(code[0]).toBe(FRIEND_CODE_ALPHABET[0]);
    expect(code[1]).toBe(FRIEND_CODE_ALPHABET[FRIEND_CODE_ALPHABET.length - 1]);
    const seen = new Set<string>();
    for (let n = 0; n < 400; n++) { const c = makeFriendCode(); expect(c).toMatch(SQL_CHECK); for (const ch of c) seen.add(ch); }
    expect(seen.size).toBe(FRIEND_CODE_ALPHABET.length);
    // A random source that returns 1 (out of range) still lands inside the alphabet.
    expect(makeFriendCode(() => 1)).toMatch(SQL_CHECK);
  });

  it("read the way people type them: any case, spaces and dashes; a look-alike (never in a code) is a typo, not a guess", () => {
    expect(parseFriendCode("abcd-2345")).toBe("ABCD2345");
    expect(parseFriendCode("  AbCd 2345 ")).toBe("ABCD2345");
    expect(parseFriendCode("ABCD—2345")).toBe("ABCD2345");
    for (const bad of ["", "ABCD234", "ABCD23456", "ABCD-23O5", "ABCD-2315", "AB!D2345", "ABCD2345X"]) expect(parseFriendCode(bad), bad).toBeNull();
    expect(isFriendCode("ABCD2345")).toBe(true);
    expect(isFriendCode("abcd2345")).toBe(false);
  });

  it("show as two groups of four", () => {
    expect(formatFriendCode("ABCD2345")).toBe("ABCD-2345");
  });
});
