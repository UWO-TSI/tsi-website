import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("seat-mates who are in your room as players (multiplayer §3)", () => {
  const src = readFileSync(new URL("./StudySeats.tsx", import.meta.url), "utf8");
  it("draws no second body for a member multiplayer already draws, and keeps their overhead timer", () => {
    expect(src).toMatch(/const inRoom = useRemoteUids\(\);/);
    expect(src).toMatch(/<MateFigure [^>]*body=\{!inRoom\.has\(m\.member_id\)\}/);
    expect(src).toMatch(/\{body && <Character look=\{look\} motion=\{motion\} \/>\}/);
    // The timer is outside the body's condition.
    expect(src).toMatch(/\{overhead && <Html calculatePosition=\{calculateCurvedHtmlPosition\}/);
  });
  it("still draws everyone with multiplayer off (the companion's table scene uses MateFigure as it was)", () => {
    expect(src).toMatch(/overhead = true, body = true \}/);
  });
});
