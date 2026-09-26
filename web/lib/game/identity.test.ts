import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/identity/settings";
import { parseIdentity } from "./identity";

describe("world identity", () => {
  it("reads world name, member badge, family and settings from /api/identity/me", () => {
    const id = parseIdentity({ identity: { world_name: " Dahan ", badge: "member", family: "Warden", settings: { text_size: "large", high_contrast: true } } });
    expect(id).toMatchObject({ display_name: "Dahan", member: true, family: "Warden", signedIn: true });
    expect(id?.settings).toMatchObject({ text_size: "large", high_contrast: true });
  });
  it("shows public accounts without a badge and never invents a name or family", () => {
    expect(parseIdentity({ identity: { world_name: null, badge: null, family: "Wizard" } })).toMatchObject({ display_name: "You", member: false, family: null, settings: DEFAULT_SETTINGS, aura: true });
    expect(parseIdentity(null)).toBeNull();
  });
});
