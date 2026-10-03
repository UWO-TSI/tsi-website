import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AREAS, FLAG, type Area, type RosterEntry } from "@/lib/net/protocol";
import type { NetSource, RemoteEntry, RemotePlayer } from "@/lib/net/types";
import NetHud, { statusLine } from "./NetHud";
import { AREA_GROUPS, PhoneIcon, groupRoster, levelsInView } from "./PresenceList";

const at = (name: string, area: Area, o: Partial<RosterEntry> = {}): RosterEntry => ({ uid: `u-${name}`, name, badge: 0, area: AREAS.indexOf(area), flags: 0, ...o });

describe("the people list (spec §5.7)", () => {
  it("groups the shard by place in the list's order, names sorted, ruins and homes listed as private places", () => {
    const groups = groupRoster([at("Zed", "cafe"), at("Ana", "village"), at("Bo", "home"), at("Cy", "house"), at("Al", "cafe", { flags: FLAG.mobile }), at("Di", "ruins")]);
    expect(groups.map(g => g.label)).toEqual(["Village", "Café", "In the ruins", "On their island"]);
    expect(groups[1].people.map(p => p.name)).toEqual(["Al", "Zed"]);
    expect(groups[3].people.map(p => p.name)).toEqual(["Bo", "Cy"]);
    expect(AREA_GROUPS.flatMap(g => g.areas).sort()).toEqual([...AREAS].sort()); // every area has a place in the list
  });

  it("knows the level of the players in view only (the roster carries none)", () => {
    const entries = [{ uid: "a", level: 7 }, { uid: "b", level: 0 }, { uid: "c", level: 3 }].map((p, i) => ({ sid: i, player: p as RemotePlayer, sample: (_n, o) => o }) as RemoteEntry);
    const src = { remotes: { size: entries.length, at: (i: number) => entries[i] } } as unknown as NetSource;
    expect([...levelsInView(src, new Set(["a", "b"]))]).toEqual([["a", 7]]);
    expect(levelsInView(null, new Set(["a"])).size).toBe(0);
  });

  it("draws the phone in the kit's ink, not an emoji", () => {
    const html = renderToStaticMarkup(createElement(PhoneIcon, { label: "On their phone" }));
    expect(html).toContain("<svg");
    expect(html).toContain('aria-label="On their phone"');
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("the multiplayer HUD", () => {
  it("says nothing while you're with the others or offline mode is off, and what's wrong otherwise", () => {
    expect(statusLine(null)).toBeNull();
    expect(statusLine({ kind: "off" })).toBeNull();
    expect(statusLine({ kind: "joined", shard: 2 })).toBeNull();
    expect(statusLine({ kind: "connecting" })).toMatchObject({ busy: true });
    expect(statusLine({ kind: "reconnecting" })).toMatchObject({ text: "Reconnecting…", busy: true });
    expect(statusLine({ kind: "offline", retryAt: 0 })?.action).toBeUndefined();
    expect(statusLine({ kind: "kicked", reason: "replaced" })).toMatchObject({ action: "play" });
    expect(statusLine({ kind: "kicked", reason: "version" })).toMatchObject({ action: "reload" });
  });

  it("renders nothing at all with multiplayer off", () => {
    expect(renderToStaticMarkup(createElement(NetHud, { area: "village" }))).toBe("");
  });
});
