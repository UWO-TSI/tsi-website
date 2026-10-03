import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import NetHud from "./NetHud";
import NetWorld from "./NetWorld";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** The multiplayer plan's one-line edits to shared files (specs/multiplayer.md §8), kept through other branches' merges. */
describe("multiplayer's edits to the shared scene files", () => {
  it("taps both local controllers once: PlayerAvatar with what it holds and its sim, InteriorPlayer bare", () => {
    const avatar = read("../PlayerAvatar.tsx"), interior = read("../interiorShared.tsx");
    expect(avatar.match(/useLocalAvatarTap\(/g)).toHaveLength(1);
    expect(avatar).toMatch(/const sim = useRef<MoveSim \| null>\(null\)[^\n]*\n\s*useLocalAvatarTap\(motion, held, sim\);/);
    expect(interior.match(/useLocalAvatarTap\(motion\);/g)).toHaveLength(1);
  });

  it("mounts NetWorld in the island's Canvas and NetHud over it, with the scene's area, and passes the bench claims", () => {
    const world = read("../DefaultIslandWorld.tsx");
    expect(world).toMatch(/const area: Area = site === "ruins" \? "ruins" : site === "home" \? \(inside === "house" \? "house" : "home"\) : (inside === "shop" \? "village" : )?inside \?\? "village";/);
    expect(world).toMatch(/\{children\}\n\s*<NetWorld area=\{area\} player=\{player\} ready=\{ready && !fading( && netReady)?\} \/>/);
    expect(world).toMatch(/<NetHud area=\{area\} \/>\n\s*<LoadingStatus ready=\{ready\} \/>/);
    expect(world).toMatch(/benchSeat\(px, pz, 1\.3, v, layout\.benches, remoteSeatTaken\)/);
    // The bench's claim key rides the tsi:sit detail (the sender's `seat`).
    expect(world).toMatch(/benchSpot\.current = b && \{ \.\.\.b, seatY:/);
  });

  it("mounts nothing and costs nothing with multiplayer off (no realtime URL, no ?bots): the applicant island and solo play", () => {
    expect(renderToStaticMarkup(createElement(NetWorld, { area: "village", player: { current: new THREE.Vector3() }, ready: true }))).toBe("");
    expect(renderToStaticMarkup(createElement(NetHud, { area: "village" }))).toBe("");
  });
});
