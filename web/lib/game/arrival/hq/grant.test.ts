import { describe, expect, it } from "vitest";
import { giveTool, type ToolGrantStore } from "./grant";
import { checkHeld } from "@/lib/game/tools";
import { GAME_WORLD } from "@/lib/game/world/active";

function store(taught: string[]): ToolGrantStore & { inv: Map<string, string[]> } {
  const inv = new Map<string, string[]>();
  return {
    inv,
    taught: async m => taught.includes(m),
    grant: async (m, slug) => { const have = inv.get(m) ?? []; if (!have.includes(slug)) inv.set(m, [...have, slug]); },
  };
}

describe("a resident hands you a tool (POST /api/world/tools)", () => {
  it("puts the tier-1 tool in a taught member's inventory, once", async () => {
    const s = store(["a"]);
    expect(checkHeld("net-basic", "net", s.inv.get("a") ?? [], true)).toMatchObject({ ok: false, code: "tool_not_owned" });
    expect(await giveTool(s, "a", { tool: "net" })).toEqual({ ok: true, data: { tool: "net", key: "net-basic", granted: true } });
    expect(await giveTool(s, "a", { tool: "net" })).toMatchObject({ ok: true });
    expect(s.inv.get("a")).toEqual(["net-basic"]);
    expect(checkHeld("net-basic", "net", s.inv.get("a")!, true)).toMatchObject({ ok: true });
    await giveTool(s, "a", { tool: "shovel" });
    expect(s.inv.get("a")).toEqual(["net-basic", "shovel-basic"]);
  });

  it("writes nothing for an existing player: the starters are already theirs", async () => {
    const s = store([]);
    expect(await giveTool(s, "old", { tool: "net" })).toEqual({ ok: true, data: { tool: "net", key: "net-basic", granted: false } });
    expect(s.inv.size).toBe(0);
    // The pickaxe is nobody's starter: on the new world Eliza's gift is written for everyone; the village has no such gift.
    if (GAME_WORLD === "new") {
      expect(await giveTool(s, "old", { tool: "pickaxe" })).toEqual({ ok: true, data: { tool: "pickaxe", key: "pickaxe-basic", granted: true } });
      expect(s.inv.get("old")).toEqual(["pickaxe-basic"]);
    } else expect(await giveTool(s, "old", { tool: "pickaxe" })).toMatchObject({ ok: false, status: 400 });
  });

  it("hands over only a tool a resident teaches", async () => {
    const s = store(["a"]);
    for (const body of [{ tool: "axe" }, { tool: "rod" }, { tool: "net-emperor" }, {}, { tool: "net", extra: 1 }, "net"]) {
      expect(await giveTool(s, "a", body)).toMatchObject({ ok: false, status: 400 });
    }
    expect(s.inv.size).toBe(0);
  });
});
