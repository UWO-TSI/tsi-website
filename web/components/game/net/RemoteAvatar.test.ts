import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, parseLook, randomLook, seeded } from "@/lib/game/character/look";
import { TOOLS } from "@/lib/game/tools";
import { LEAF_URL } from "../character/Character";
import { remoteHeld, remoteLook, remoteWeapon } from "./RemoteAvatar";

describe("a remote's look and what they carry", () => {
  it("wears the card's look, the default for none or for anything unreadable", () => {
    const look = randomLook(seeded(9));
    expect(remoteLook(JSON.stringify(look))).toEqual(parseLook(look));
    expect(remoteLook("")).toBe(DEFAULT_LOOK);
    expect(remoteLook("{not json")).toBe(DEFAULT_LOOK);
  });

  it("holds the wheel's tool, the furled leaf or a snack in the hand, never a weapon there", () => {
    const rod = TOOLS.find(t => t.kind === "rod")!, net = TOOLS.find(t => t.kind === "net")!;
    expect(remoteHeld(`rod:${rod.key}`)).toEqual({ url: rod.model, hold: "rod" });
    expect(remoteHeld(`net:${net.key}`)).toEqual({ url: net.model, hold: "net" });
    expect(remoteHeld("glider")).toEqual({ url: LEAF_URL, hold: "glider" });
    expect(remoteHeld("pin:fruit_coconut")?.hold).toBe("front");
    expect(remoteHeld("weapon:sword-driftwood")).toBeNull();
    expect(remoteHeld("rod:not-a-rod")).toBeNull();
    expect(remoteHeld("")).toBeNull();
  });

  it("puts a weapon taken out from the wheel in the hand, the armed player's on the back", () => {
    expect(remoteWeapon("weapon:sword-driftwood", "")).toMatchObject({ kind: "melee", inHand: true });
    expect(remoteWeapon("", "bow-willow")).toMatchObject({ kind: "bow", inHand: false });
    expect(remoteWeapon("weapon:staff-oak", "bow-willow")).toMatchObject({ kind: "staff", inHand: true });
    expect(remoteWeapon("", "")).toBeNull();
    expect(remoteWeapon("", "wraps-cloth")).toBeNull(); // bare hands: nothing to draw
  });

  it("never mounts the local player's controllers or their window-event clips (spec §10)", () => {
    const src = ["RemoteAvatar.tsx", "RemoteAvatars.tsx"].map(f => readFileSync(new URL(`./${f}`, import.meta.url), "utf8")).join("\n");
    expect(src).not.toMatch(/<PlayerAvatar\b|<InteriorPlayer\b|useWorldClips\(/);
    expect(src).not.toMatch(/setState\s*\(|\[\s*\w+\s*,\s*set\w+\s*\]\s*=\s*useState/);
  });
});
