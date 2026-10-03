import { describe, expect, it } from "vitest";
import { CLASS_KITS } from "@/lib/combat/classes";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { RemoteEntry, RemotePlayer } from "@/lib/net/types";
import { createRig } from "./drive";
import { AuraStore, auraOf, showsAura } from "./RemoteAuras";

const kit = CLASS_KITS.find(k => k.key)!;
const player = (p: Partial<RemotePlayer>): RemotePlayer => ({ showClass: true, kit: "", family: null, mastery: 0, aura: "", ...p }) as RemotePlayer;
const rig = (sid: number, p: RemotePlayer) => createRig({ sid, player: p, sample: (_now, out) => out } as RemoteEntry);

describe("a remote's aura (spec §5.6)", () => {
  it("is their subclass's at its mastery and equipped colour, else their family's, and only while they show their class", () => {
    expect(auraOf(player({ kit: kit.key, mastery: 12 }))).toEqual({ kit, mastery: 12, colour: null });
    expect(auraOf(player({ kit: kit.key, aura: "mastery:colour" }))).toMatchObject({ colour: kit.look.ramp[0] });
    expect(auraOf(player({ family: "Warden" }))).toEqual({ family: FAMILIES.Warden.light });
    expect(auraOf(player({ kit: kit.key, family: "Warden", showClass: false }))).toBeNull();
    expect(auraOf(player({}))).toBeNull();
    expect(showsAura(player({ family: "Arcane" }))).toBe(true);
    expect(showsAura(player({ kit: "not-a-kit" }))).toBe(false);
  });

  it("mounts the auras the tiers gave out, and tells React only when who has one, or their card, changes", () => {
    const a = rig(1, player({ family: "Ranger" })), b = rig(2, player({ kit: kit.key })), store = new AuraStore();
    let told = 0;
    store.subscribe(() => told++);
    a.lod.aura = true;
    store.update([a, b]);
    expect(store.list.map(v => v.sid)).toEqual([1]);
    expect(store.list[0].feet).toBe(a.feet);
    store.update([a, b]);
    expect(told).toBe(1);
    b.lod.aura = true;
    store.update([a, b]);
    expect(store.list.map(v => v.sid)).toEqual([1, 2]);
    a.entry = { ...a.entry, player: player({ family: "Vanguard" }) };
    store.update([a, b]);
    expect(store.list[0].player.family).toBe("Vanguard");
    a.lod.aura = false; b.lod.aura = false;
    store.update([a, b]);
    expect(store.list).toEqual([]);
    expect(told).toBe(4);
  });
});
