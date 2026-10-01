import { describe, expect, it } from "vitest";
import { peacefulLabel, setPeacefulTarget, subscribePeacefulLabel } from "./peacefulNear";

describe("the forage/net prompt follows the nearest target", () => {
  it("publishes a new label when the nearest node changes, and only then", () => {
    let calls = 0;
    const off = subscribePeacefulLabel(() => calls++);
    setPeacefulTarget({ id: "a", kind: "forage", label: "Pick up the branch", distance: 1 });
    expect(peacefulLabel()).toBe("Pick up the branch");
    setPeacefulTarget({ id: "a", kind: "forage", label: "Pick up the branch", distance: 0.8 }); // same node, closer
    expect(calls).toBe(1);
    setPeacefulTarget({ id: "b", kind: "forage", label: "Pick up the shell", distance: 0.9 });
    expect(peacefulLabel()).toBe("Pick up the shell");
    setPeacefulTarget({ id: "c", kind: "forage", label: "Open the bottle", distance: 0.5 }, "bottle");
    expect(peacefulLabel()).toBe("Open the bottle");
    setPeacefulTarget(null, "bottle");
    setPeacefulTarget(null);
    expect(peacefulLabel()).toBeNull();
    expect(calls).toBe(5);
    off();
  });
});
