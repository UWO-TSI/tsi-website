import { describe, expect, it } from "vitest";
import { DEFAULT_ALLOWED_ORIGINS, DEV_ORIGIN_PATTERNS, parseEnv } from "../src/env";

const PROD = {
  NODE_ENV: "production",
  SUPABASE_URL: "https://example.supabase.co/",
  SUPABASE_SECRET_KEY: "sb_secret_0123456789abcdefghij",
};

describe("env", () => {
  it("defaults to development on port 2567 with the §1.4 origins plus localhost", () => {
    const env = parseEnv({});
    expect(env.nodeEnv).toBe("development");
    expect(env.port).toBe(2567);
    expect(env.devAuth).toBe(false);
    expect(env.allowedOrigins).toEqual(DEFAULT_ALLOWED_ORIGINS);
    expect(env.allowedOriginPatterns).toEqual(expect.arrayContaining(DEV_ORIGIN_PATTERNS));
  });

  it("accepts a production config, trims the URL and drops the dev origins", () => {
    const env = parseEnv(PROD);
    expect(env.production).toBe(true);
    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.allowedOriginPatterns.some((p) => p.includes("localhost"))).toBe(false);
  });

  it("refuses DEV_AUTH=1 in production", () => {
    expect(() => parseEnv({ ...PROD, DEV_AUTH: "1" })).toThrow(/DEV_AUTH/);
  });

  it("requires the Supabase URL and key in production, without echoing values", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/SUPABASE_URL[\s\S]*SUPABASE_SECRET_KEY/);
    try {
      parseEnv({ ...PROD, SUPABASE_SECRET_KEY: "short-secret" });
    } catch (e) {
      expect(String(e)).not.toContain("short-secret");
    }
  });

  it("splits origins on commas or spaces and patterns on spaces", () => {
    const env = parseEnv({
      ALLOWED_ORIGINS: "https://a.example, https://b.example https://c.example",
      ALLOWED_ORIGIN_PATTERNS: "^https://x{1,3}\\.example$ ^https://y\\.example$",
    });
    expect(env.allowedOrigins).toEqual(["https://a.example", "https://b.example", "https://c.example"]);
    expect(env.allowedOriginPatterns.slice(0, 2)).toEqual(["^https://x{1,3}\\.example$", "^https://y\\.example$"]);
  });

  it("refuses unanchored or invalid origin patterns", () => {
    expect(() => parseEnv({ ALLOWED_ORIGIN_PATTERNS: "vercel\\.app" })).toThrow(/anchored/);
    expect(() => parseEnv({ ALLOWED_ORIGIN_PATTERNS: "^https://(a$" })).toThrow(/regular expression/);
  });

  it("enables DEV_AUTH outside production", () => {
    expect(parseEnv({ DEV_AUTH: "1" }).devAuth).toBe(true);
  });

  it("takes the internal secret (32+ characters) without echoing a short one; unset turns /internal off", () => {
    expect(parseEnv({}).internalSecret).toBeUndefined();
    expect(parseEnv({ ...PROD, REALTIME_INTERNAL_SECRET: "s".repeat(32) }).internalSecret).toBe("s".repeat(32));
    try {
      parseEnv({ REALTIME_INTERNAL_SECRET: "too-short-secret" });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toMatch(/REALTIME_INTERNAL_SECRET/);
      expect(String(e)).not.toContain("too-short-secret");
    }
  });
});
