import { describe, expect, it } from "vitest";
import { HOLD_MS, tourInput, tourSteps, tourTick, type TourProgress } from "./uiTour";
import { KEYBOARD } from "@/components/gui/flat/moments";
import { DEFAULT_WHEEL_KEYS } from "@/lib/game/movement/keys";
import { DEFAULT_KEYS } from "@/lib/identity/settings";

const KEYS = { ...DEFAULT_WHEEL_KEYS, bag: DEFAULT_KEYS.openBag, collection: DEFAULT_KEYS.openJournal, quests: "j", map: DEFAULT_KEYS.openMap, mail: DEFAULT_KEYS.openMail };
const steps = tourSteps(KEYS);
const start: TourProgress = { step: 0, holdFrom: null };

describe("Alice's keyboard tour (the v2 review)", () => {
  it("teaches the real default bindings: hold Tab, hold G, hold H, Enter, I, B, J, M, L", () => {
    expect(steps.map(s => `${s.hold ? "hold" : "press"} ${s.key}`)).toEqual(
      ["hold tab", "hold g", "hold h", "press enter", "press i", "press b", "press j", "press m", "press l"]);
  });
  it("brings in a part of the screen with every key but the wheels' (the v3 review), each its own", () => {
    expect(steps.map(s => s.piece ?? "-")).toEqual(["-", "-", "hud", "chat", "bag", "collection", "quests", "map", "mail"]);
  });
  it("draws every key it asks for on the keyboard", () => {
    const board = new Set(KEYBOARD.flat().map(k => k.key));
    for (const s of steps) expect(board.has(s.key), s.key).toBe(true);
  });
  it("moves on only for the lit key: a hold once it's held long enough, a press at once", () => {
    let p = tourInput(start, steps, { type: "down", key: "g", at: 0 });
    expect(p).toBe(start);                                            // not the lit key
    p = tourInput(p, steps, { type: "down", key: "Tab", at: 100 });
    expect(p).toEqual({ step: 0, holdFrom: 100 });
    expect(tourTick(p, 100 + HOLD_MS - 1)).toBe(p);                    // not long enough yet
    expect(tourInput(p, steps, { type: "up", key: "tab", at: 300 })).toEqual({ step: 0, holdFrom: null }); // let go too soon
    expect(tourTick(p, 100 + HOLD_MS)).toEqual({ step: 1, holdFrom: null });
    const atChat = { step: 3, holdFrom: null };
    expect(tourInput(atChat, steps, { type: "down", key: "Enter", at: 0 })).toEqual({ step: 4, holdFrom: null });
    expect(tourInput(atChat, steps, { type: "down", key: "Enter", repeat: true, at: 0 })).toBe(atChat);
  });
});
