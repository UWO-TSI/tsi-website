import { afterEach, describe, expect, it, vi } from "vitest";
import { installDemoFetch, reply } from "./demoFetch";

function page(search: string) {
  const network = vi.fn(async () => new Response("network"));
  vi.stubGlobal("window", { location: { search, origin: "http://localhost" }, fetch: network });
  return network;
}

describe("installDemoFetch", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("is a no-op in production builds", () => {
    const network = page("?shop=demo");
    vi.stubEnv("NODE_ENV", "production");
    const setup = vi.fn();
    installDemoFetch("shop", "/api/shop", setup);
    expect(setup).not.toHaveBeenCalled();
    expect(window.fetch).toBe(network);
  });

  it("routes the prefix to the demo and everything else to the network", async () => {
    page("?quiz=demo");
    installDemoFetch("quiz", "/api/quiz", () => async (path, body) => reply({ ok: true, data: { path, n: body.n } }, "echo"));
    expect(await (await window.fetch("/api/quiz/one", { method: "POST", body: JSON.stringify({ n: 2 }) })).json()).toEqual({ ok: true, echo: { path: "/api/quiz/one", n: 2 } });
    expect(await (await window.fetch("/api/other")).text()).toBe("network");
  });
});
