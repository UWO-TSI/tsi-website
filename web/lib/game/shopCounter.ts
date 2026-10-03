/**
 * Buying and selling at the shop's counter (specs/polish/forage-craft-museum.md 9): the shop's own services through
 * the economy transport (the server's in the world, the memory store's in the tests and the signed-out demo), what the
 * coin readout counts from and to, and what the shopkeeper says. Selling is the shop's alone (the bag's sell-anywhere
 * went with it): locked favourites are never sold. Amounts are coins only; nothing is ever said as money.
 */
import { ApiError, newKey } from "@/lib/apiClient";
import type { SellEntry, ShopEntry } from "@/lib/wallet/service";
import type { EconomyTransport } from "@/lib/wallet/transport";

export type CounterResult = { ok: true; paid: number; from: number; to: number; line: string } | { ok: false; error: string; line: string };
const errText = (e: unknown) => (e instanceof ApiError ? e.message : "The register jammed. Try again.");

/** Sell `qty` of something over the counter. */
export async function sellAtCounter(t: EconomyTransport, e: SellEntry, qty: number, key = newKey()): Promise<CounterResult> {
  if (e.locked) return { ok: false, error: "That's locked in your bag.", line: "That one's a keeper, I can tell. Unlock it in your bag if you change your mind." };
  try {
    const r = await t.sell(e.item_key, qty, key);
    return { ok: true, paid: r.paid, from: r.balance - r.paid, to: r.balance,
      line: qty > 1 ? `${qty} ${e.name.toLowerCase()}, that's ${r.paid.toLocaleString()} coins. Pleasure doing business!` : `One ${e.name.toLowerCase()}: ${r.paid.toLocaleString()} coins. Thank you kindly!` };
  } catch (err) {
    return { ok: false, error: errText(err), line: "Hmm, the register won't take that right now." };
  }
}

/** Buy one of something over the counter (coins only: Gems are for the club's merch, and that's reserved, not bought here). */
export async function buyAtCounter(t: EconomyTransport, e: ShopEntry, key = newKey()): Promise<CounterResult> {
  try {
    const r = await t.buy(e.id, 1, key);
    return { ok: true, paid: r.price_each, from: r.balance + r.price_each, to: r.balance, line: `The ${e.name.toLowerCase()}, all yours. Thanks for stopping by!` };
  } catch (err) {
    return { ok: false, error: errText(err), line: "Ah, not today, I'm afraid." };
  }
}

/** The readout counting from one balance to another: a value and a moment (ms) for each clink, ending on the new balance. */
export function coinSteps(from: number, to: number): { value: number; at: number }[] {
  if (from === to) return [];
  const n = Math.max(4, Math.min(10, Math.round(Math.log2(Math.abs(to - from) + 1) * 1.4)));
  const out: { value: number; at: number }[] = [];
  for (let i = 1; i <= n; i++) {
    const k = i / n, e = 1 - (1 - k) ** 2;
    const value = i === n ? to : Math.round(from + (to - from) * e);
    if (out.length && value === out[out.length - 1].value) continue;
    out.push({ value, at: Math.round(80 + i * (420 / n) + i * i * 6) });
  }
  return out;
}
