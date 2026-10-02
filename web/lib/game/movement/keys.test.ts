import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MOVE_KEYS, crouchKey, moveDefaults, readMoveKeys, remapMove } from "./keys";

const saved = new Map<string, string>();
beforeEach(() => { saved.clear(); vi.stubGlobal("localStorage", { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v); } }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("movement keys", () => {
  it("default to WASD, Space jump, Q dash, Shift sprint, crouch/slide; remap with swaps, refuse menu and ability keys, and persist", () => {
    expect(readMoveKeys()).toEqual({ forward: "w", left: "a", back: "s", right: "d", jump: " ", dash: "q", sprint: "shift", crouch: DEFAULT_MOVE_KEYS.crouch });
    expect(remapMove(DEFAULT_MOVE_KEYS, "forward", "y")).toMatchObject({ ok: true, keys: { forward: "y" } });
    // The arrows turn the camera and V snaps it back (specs/camera-orbit.md): no movement key takes them.
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "v"]) expect(remapMove(DEFAULT_MOVE_KEYS, "forward", key)).toMatchObject({ ok: false });
    expect(remapMove(DEFAULT_MOVE_KEYS, "dash", " ")).toMatchObject({ ok: true, keys: { dash: " ", jump: "q" } });
    expect(readMoveKeys()).toMatchObject({ dash: " ", jump: "q" });
    expect(remapMove(DEFAULT_MOVE_KEYS, "dash", "e")).toMatchObject({ ok: false });
    expect(remapMove(DEFAULT_MOVE_KEYS, "dash", "1", ["1", "2", "3", "4", "r"])).toMatchObject({ ok: false });
    // Emotes (G) and put away (X) are fixed keys; the menu keys (account settings) are taken.
    for (const key of ["g", "x", "b", "l"]) expect(remapMove(DEFAULT_MOVE_KEYS, "sprint", key)).toMatchObject({ ok: false });
    saved.set("tsi.moveKeys.v1", JSON.stringify({ ...DEFAULT_MOVE_KEYS, sprint: "g" })); // saved before G was fixed
    expect(readMoveKeys().sprint).toBe("shift");
    saved.set("tsi.moveKeys.v1", JSON.stringify({ ...DEFAULT_MOVE_KEYS, jump: "w" })); // a clash: back to the defaults
    expect(readMoveKeys()).toEqual(DEFAULT_MOVE_KEYS);
  });
  it("crouch/slide is Ctrl on macOS and C elsewhere; only crouch can take Ctrl, and outside macOS it needs the fullscreen lock", () => {
    expect(moveDefaults(true).crouch).toBe("control");
    expect(moveDefaults(false).crouch).toBe("c");
    const mac = moveDefaults(true), other = moveDefaults(false);
    expect(remapMove(other, "crouch", "Control")).toMatchObject({ ok: true, keys: { crouch: "control" } });
    expect(remapMove(other, "jump", "Control")).toMatchObject({ ok: false });
    expect(remapMove(mac, "jump", "Control")).toMatchObject({ ok: false }); // a swap would put Ctrl on jump
    expect(remapMove(mac, "crouch", " ")).toMatchObject({ ok: false });
    expect(remapMove(mac, "crouch", "t")).toMatchObject({ ok: true, keys: { crouch: "t" } });
    saved.set("tsi.moveKeys.v1", JSON.stringify({ ...other, dash: "control" })); // never stored by a remap: refused on read
    expect(readMoveKeys().dash).toBe("q");
    // Ctrl bound outside macOS: C crouches until the keyboard is locked in fullscreen (none if C is taken).
    const ctrl = { ...other, crouch: "control" };
    expect(crouchKey(ctrl, false, false)).toBe("c");
    expect(crouchKey(ctrl, true, false)).toBe("control");
    expect(crouchKey(ctrl, false, true)).toBe("control");
    expect(crouchKey({ ...ctrl, dash: "c" }, false, false)).toBe("");
    expect(crouchKey(other, false, false)).toBe("c");
  });
});
