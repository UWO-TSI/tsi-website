import { describe, expect, it } from "vitest";
import { ARRIVAL_KEY, finishArrival, hasArrived, type ArrivalLedger } from "./arrivalService";
import { TUTORIAL_REWARD } from "./lines";

function ledger(): ArrivalLedger & { rows: { m: string; key: string; amount: number }[] } {
  const rows: { m: string; key: string; amount: number }[] = [];
  return {
    rows,
    has: async (m, key) => rows.some(r => r.m === m && r.key === key),
    credit: async (m, _c, amount, _s, _r, key) => {
      const replayed = rows.some(r => r.m === m && r.key === key);
      if (!replayed) rows.push({ m, key, amount });
      return { balance: rows.filter(r => r.m === m).reduce((n, r) => n + r.amount, 0), replayed };
    },
  };
}

describe("the arrival flag", () => {
  it("is set once per account by the tutorial's reward, which is paid once", async () => {
    const l = ledger();
    expect(await hasArrived(l, "a")).toBe(false);
    expect(await finishArrival(l, "a")).toEqual({ coins: TUTORIAL_REWARD.coins, balance: TUTORIAL_REWARD.coins, granted: true });
    expect(await hasArrived(l, "a")).toBe(true);
    expect(await hasArrived(l, "b")).toBe(false);
    expect(await finishArrival(l, "a")).toEqual({ coins: 0, balance: TUTORIAL_REWARD.coins, granted: false });
    expect(l.rows).toEqual([{ m: "a", key: ARRIVAL_KEY, amount: TUTORIAL_REWARD.coins }]);
  });
});
