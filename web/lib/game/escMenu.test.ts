import { describe, expect, it, vi } from "vitest";
import { nextLayer, pauseGame, subscribePause } from "./escMenu";

describe("the Esc layers (playtest round 1, decision 3)", () => {
  it("goes game, UI view, system menu, game", () => {
    expect(nextLayer(null)).toBe("ui");
    expect(nextLayer("ui")).toBe("system");
    expect(nextLayer("system")).toBe(null);
  });
  it("tells every listener when mouse-look ends on its own, until they leave", () => {
    const a = vi.fn(), b = vi.fn();
    const offA = subscribePause(a), offB = subscribePause(b);
    pauseGame();
    offA();
    pauseGame();
    offB();
    pauseGame();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});
