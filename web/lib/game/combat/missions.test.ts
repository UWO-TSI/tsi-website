import { describe, expect, it } from "vitest";
import { MISSIONS } from "./data";
import { advanceMission, materialsLabel, startMission, type MissionEvent } from "./missions";
import { ESCORT_PATHS, FETCH_SPOTS, SURVIVE_CIRCLES } from "@/lib/game/ruins";
import { WAVES } from "./spawns";

const play = (id: string, events: MissionEvent[]) => events.reduce(advanceMission, startMission(MISSIONS.find(m => m.id === id)!));

describe("missions (systems state machines)", () => {
  it("the board shows all ten, over the four templates, each with a blurb, a difficulty and rewards", () => {
    expect(MISSIONS).toHaveLength(10);
    expect(new Set(MISSIONS.map(m => m.template))).toEqual(new Set(["hunt", "fetch", "survive", "escort"]));
    for (const m of MISSIONS) {
      expect(m.blurb.length).toBeGreaterThan(0);
      expect(m.difficulty).toBeGreaterThanOrEqual(1);
      expect(m.difficulty).toBeLessThanOrEqual(5);
      expect(m.reward.xp > 0 && m.reward.coins > 0 && Object.keys(m.reward.materials).length > 0).toBe(true);
      expect(materialsLabel(m.reward.materials)).not.toMatch(/_/); // real names, not item keys
    }
  });
  it("every mission has its place in the ruins: fetch spot, circle and waves, escort path", () => {
    for (const m of MISSIONS) {
      if (m.template === "fetch") expect(FETCH_SPOTS[m.params.item!]).toBeTruthy();
      if (m.template === "survive") { expect(SURVIVE_CIRCLES[m.id]).toBeTruthy(); expect(WAVES[m.id]).toHaveLength(m.params.waves!); }
      if (m.template === "escort") expect(ESCORT_PATHS[m.id]).toHaveLength(m.params.count! + 2); // start, checkpoints, arrival
    }
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
    expect(play("fetch-tome", [{ kind: "pickup", item: "old-lantern" }, { kind: "return" }]).status).toBe("active");
    expect(play("fetch-tome", [{ kind: "pickup", item: "sealed-tome" }, { kind: "return" }]).status).toBe("complete");
  });
  it("survive and escort fail on defeat (ruling), and complete in order", () => {
    expect(play("survive-circle", [{ kind: "wave-cleared", wave: 1 }, { kind: "defeated" }]).status).toBe("failed");
    expect(play("survive-circle", [1, 2, 3].map(wave => ({ kind: "wave-cleared", wave }) as MissionEvent)).status).toBe("complete");
    expect(play("survive-sanctum", [1, 2, 3].map(wave => ({ kind: "wave-cleared", wave }) as MissionEvent)).status).toBe("active");
    expect(play("escort-botanist", [{ kind: "escort-down" }]).status).toBe("failed");
    expect(play("escort-botanist", [...[1, 2, 3].map(n => ({ kind: "checkpoint", n }) as MissionEvent), { kind: "arrived" }]).status).toBe("complete");
    expect(play("escort-scholar", [...[1, 2, 3].map(n => ({ kind: "checkpoint", n }) as MissionEvent), { kind: "arrived" }]).status).toBe("active");
  });
});
