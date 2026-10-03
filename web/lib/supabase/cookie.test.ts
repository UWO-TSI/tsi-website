import { describe, expect, it } from "vitest";
import { authCookieOptions, SHARED_AUTH_COOKIE } from "./cookie";

describe("authCookieOptions", () => {
  it.each(["www.tethos.ca", "play.tethos.ca", "tethos.ca", "PLAY.tethos.ca:443"])("shares the session across tethos.ca on %s", host => {
    expect(authCookieOptions(host)).toEqual({ name: SHARED_AUTH_COOKIE, domain: ".tethos.ca" });
  });
  it.each([null, "", "localhost:3000", "play.localhost:3000", "uwotsi-abc.vercel.app", "tethos.ca.evil.example", "nottethos.ca"])("keeps the default host-only cookie on %s", host => {
    expect(authCookieOptions(host)).toBeUndefined();
  });
});
