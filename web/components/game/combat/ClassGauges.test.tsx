import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GUNSLINGER, HUNTER, MARKSMAN, SNIPER } from "@/lib/combat/rangerKits";
import { setup } from "@/lib/game/combat/ranger/rig";
import ClassGauges from "./ClassGauges";

const html = (rt: ReturnType<typeof setup>["rt"]) => renderToStaticMarkup(createElement(ClassGauges, { rt, swapKey: "r" }));

describe("the kits' HUD gauges (ClassGauges)", () => {
  it("Marksman: Focus and the fire rate", () => {
    const { rt } = setup(MARKSMAN);
    rt.v2!.live.focus = 0.5;
    expect(html(rt)).toMatch(/Focus.*4\.8\/s/);
  });
  it("Sniper: the Killstreak's five pips", () => {
    const { rt } = setup(SNIPER);
    rt.v2!.live.streak = 3;
    const out = html(rt);
    expect(out).toContain("Streak");
    expect(out.match(/<i data-on="true"/g)?.length).toBe(3);
  });
  it("Hunter: traps against the cap", () => {
    const { rt } = setup(HUNTER);
    expect(html(rt)).toMatch(/Traps 0\/3/);
  });
  it("Gunslinger: six chambers, the reload bar with its gold span, a spun cylinder's hammer", () => {
    const { rt } = setup(GUNSLINGER);
    const l = rt.v2!.live;
    expect(html(rt).match(/<li /g)?.length).toBe(6);
    l.ammo = 0; l.reload = 0.3; l.reloadLen = 1.2;
    expect(html(rt)).toMatch(/aria-label="Reloading".*left:45%.*width:20/);
    l.reload = null; l.ammo = 6; l.loaded = ["warhead", "gold"]; l.cockEvery = 0.6; l.cock = 0.2; l.window = 7.2;
    const spun = html(rt);
    expect(spun).toContain("Cocking… · 8 s");
    expect(spun.match(/background:#ffd27a/g)?.length).toBe(2); // the warhead looks like the golden ones
  });
});

describe("the gauges' type (UI audit 2026-10 item 12)", () => {
  const css = readFileSync(new URL("./ClassGauges.module.css", import.meta.url), "utf8");
  it("is the kit's face through its variable, not a literal family next/font never registers", () => {
    expect(css).not.toMatch(/IBM Plex Mono|monospace/);
    expect(css).toMatch(/var\(--gui-font\)/);
  });
  it("keeps its small print (the rate, the reload hint, traps) at the row's size, not the browser's smaller", () => {
    expect(css).toMatch(/\.gauges small\s*\{[^}]*font-size:\s*inherit/);
  });
  it("is never under the kit's 12 px floor", () => {
    const sizes = [...css.matchAll(/font(?:-size)?:[^;]*?\b(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1]));
    expect(sizes.filter(px => px < 12)).toEqual([]);
  });
});
