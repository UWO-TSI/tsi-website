import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { assetVersions } from "./assetVersions";

describe("the game files' versions", () => {
  it("change for the one file whose bytes change, and only for it", () => {
    const pub = mkdtempSync(join(tmpdir(), "asset-versions-"));
    for (const d of ["assets/game", "models", "audio/sfx"]) mkdirSync(join(pub, d), { recursive: true });
    writeFileSync(join(pub, "assets/game/a.glb"), "model a");
    writeFileSync(join(pub, "assets/game/b.png"), "texture b");
    writeFileSync(join(pub, "models/c.glb"), "model c");
    writeFileSync(join(pub, "audio/sfx/d.ogg"), "sound d");
    const before = assetVersions(pub);
    expect(Object.keys(before).sort()).toEqual(["/assets/game/a.glb", "/assets/game/b.png", "/audio/sfx/d.ogg", "/models/c.glb"]);
    expect(Object.values(before).every(v => /^[\w-]{8}$/.test(v))).toBe(true);
    expect(assetVersions(pub)).toEqual(before);
    writeFileSync(join(pub, "assets/game/b.png"), "texture b, repainted");
    const after = assetVersions(pub);
    expect(Object.keys(after).filter(k => after[k] !== before[k])).toEqual(["/assets/game/b.png"]);
  });

  it("go on a URL the build saw, and nowhere else", async () => {
    vi.stubEnv("ASSET_VERSIONS", JSON.stringify({ "/assets/game/a.glb": "abcd1234" }));
    vi.resetModules();
    const { assetUrl } = await import("./assetUrl");
    expect(assetUrl("/assets/game/a.glb")).toBe("/assets/game/a.glb?v=abcd1234");
    expect(assetUrl("/assets/game/unknown.glb")).toBe("/assets/game/unknown.glb");
    expect(assetUrl("blob:http://localhost/1234")).toBe("blob:http://localhost/1234");
    vi.unstubAllEnvs();
  });
});
