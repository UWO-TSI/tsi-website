import { afterEach, describe, expect, it, vi } from "vitest";
import { parseShopBalance, parseShopCatalogue, shopReadTransport } from "./shopRead";
import { PresenceRequestError } from "./mobilePresence";
afterEach(() => vi.unstubAllGlobals());

describe("shop reads", () => {
  it("distinguishes a confirmed zero balance from unavailable or malformed data", () => {
    expect(parseShopBalance({ balance: 0 })).toBe(0);
    expect(parseShopBalance({ balance: 125 })).toBe(125);
    for (const value of [null, {}, { balance: "0" }, { balance: -1 }, { balance: NaN }, { balance: Infinity }]) {
      expect(() => parseShopBalance(value)).toThrow();
    }
  });
  it("accepts an empty catalogue only from a valid catalogue response", () => {
    expect(parseShopCatalogue({ products: [] })).toEqual([]);
    for (const value of [null, {}, [], { products: {} }, { products: [null] }, { products: [{ id: "p", name: "" }] }]) {
      expect(() => parseShopCatalogue(value)).toThrow();
    }
  });
  it("preserves prices and treats nullable optional fields as absent", () => {
    expect(parseShopCatalogue({ products: [{ id: "p", name: "Cap", price_tc: 0, price_cad: 12.5, description: null, stock: null }] }))
      .toEqual([{ id: "p", name: "Cap", price_tc: 0, price_cad: 12.5 }]);
  });
  it.each(["bad", -1, Infinity])("rejects malformed prices before rendering: %s", (price) => {
    expect(() => parseShopCatalogue({ products: [{ id: "p", name: "Cap", price_tc: price }] })).toThrow();
  });
  it("uses GET with the caller's cancellation signal for both reads", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{"products":[]}')).mockResolvedValueOnce(new Response('{"balance":0}'));
    vi.stubGlobal("fetch", fetchMock); const signal = new AbortController().signal;
    await expect(shopReadTransport.catalogue(signal)).resolves.toEqual([]);
    await expect(shopReadTransport.balance(signal)).resolves.toBe(0);
    expect(fetchMock.mock.calls).toEqual([["/api/shop", { signal }], ["/api/economy", { signal }]]);
  });
  it.each([401, 503])("keeps HTTP %s as an error rather than a default balance/catalogue", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{}', { status })));
    await expect(shopReadTransport.catalogue(new AbortController().signal)).rejects.toEqual(new PresenceRequestError(status));
    await expect(shopReadTransport.balance(new AbortController().signal)).rejects.toEqual(new PresenceRequestError(status));
  });
});
