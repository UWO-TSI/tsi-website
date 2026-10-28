import { describe, expect, it } from "vitest";
import { NO_RAID, type RaidUp } from "./protocol";
import { raidLink, raidNow, sendRaid } from "./raid";

describe("the page's raid link", () => {
  it("sends nothing until the room has sent a raid view (an older server would close on the type)", () => {
    const sent: RaidUp[] = [];
    raidLink.attach((up) => sent.push(up));
    expect(sendRaid({ op: "join", id: "a" })).toBe(false);
    raidLink.receive(NO_RAID);
    expect(sendRaid({ op: "join", id: "a" })).toBe(true);
    expect(sent).toEqual([{ op: "join", id: "a" }]);
    raidLink.detach();
    expect(sendRaid({ op: "join", id: "a" })).toBe(false);
    expect(raidNow()).toBe(NO_RAID);
  });
});
