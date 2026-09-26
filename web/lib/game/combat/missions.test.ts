import { describe, expect, it } from "vitest";
import { BOARD_MISSIONS, MISSIONS } from "./data";
import { advanceMission, startMission, type MissionEvent } from "./missions";

const play = (id: string, events: MissionEvent[]) => events.reduce(advanceMission, startMission(MISSIONS.find(m => m.id === id)!));

describe("missions (systems state machines)", () => {
  it("the board shows one authored mission per template", () => {
    expect(BOARD_MISSIONS.map(m => m.template)).toEqual(["hunt", "fetch", "survive", "escort"]);
    expect(BOARD_MISSIONS.every(m => m.blurb.length > 0)).toBe(true);
  });
  it("hunt counts only the target and queues events once each", () => {
    const kills: MissionEvent[] = Array.from({ length: 7 }, () => ({ kind: "kill", enemy: "shadow-fox" }));
    const s = play("hunt-foxes", [{ kind: "kill", enemy: "thorn-crab" }, ...kills]);
    expect(s.status).toBe("complete");
    expect(s.progress.counter).toBe(6);
    expect(new Set(s.queue.map(e => e.id)).size).toBe(s.queue.length);
  });
  it("fetch needs the item carried back; defeat drops it", () => {
    expect(play("fetch-lantern", [{ kind: "pickup", item: "old-lantern" }, { kind: "defeated" }, { kind: "return" }]).status).toBe("active");
    expect(play("fetch-lantern", [{ kind: "pickup", item: "old-lantern" }, { kind: "return" }]).status).toBe("complete");
  });
  it("survive and escort fail on defeat (ruling), and complete in order", () => {
    expect(play("survive-circle", [{ kind: "wave-cleared", wave: 1 }, { kind: "defeated" }]).status).toBe("failed");
    expect(play("survive-circle", [1, 2, 3].map(wave => ({ kind: "wave-cleared", wave }) as MissionEvent)).status).toBe("complete");
    expect(play("escort-botanist", [{ kind: "escort-down" }]).status).toBe("failed");
    expect(play("escort-botanist", [...[1, 2, 3].map(n => ({ kind: "checkpoint", n }) as MissionEvent), { kind: "arrived" }]).status).toBe("complete");
  });
});
