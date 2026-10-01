import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/wallet/transport", () => ({ httpEconomyTransport: { wallet: vi.fn(async () => ({ coins: 0, daily_claimed: true, day: "2026-10-01" })) } }));
const { getHud, onApiWrite, setHudXp } = await import("./hudStore");

describe("HUD XP follows the game's writes", () => {
  it("takes a kill's new total, adds a finished mission's award once, ignores replays and other writes", () => {
    setHudXp(1000);
    onApiWrite({ path: "/api/combat/kill", data: { xp: 1040, level: 3 } });
    expect(getHud().xp).toBe(1040);
    onApiWrite({ path: "/api/combat/missions/complete", data: { xp_awarded: 300, coins_awarded: 60, replayed: false } });
    expect(getHud().xp).toBe(1340);
    onApiWrite({ path: "/api/combat/missions/complete", data: { xp_awarded: 300, replayed: true } });
    onApiWrite({ path: "/api/economy/buy", data: { balance: 10 } });
    expect(getHud().xp).toBe(1340);
  });
});
