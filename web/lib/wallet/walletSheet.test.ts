import { describe, expect, it } from "vitest";
import type { WalletView } from "./service";
import type { LedgerEntry } from "./store";
import { giftCountdown, walletSheet } from "./walletSheet";

// 2:05 pm on Saturday, October 3 in Toronto (EDT, UTC-4).
const NOW = new Date("2026-10-03T18:05:00Z");
const at = (iso: string) => new Date(iso).toISOString();
const entry = (e: Partial<LedgerEntry> & Pick<LedgerEntry, "amount" | "source">): LedgerEntry => ({ currency: "coins", balance_after: 0, ref: null, created_at: at("2026-10-03T17:00:00Z"), ...e });
const VIEW: WalletView = {
  coins: 2400, gems: 650, daily_claimed: true, day: "2026-10-03",
  recent: [
    entry({ amount: 20, source: "daily_gift", ref: "2026-10-03", balance_after: 2400, created_at: at("2026-10-03T13:10:00Z") }),
    entry({ amount: 60, source: "sell", ref: "fish_dace", balance_after: 2380, created_at: at("2026-10-03T12:30:00Z") }),
    entry({ amount: -150, source: "shop", ref: "acc-straw-hat", balance_after: 2320, created_at: at("2026-10-02T20:00:00Z") }),
    entry({ amount: -100, source: "shop", ref: "rod-basic", balance_after: 2470, created_at: at("2026-10-02T19:00:00Z") }),
    entry({ amount: 650, currency: "gems", source: "earn_admin", ref: "Bounty: accessibility audit", balance_after: 650, created_at: at("2026-10-01T15:00:00Z") }),
    entry({ amount: 900, source: "study", ref: "s-1", balance_after: 2570, created_at: at("2026-10-01T03:30:00Z") }), // 11:30 pm Sep 30 in Toronto
    entry({ amount: -250, source: "respec", ref: "oracle respec", balance_after: 1670, created_at: at("2026-09-29T15:00:00Z") }),
    entry({ amount: 5, source: "a_new_thing", ref: null, balance_after: 1920, created_at: at("2026-09-29T14:00:00Z") }),
  ],
};

describe("the wallet sheet's data (reachability deliverable 2)", () => {
  const m = walletSheet(VIEW, NOW);

  it("shows the balance in TC and Gems, never money", () => {
    expect(m.coins).toBe(2400);
    expect(m.gems).toBe(650);
  });

  it("splits recent moves into earned and spent, by Toronto day, newest first, each said plainly", () => {
    expect(m.earned.map(d => d.label)).toEqual(["Today", "Thu, Oct 1", "Wed, Sep 30", "Tue, Sep 29"]);
    expect(m.earned[0].lines.map(l => l.title)).toEqual(["Today's gift", "Sold Dace"]);
    expect(m.spent.map(d => d.label)).toEqual(["Yesterday", "Tue, Sep 29"]);
    expect(m.spent[0].lines.map(l => l.title)).toEqual(["Bought Straw hat", "Bought Basic rod"]);
    expect(m.spent[1].lines[0].title).toBe("Asked the Oracle again");
    // Gems keep their own currency and the note that came with them.
    const gem = m.earned[1].lines[0];
    expect(gem).toMatchObject({ currency: "gems", amount: 650, title: "Club grant" });
    expect(gem.detail).toContain("Bounty: accessibility audit");
    // Something new still reads as words.
    expect(m.earned[3].lines[0].title).toBe("A new thing");
    // Times are Toronto's.
    expect(m.earned[0].lines[1].detail).toBe("8:30 AM");
  });

  it("adds up the TC earned and spent in what it shows (Gems apart)", () => {
    expect(m.totals).toEqual({ earned: 20 + 60 + 900 + 5, spent: 150 + 100 + 250 });
  });

  it("knows today's gift: opened, and how long until the next", () => {
    expect(m.gift).toMatchObject({ opened: true, next: "9 h 55 min" });
    expect(walletSheet({ ...VIEW, daily_claimed: false }, NOW).gift).toMatchObject({ opened: false, next: null });
    expect(giftCountdown(new Date("2026-10-04T03:59:30Z"))).toBe("under a minute");
    expect(giftCountdown(new Date("2026-10-04T03:12:00Z"))).toBe("48 min");
    // Across the clocks going back (Nov 1): Toronto's day is 25 hours long.
    expect(giftCountdown(new Date("2026-11-01T04:00:00Z"))).toBe("25 h");
  });

  it("never shows a conversion rate or money anywhere", () => {
    const words = JSON.stringify(m);
    expect(words).not.toMatch(/\$|\bCAD\b|\bUSD\b|≈|=|\bdollars?\b|\bcents?\b|\brate\b|\bper\b|\bworth\b/i);
    expect(Object.keys(m).sort()).toEqual(["coins", "earned", "gems", "gift", "spent", "totals"]);
  });

  it("an empty wallet is still a wallet", () => {
    const e = walletSheet({ coins: 0, gems: 0, daily_claimed: false, day: "2026-10-03", recent: [] }, NOW);
    expect(e).toMatchObject({ coins: 0, earned: [], spent: [], totals: { earned: 0, spent: 0 } });
  });
});
