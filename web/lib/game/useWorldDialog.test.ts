import { afterEach, describe, expect, it } from "vitest";
import { dialogKeydown, isTyping, openDialog, routeDialogKey, worldKeysBlocked, type DialogEntry } from "./useWorldDialog";

/** A stand-in DOM: a panel with buttons that record focus. */
function fakeDialog(keys: string[] = [], buttons = 3) {
  const log: string[] = [];
  const items = Array.from({ length: buttons }, (_, i) => ({ name: `b${i}`, focus() { log.push(`focus ${this.name}`); }, getClientRects: () => [1] }));
  const panel = { focus() { log.push("focus panel"); }, getClientRects: () => [1], contains: (n: unknown) => n === panel || items.includes(n as never), querySelectorAll: () => items };
  const entry: DialogEntry = { panel: { current: panel }, close: () => log.push("close"), keys };
  return { entry, panel, items, log };
}
const key = (k: string, extra: Partial<{ shiftKey: boolean; repeat: boolean; metaKey: boolean }> = {}) => {
  const e = { key: k, ...extra, prevented: false, stopped: false, preventDefault() { e.prevented = true; }, stopImmediatePropagation() { e.stopped = true; } };
  return e;
};
const opened: (() => void)[] = [];
const open = (d: ReturnType<typeof fakeDialog>) => { opened.push(openDialog(d.entry)); return d; };
afterEach(() => { while (opened.length) opened.pop()!(); });

describe("routeDialogKey", () => {
  const top = { keys: ["j"] };
  it("closes on Escape from anywhere, typing included", () => {
    expect(routeDialogKey(top, { key: "Escape" }, false)).toBe("close");
    expect(routeDialogKey(top, { key: "Escape" }, true)).toBe("close");
  });
  it("closes on the key that opened it, not while typing or with a modifier", () => {
    expect(routeDialogKey(top, { key: "J" }, false)).toBe("close");
    expect(routeDialogKey(top, { key: "j" }, true)).toBeNull();
    expect(routeDialogKey(top, { key: "j", metaKey: true }, false)).toBeNull();
  });
  it("keeps Tab inside and leaves other keys to the controls", () => {
    expect(routeDialogKey(top, { key: "Tab" }, false)).toBe("tab");
    expect(routeDialogKey(top, { key: "e" }, false)).toBeNull();
    expect(routeDialogKey(null, { key: "Escape" }, false)).toBeNull();
  });
});

describe("isTyping", () => {
  it("is a text field, not a slider or a button", () => {
    expect(isTyping({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTyping({ tagName: "INPUT", type: "range" })).toBe(false);
    expect(isTyping({ tagName: "TEXTAREA", closest: s => (s.includes("textarea") ? {} : null) })).toBe(true);
    expect(isTyping({ tagName: "BUTTON", closest: () => null })).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe("the dialog stack", () => {
  it("blocks the world's hotkeys while any dialog is open", () => {
    expect(worldKeysBlocked()).toBe(false);
    open(fakeDialog());
    expect(worldKeysBlocked()).toBe(true);
    opened.pop()!();
    expect(worldKeysBlocked()).toBe(false);
  });
  it("Escape closes only the top dialog and stops the event there (the world never sees it)", () => {
    const below = open(fakeDialog()), top = open(fakeDialog());
    const e = key("Escape");
    dialogKeydown(e, top.items[0]);
    expect(top.log).toContain("close");
    expect(below.log).not.toContain("close");
    expect(e.prevented && e.stopped).toBe(true);
  });
  it("Escape still closes when a button inside has focus, and a held Escape closes one dialog, not all", () => {
    const d = open(fakeDialog());
    dialogKeydown(key("Escape", { repeat: true }), d.items[1]);
    expect(d.log).not.toContain("close");
    dialogKeydown(key("Escape"), d.items[1]);
    expect(d.log).toContain("close");
  });
  it("the opening key closes it, but types in a field", () => {
    const d = open(fakeDialog(["l"]));
    dialogKeydown(key("l"), { tagName: "INPUT", type: "text" });
    expect(d.log).not.toContain("close");
    dialogKeydown(key("l"), d.items[0]);
    expect(d.log).toContain("close");
  });
  it("Tab wraps from the last control to the first, Shift+Tab from the first to the last, and comes back in from outside", () => {
    const d = open(fakeDialog());
    const tab = key("Tab");
    dialogKeydown(tab, d.items[2]);
    expect(d.log.at(-1)).toBe("focus b0");
    expect(tab.prevented).toBe(true);
    dialogKeydown(key("Tab", { shiftKey: true }), d.items[0]);
    expect(d.log.at(-1)).toBe("focus b2");
    dialogKeydown(key("Tab"), { tagName: "CANVAS" });
    expect(d.log.at(-1)).toBe("focus b0");
    const inside = key("Tab");
    dialogKeydown(inside, d.items[0]);
    expect(inside.prevented).toBe(false); // the browser moves on to b1
  });
  it("a dialog with nothing to focus keeps focus on itself", () => {
    const d = open(fakeDialog([], 0));
    dialogKeydown(key("Tab"), null);
    expect(d.log.at(-1)).toBe("focus panel");
  });
});
