import { describe, expect, it } from "vitest";
import { giftKey } from "./DailyGift";

const free = { typing: false, blocked: false, captureEnded: false };
const k = (key: string, extra: Partial<{ repeat: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) => ({ key, ...extra });

describe("the daily gift's keys (audit-2026-10-ui item 13)", () => {
  it("E opens an offered gift; Escape puts it off", () => {
    expect(giftKey("offer", k("e"), free)).toBe("claim");
    expect(giftKey("offer", k("E"), free)).toBe("claim");
    expect(giftKey("offer", k("Escape"), free)).toBe("later");
  });
  it("Escape closes it once opened or failed; E doesn't reopen anything", () => {
    expect(giftKey("opened", k("Escape"), free)).toBe("close");
    expect(giftKey("error", k("Escape"), free)).toBe("close");
    expect(giftKey("opened", k("e"), free)).toBeNull();
    expect(giftKey("opening", k("Escape"), free)).toBeNull();
  });
  it("leaves play keys to the world: Space, Enter and movement don't touch the gift", () => {
    for (const key of [" ", "Enter", "w", "a", "s", "d", "Shift"]) expect(giftKey("offer", k(key), free)).toBeNull();
  });
  it("waits while a sheet is open, while typing, on a held key, with a modifier, and for the Escape that ends mouse-look", () => {
    expect(giftKey("offer", k("e"), { ...free, blocked: true })).toBeNull();
    expect(giftKey("offer", k("Escape"), { ...free, blocked: true })).toBeNull();
    expect(giftKey("offer", k("e"), { ...free, typing: true })).toBeNull();
    expect(giftKey("offer", k("e", { repeat: true }), free)).toBeNull();
    expect(giftKey("offer", k("e", { metaKey: true }), free)).toBeNull();
    expect(giftKey("offer", k("Escape"), { ...free, captureEnded: true })).toBeNull();
  });
});
